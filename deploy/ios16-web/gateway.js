const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 8088);
const STATIC_ROOT = process.env.STATIC_ROOT || __dirname;
const HUB_ORIGIN = process.env.HUB_ORIGIN || 'http://127.0.0.1:3006';
const hub = new URL(HUB_ORIGIN);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

function isIOS162(ua) {
  const source = String(ua || '');
  const isAppleWebKit = /AppleWebKit/i.test(source);
  const isMobileApple = /(Mobile|iP(hone|ad|od))/i.test(source);
  const byOsToken = /OS 16_2(?:_|\b)/i.test(source);
  const byVersionToken = /Version\/16\.2/i.test(source) && isAppleWebKit && isMobileApple;
  return byOsToken || byVersionToken;
}

function shouldProxy(pathname) {
  return pathname === '/api' || pathname.startsWith('/api/') ||
         pathname === '/cli' || pathname.startsWith('/cli/') ||
         pathname === '/socket.io' || pathname.startsWith('/socket.io/') ||
         pathname === '/health';
}

function proxyRequest(req, res) {
  const targetPath = req.url || '/';
  const options = {
    protocol: hub.protocol,
    hostname: hub.hostname,
    port: hub.port,
    method: req.method,
    path: targetPath,
    headers: {
      ...req.headers,
      host: hub.host,
      connection: 'close',
    },
  };

  const proxy = http.request(options, (upstream) => {
    res.writeHead(upstream.statusCode || 502, upstream.headers);
    upstream.pipe(res);
  });

  proxy.on('error', (err) => {
    res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(`Bad Gateway: ${err.message}`);
  });

  req.pipe(proxy);
}

function safeJoin(root, requestPath) {
  const normalized = path.normalize(requestPath).replace(/^\/+/, '');
  const full = path.join(root, normalized);
  if (!full.startsWith(path.resolve(root))) {
    return null;
  }
  return full;
}

function serveStatic(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Method Not Allowed');
    return;
  }

  const parsed = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  let pathname = decodeURIComponent(parsed.pathname);
  if (pathname === '/') pathname = '/index.html';

  let filePath = safeJoin(STATIC_ROOT, pathname);
  if (!filePath) {
    res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Bad Request');
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      // SPA fallback
      filePath = path.join(STATIC_ROOT, 'index.html');
    }

    fs.readFile(filePath, (readErr, data) => {
      if (readErr) {
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('Not Found');
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME[ext] || 'application/octet-stream';
      const userAgent = req.headers['user-agent'] || '';
      const forceNoStore = isIOS162(userAgent) && (
        ext === '.js' ||
        ext === '.css' ||
        ext === '.webmanifest' ||
        path.basename(filePath) === 'sw.js'
      );
      const cacheControl = (ext === '.html' || forceNoStore)
        ? 'no-store, no-cache, must-revalidate'
        : 'public, max-age=3600';
      res.writeHead(200, {
        'content-type': contentType,
        'cache-control': cacheControl,
      });
      if (req.method === 'HEAD') {
        res.end();
      } else {
        res.end(data);
      }
    });
  });
}

const server = http.createServer((req, res) => {
  const parsed = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (shouldProxy(parsed.pathname)) {
    proxyRequest(req, res);
    return;
  }
  serveStatic(req, res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[gateway] listening on 0.0.0.0:${PORT}`);
  console.log(`[gateway] static root: ${STATIC_ROOT}`);
  console.log(`[gateway] proxy hub: ${HUB_ORIGIN}`);
});
