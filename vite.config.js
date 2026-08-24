import { defineConfig } from 'vite';
import { spawn, exec } from 'child_process';
import net from 'net';

const checkPort = (port) => {
  return new Promise((resolve) => {
    const s = new net.Socket();
    s.once('error', () => resolve(false));
    s.once('connect', () => { s.destroy(); resolve(true); });
    s.connect(port, 'localhost');
  });
};

const killProcessOnPort = (port) => {
  return new Promise((resolve) => {
    exec(`lsof -t -i :${port}`, (err, stdout) => {
      if (!stdout || !stdout.trim()) {
        resolve();
        return;
      }
      const pids = stdout.trim().split(/\s+/).filter(Boolean);
      if (pids.length > 0) {
        exec(`kill -9 ${pids.join(' ')}`, () => resolve());
      } else {
        resolve();
      }
    });
  });
};

const scriptMap = {
  'local_api_server': { file: 'local_api_server.py', port: 8001 },
  'youtube_comment_server': { file: 'youtube_comment_server.py', port: 8768 },
  'tiktok_comment_server': { file: 'tiktok_comment_server.py', port: 8767 }
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

      if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.end();
        return;
      }
      // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲
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
            res.end(JSON.stringify({ logs: serverLogs[serverName] || [] }));
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
              await killProcessOnPort(config.port);
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
    host: 'localhost',
    port: 8443,
    strictPort: true,
    hmr: false, // 配信中の勝手な画面強制リロード・エラーオーバーレイを完全防止
    watch: {
      ignored: ['**'] // ファイル監視を完全無効化し、配信画面へのエラーポップアップ通知を根絶
    },
    proxy: {
      '^/(api|news_script|log|update_hiragana_data|radio_script|radio_script_yomi|radio_script_config|custom_idle_phrases|hiragana_data|se_list|add_idle_phrase|convert_remaining_kanji|fetch_rss|get_youtube_video_info)': {
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
