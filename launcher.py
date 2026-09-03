import os
import sys
import time
import socket
import signal
import subprocess
import atexit
import shutil
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
LOG_DIR = BASE_DIR / "logs"
LOG_DIR.mkdir(exist_ok=True)
BACKUP_DIR = BASE_DIR / "logs_backup"
BACKUP_DIR.mkdir(exist_ok=True)

LAUNCHER_LOG = LOG_DIR / "launcher.log"

def log(msg, level="INFO"):
    ts = time.strftime("%Y-%m-%d %H:%M:%S")
    formatted = f"[{ts}] [Launcher] [{level}] {msg}"
    print(formatted)
    try:
        with open(LAUNCHER_LOG, "a", encoding="utf-8") as f:
            f.write(formatted + "\n")
    except Exception:
        pass


def notify(title, message):
    try:
        script = f'display notification "{message}" with title "{title}"'
        subprocess.run(["osascript", "-e", script], check=False)
    except Exception as e:
        log(f"Notification error: {e}")

def is_port_open(port, host="127.0.0.1"):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex((host, port)) == 0

def kill_port_owner(port):
    try:
        res = subprocess.run(["lsof", "-ti", f":{port}"], capture_output=True, text=True)
        pids = res.stdout.strip().split()
        for pid in pids:
            if pid and pid != str(os.getpid()):
                log(f"Killing old process on port {port} (PID: {pid})")
                subprocess.run(["kill", "-9", pid], check=False)
    except Exception as e:
        log(f"Error cleaning port {port}: {e}")

# Global processes list
processes = []

def cleanup():
    log("Shutting down all VStudio services...")
    for p in processes:
        if p.poll() is None:
            try:
                log(f"Terminating PID {p.pid}...")
                p.terminate()
            except Exception:
                pass
    time.sleep(1)
    for p in processes:
        if p.poll() is None:
            try:
                p.kill()
            except Exception:
                pass
    log("All services stopped.")
    notify("VStudio", "全サーバーを停止しました")

atexit.register(cleanup)

def signal_handler(signum, frame):
    cleanup()
    sys.exit(0)

