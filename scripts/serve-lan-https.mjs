import { createServer } from 'node:https';
import { readFile } from 'node:fs/promises';
import { isIP } from 'node:net';
import { extname, relative, resolve } from 'node:path';

const [host, portText, certPath, keyPath] = process.argv.slice(2);
const port = Number(portText);
if (isIP(host) !== 4 || !Number.isInteger(port) || port < 1024 || port > 65535 || !certPath || !keyPath) {
  throw new Error('用法：node scripts/serve-lan-https.mjs <局域网 IPv4> <端口> <证书.crt> <私钥.key>');
}
const dist = resolve('dist');
const [cert, key] = await Promise.all([readFile(certPath), readFile(keyPath)]);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const server = createServer({ cert, key }, async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url ?? '/', `https://${host}:${port}`).pathname);
    const file = resolve(dist, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (relative(dist, file).startsWith('..')) { response.writeHead(403).end(); return; }
    const content = await readFile(file);
    response.setHeader('Content-Type', mime[extname(file)] ?? 'application/octet-stream');
    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.end(content);
  } catch { response.writeHead(404).end('Not found'); }
});
server.listen(port, host, () => { console.log(`临时 HTTPS 静态入口：https://${host}:${port}/`); });
