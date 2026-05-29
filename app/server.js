const http = require('http');
const fs = require('fs');
const path = require('path');

const port = Number(process.env.PORT || 8080);
const appEnv = process.env.APP_ENV || 'local';
const appVersion = process.env.APP_VERSION || 'dev';
const message = process.env.MESSAGE || 'Welcome to OpenShift Lifecycle Quest!';
const publicDir = path.join(__dirname, 'public');

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  });
  res.end(body);
}

function safeStaticPath(urlPath) {
  const requested = urlPath === '/' ? '/index.html' : urlPath;
  const decoded = decodeURIComponent(requested.split('?')[0]);
  const fullPath = path.normalize(path.join(publicDir, decoded));
  if (!fullPath.startsWith(publicDir)) return null;
  return fullPath;
}

const server = http.createServer((req, res) => {
  if (req.url === '/healthz') {
    return sendJson(res, 200, { status: 'ok', env: appEnv, version: appVersion });
  }

  if (req.url === '/api/info') {
    return sendJson(res, 200, {
      name: 'OpenShift Lifecycle Quest',
      environment: appEnv,
      version: appVersion,
      message,
      hostname: process.env.HOSTNAME || 'unknown',
      timestamp: new Date().toISOString()
    });
  }

  const filePath = safeStaticPath(req.url || '/');
  if (!filePath) return sendJson(res, 403, { error: 'Forbidden' });

  fs.readFile(filePath, (err, data) => {
    if (err) return sendJson(res, 404, { error: 'Not found' });
    const ext = path.extname(filePath);
    res.writeHead(200, {
      'content-type': contentTypes[ext] || 'application/octet-stream',
      'x-content-type-options': 'nosniff'
    });
    res.end(data);
  });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Lifecycle Quest listening on ${port} in ${appEnv} with version ${appVersion}`);
});

module.exports = { server, safeStaticPath };
