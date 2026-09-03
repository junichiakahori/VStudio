import { defineConfig } from 'vite';
import { spawn, exec } from 'child_process';
import net from 'net';
import fs from 'fs';
import path from 'path';

const checkPort = (port) => {
  return new Promise((resolve) => {
    const s = new net.Socket();
    s.once('error', () => resolve(false));
    s.once('connect', () => { s.destroy(); resolve(true); });
    s.connect(port, 'localhost');
  });
};

const killProcessOnPort = (port, serverFileName) => {
  return new Promise((resolve) => {
    // 1. スクリプト名によるピンポイント停止（Python/python3/絶対パス・相対パス全てに対応）
    if (serverFileName) {
      const baseName = serverFileName.split('/').pop();
      exec(`pkill -9 -f "${baseName}"`, () => {
        // ポート側も念のためチェックしてクリーンアップ
        cleanupPort(port, resolve);
      });
      return;
    }

    cleanupPort(port, resolve);
  });
};

const cleanupPort = (port, resolve) => {
  // 2. ポート番号で停止する場合: LISTEN状態のサーバープロセスのみを抽出し、ブラウザ/WebKitを絶対にkillしない
  exec(`lsof -nP -iTCP:${port} -sTCP:LISTEN`, (err, stdout) => {
    if (!stdout || !stdout.trim()) {
      resolve();
      return;
    }
    const lines = stdout.trim().split('\n').slice(1);
    const serverPids = [];
    lines.forEach(line => {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 2) {
        const cmd = parts[0].toLowerCase();
        const pid = parts[1];
        // Python または Node プロセスのみを安全にkill対象とする
        if (cmd.includes('python') || cmd.includes('node')) {
          serverPids.push(pid);
        }
      }
    });

    if (serverPids.length > 0) {
      exec(`kill -9 ${serverPids.join(' ')}`, () => resolve());
    } else {
      resolve();
    }
  });
};


const scriptMap = {
  'local_api_server': { file: 'server/local_api_server.py', port: 8001, logFile: 'logs/api_server.log' },
  'youtube_comment_server': { file: 'server/youtube_comment_server.py', port: 8768, logFile: 'logs/youtube_server.log' },
  'tiktok_comment_server': { file: 'server/tiktok_comment_server.py', port: 8767, logFile: 'logs/tiktok_server.log' }
};


const serverLogs = {
  'local_api_server': [],
  'youtube_comment_server': [],
  'tiktok_comment_server': []
};

const addLog = (serverName, type, msg) => {
  const time = new Date().toLocaleTimeString();
  serverLogs[serverName].push(`[${time}] [${type}] ${msg}`);
  if (serverLogs[serverName].length > 100) {
    serverLogs[serverName].shift();
  }
};

