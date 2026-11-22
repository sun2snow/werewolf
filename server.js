const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const port = Number(process.env.PORT) || 5173;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function assetPath(url, offline = false) {
  const pathname = decodeURIComponent(new URL(url, 'http://localhost').pathname);
  if (pathname.includes('\0')) throw new Error('invalid path');
  const asset = path.posix.normalize(pathname.endsWith('/') ? `${pathname}index.html` : pathname);
  if (offline && asset === '/js/config.js') return path.join(root, 'examples', 'config.js');
  return /^\/(?:(?:index|rules|demo)\.html|styles\.css|(?:js|vendor|supabase\/functions\/_shared)\/[\w.-]+\.(?:js|css)|supabase\/functions\/game\/[\w.-]+\.mjs)$/.test(asset)
    ? path.join(root, asset) : null;
}

const offline = process.argv.includes('--offline');
const server = http.createServer((req, res) => {
  let filePath;
  try {
    filePath = assetPath(req.url, offline);
  } catch {
    res.writeHead(400);
    res.end('Bad Request');
    return;
  }
  if (!filePath) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }
    const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  });
});

module.exports = { assetPath };
if (require.main === module) server.listen(port, () => {
  console.log(`狼人杀${offline ? '离线' : '本地'}预览: http://localhost:${port}`);
});