signal.signal(signal.SIGINT, signal_handler)
def get_python_exec():
    candidates = [
        os.path.expanduser("~/.pyenv/shims/python3"),
        "/Library/Frameworks/Python.framework/Versions/3.14/bin/python3",
        sys.executable,
        "/usr/local/bin/python3",
        "/opt/homebrew/bin/python3",
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    return sys.executable

def get_env():
    env = os.environ.copy()
    home = os.path.expanduser("~")
    # Place pyenv and python at the top of PATH
    paths = [
        os.path.join(home, ".pyenv", "shims"),
        "/Library/Frameworks/Python.framework/Versions/3.14/bin",
        "/opt/homebrew/bin",
        "/opt/homebrew/sbin",
        "/usr/local/bin",
        os.path.join(home, ".pyenv", "bin"),
        os.path.join(home, ".nvm", "versions", "node"),
        env.get("PATH", "")
    ]
    env["PATH"] = ":".join([p for p in paths if p])
    return env

def archive_and_cleanup_logs():
    """起動時に既存ログを logs_backup/ に退避し、7日以上前のバックアップを削除"""
    today_str = time.strftime("%Y-%m-%d")
    ts_str = time.strftime("%Y%m%d_%H%M%S")
    
    # 1. 7日以上前の古いバックアップを削除
    cutoff_time = time.time() - (7 * 86400)
    for p in BACKUP_DIR.glob("*.log"):
        try:
            if p.is_file() and p.stat().st_mtime < cutoff_time:
                p.unlink()
                log(f"🧹 Cleaned up old log backup: {p.name}")
        except Exception:
            pass

    # 2. 既存のログファイルを logs_backup/ に日付単位 (YYYY-MM-DD) で安全に追記退避
    for log_name in ["api_server.log", "youtube_server.log", "tiktok_server.log", "vite.log", "launcher.log", "browser_console.log", "native_console.log", "web_console.log"]:
        src = LOG_DIR / log_name
        if src.exists() and src.stat().st_size > 0:
            stem = src.stem
            target_name = f"{stem}_{today_str}.log"
            target_path = BACKUP_DIR / target_name
            try:
                with open(src, "r", encoding="utf-8", errors="ignore") as f_src:
                    content = f_src.read()
                with open(target_path, "a", encoding="utf-8") as f_dst:
                    f_dst.write(content)
                log(f"📦 Archived previous log (Appended): {log_name} -> logs_backup/{target_name}")
            except Exception as e:
                log(f"Failed to archive {log_name}: {e}")


def start_services(open_browser=True):
    global processes
    processes = []
    
    # 0. Archive old logs before starting new session
    archive_and_cleanup_logs()
    
    # 1. Clean up old ports
    ports_to_clean = [8443, 8001, 8768, 8767]
    for port in ports_to_clean:
        kill_port_owner(port)
    time.sleep(0.5)
    
    env = get_env()
    py_exec = get_python_exec()
    log(f"Using Python: {py_exec}")
    
    services = [
        ("local_api_server.py", [py_exec, str(BASE_DIR / "server" / "local_api_server.py")], 8001, "api_server.log"),
        ("youtube_comment_server.py", [py_exec, str(BASE_DIR / "server" / "youtube_comment_server.py")], 8768, "youtube_server.log"),
        ("tiktok_comment_server.py", [py_exec, str(BASE_DIR / "server" / "tiktok_comment_server.py")], 8767, "tiktok_server.log"),
        ("vite_dev_server", ["npm", "run", "dev"], 8443, "vite.log"),
    ]
    
    for name, cmd, port, log_file in services:
        log_path = LOG_DIR / log_file
        log_fp = open(log_path, "w", encoding="utf-8")
        log(f"Starting {name} (logging to {log_file})...")
        p = subprocess.Popen(
            cmd,
            cwd=str(BASE_DIR),
            env=env,
            stdout=log_fp,
            stderr=subprocess.STDOUT,
            preexec_fn=os.setsid if hasattr(os, "setsid") else None
        )
        processes.append(p)

    log("Waiting for Vite (8443) & API (8001) to become ready...")
    ready = False
    for _ in range(30):
        if is_port_open(8443) and is_port_open(8001):
            ready = True
            break
        time.sleep(0.5)

    if ready:
        log("All core services are UP and listening.")
        if open_browser:
            notify("VStudio 起動完了", "サーバーが起動しました。Live2D画面を開きます。")
            subprocess.run(["open", "http://localhost:8443/live2d.html"], check=False)
    else:
        log("Warning: Services started, but some ports may not be ready yet.")
        if open_browser:
            notify("VStudio", "サーバーを起動しました（ポート応答待機中）")
            subprocess.run(["open", "http://localhost:8443/live2d.html"], check=False)

def show_dialog():
    """Show interactive control dialog using osascript"""
    while True:
        applescript = '''
        set dlgResult to button returned of (display dialog "🎙️ VStudio サーバーが稼働中です。\n\n・Vite HTTP: 8443\n・Local API: 8001\n・YouTube WS: 8768\n・TikTok WS: 8767" with title "VStudio ランチャー" buttons {"ブラウザを開く", "サーバー再起動", "停止して終了"} default button "ブラウザを開く" with icon note)
        return dlgResult
        '''
        try:
            res = subprocess.run(["osascript", "-e", applescript], capture_output=True, text=True)
            choice = res.stdout.strip()
            
            if choice == "ブラウザを開く":
                subprocess.run(["open", "http://localhost:8443/live2d.html"], check=False)
            elif choice == "サーバー再起動":
                log("Restarting services...")
                cleanup()
                time.sleep(1)
                start_services()
            elif choice == "停止して終了" or res.returncode != 0:
                # Cancel or Stop
                log("User requested stop.")
                break
        except Exception as e:
            log(f"Dialog error: {e}")
            break

def main():
    is_headless = "--headless" in sys.argv
    log(f"=== VStudio Launcher Started (headless={is_headless}) ===")
    start_services(open_browser=not is_headless)
    if is_headless:
        # Keep running until signal
        try:
            while True:
                time.sleep(1)
        except (KeyboardInterrupt, SystemExit):
            pass
    else:
        show_dialog()
    cleanup()
    log("=== VStudio Launcher Exited ===")

if __name__ == "__main__":
    main()