const backendManagerPlugin = () => ({
  name: 'backend-manager',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      // ▼▼▼ ここにCORSヘッダーを追加 ▼▼▼
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.end();
        return;
      }
      // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲
      // ── views/ への透過HTMLルーティング ──
      if (req.url === '/' || req.url.startsWith('/?')) {
        req.url = '/views/live2d.html' + (req.url.includes('?') ? '?' + req.url.split('?')[1] : '');
      } else if (/^\/([a-zA-Z0-9_-]+\.html)(\?.*)?$/.test(req.url)) {
        req.url = req.url.replace(/^\/([a-zA-Z0-9_-]+\.html)/, '/views/$1');
      }

      const url = new URL(req.url, `http://${req.headers.host}`);
      if (url.pathname.startsWith('/_api/servers')) {
        res.setHeader('Content-Type', 'application/json');

        // GET /_api/servers (Status list)
        if (req.method === 'GET' && url.pathname === '/_api/servers') {
          const status = {};
          for (const name of Object.keys(scriptMap)) {
            status[name] = await checkPort(scriptMap[name].port);
          }
          res.end(JSON.stringify(status));
          return;
        }

        // GET /_api/servers/:name/logs
        if (req.method === 'GET') {
          const parts = url.pathname.split('/');
          if (parts.length === 5 && parts[4] === 'logs') {
            const serverName = parts[3];
            let combinedLogs = [...(serverLogs[serverName] || [])];
            
            // 実ログファイルが存在する場合は末尾50行を取得してマージ
            const config = scriptMap[serverName];
            if (config && config.logFile) {
              const fullLogPath = path.resolve(process.cwd(), config.logFile);
              if (fs.existsSync(fullLogPath)) {
                try {
                  const fileContent = fs.readFileSync(fullLogPath, 'utf-8');
                  const lines = fileContent.split('\n').filter(Boolean);
                  const recentLines = lines.slice(-50);
                  if (combinedLogs.length === 0) {
                    combinedLogs = recentLines;
                  } else {
                    // 重複を避けてマージ
                    combinedLogs = Array.from(new Set([...combinedLogs, ...recentLines])).slice(-60);
                  }
                } catch (err) {
                  // read error fallback
                }
              }
            }

            res.end(JSON.stringify({ logs: combinedLogs }));
            return;
          }
        }

        // POST /_api/servers/:name/:action
        if (req.method === 'POST') {
          const parts = url.pathname.split('/');
          if (parts.length === 5) {
            const serverName = parts[3];
            const action = parts[4]; // start, stop

            const config = scriptMap[serverName];
            if (!config) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Unknown server name' }));
              return;
            }

            if (action === 'stop' || action === 'restart') {
              await killProcessOnPort(config.port, config.file);
              addLog(serverName, 'SYSTEM', 'Server stopped.');
            }

            if (action === 'start') {
              const isRunning = await checkPort(config.port);
              if (isRunning) {
                res.end(JSON.stringify({ status: 'already_running' }));
                return;
              }
              serverLogs[serverName] = [];
              addLog(serverName, 'SYSTEM', 'Starting server...');

              const child = spawn('python3', [config.file], {
                cwd: process.cwd(),
                stdio: 'pipe'
              });
              child.stdout.on('data', (data) => {
                const lines = data.toString().split('\n').filter(Boolean);
                lines.forEach(l => addLog(serverName, 'STDOUT', l));
              });
              child.stderr.on('data', (data) => {
                const lines = data.toString().split('\n').filter(Boolean);
                lines.forEach(l => addLog(serverName, 'STDERR', l));
              });
              child.on('close', (code) => {
                addLog(serverName, 'SYSTEM', `Process exited with code ${code}`);
              });
            } else if (action === 'restart') {
              serverLogs[serverName] = [];
              addLog(serverName, 'SYSTEM', 'Restarting server...');

              const child = spawn('python3', [config.file], {
                cwd: process.cwd(),
                stdio: 'pipe'
              });
              child.stdout.on('data', (data) => {
                const lines = data.toString().split('\n').filter(Boolean);
                lines.forEach(l => addLog(serverName, 'STDOUT', l));
              });
              child.stderr.on('data', (data) => {
                const lines = data.toString().split('\n').filter(Boolean);
                lines.forEach(l => addLog(serverName, 'STDERR', l));
              });
              child.on('close', (code) => {
                addLog(serverName, 'SYSTEM', `Process exited with code ${code}`);
              });
            }

            res.end(JSON.stringify({ success: true, server: serverName, action }));
            return;
          }
        }
      }
      next();
    });
  }
});

export default defineConfig({
  plugins: [backendManagerPlugin()],
  server: {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0'
    },
    host: 'localhost',
    port: 8443,
    strictPort: true,
    hmr: false, // 配信中の勝手な画面強制リロード・エラーオーバーレイを完全防止
    watch: {
      ignored: ['**'] // ファイル監視を完全無効化し、配信画面へのエラーポップアップ通知を根絶
    },
    proxy: {
      '^/(api|news_script|log(?:$|[/?])|update_hiragana_data|radio_script|radio_script_yomi|radio_script_config|custom_idle_phrases|hiragana_data|se_list|add_idle_phrase|convert_remaining_kanji|fetch_rss|get_youtube_video_info)': {
        target: 'http://localhost:8001',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  build: {
    target: 'esnext'
  }
});
