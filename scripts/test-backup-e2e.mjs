import { createServer } from 'node:http';
import { mkdtemp, mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { build } from 'vite';

const chrome = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const webPort = 4180;
const debugPort = 9230;
const root = await mkdtemp(join(tmpdir(), 'asset-backup-e2e-'));
const site = join(root, 'site');
const profile = join(root, 'profile');
const downloads = join(root, 'downloads');
const delay = milliseconds => new Promise(done => setTimeout(done, milliseconds));
await mkdir(profile); await mkdir(downloads);
await build({ logLevel: 'silent', build: { outDir: site, emptyOutDir: true, rollupOptions: { input: [resolve('index.html'), resolve('tests/e2e/backup.html')] } } });
const contentTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const server = createServer(async (request, response) => {
  try {
    const path = new URL(request.url ?? '/', `http://127.0.0.1:${webPort}`).pathname;
    const file = join(site, path === '/' ? 'index.html' : path);
    response.setHeader('Content-Type', contentTypes[extname(file)] ?? 'application/octet-stream');
    response.end(await readFile(file));
  } catch { response.statusCode = 404; response.end('Not found'); }
});
await new Promise((done, reject) => { server.once('error', reject); server.listen(webPort, '127.0.0.1', done); });
const fixtureUrl = role => `http://127.0.0.1:${webPort}/tests/e2e/backup.html?role=${role}`;
async function newPage(url) {
  const response = await fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
  if (!response.ok) throw new Error(`创建 Chrome 标签失败：${response.status}`);
  return response.json();
}
async function openSession(target) {
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((done, reject) => { socket.addEventListener('open', done, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  let nextId = 1;
  const pending = new Map();
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    const done = pending.get(message.id);
    if (done) { pending.delete(message.id); done(message); }
  });
  const send = (method, params = {}) => new Promise((done, reject) => {
    if (socket.readyState !== WebSocket.OPEN) { reject(new Error('Chrome DevTools 连接已关闭')); return; }
    const id = nextId++; pending.set(id, message => message.error ? reject(new Error(message.error.message)) : done(message.result));
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => (await send('Runtime.evaluate', { expression, returnByValue: true }))?.result?.value;
  return { send, evaluate, close: () => socket.close() };
}
async function waitFor(session, expression, label) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await session.evaluate(expression)) return;
    await delay(100);
  }
  throw new Error(`${label} 超时`);
}
async function fixture(role) {
  const session = await openSession(await newPage(fixtureUrl(role)));
  try {
    await waitFor(session, 'document.documentElement.dataset.result === "passed" || document.documentElement.dataset.result === "failed"', `fixture ${role}`);
    const state = await session.evaluate('JSON.stringify({ status: document.documentElement.dataset.result, detail: document.querySelector("#result")?.textContent })');
    const parsed = JSON.parse(state);
    if (parsed.status !== 'passed') throw new Error(`fixture ${role}: ${parsed.detail}`);
  } finally { session.close(); }
}
let browser;
try {
  browser = spawn(chrome, ['--headless=new', '--disable-gpu', '--disable-background-networking', '--no-first-run', '--no-proxy-server', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try { ready = (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).ok; if (ready) break; } catch { /* starting */ }
    await delay(100);
  }
  if (!ready) throw new Error('Chrome DevTools 未启动');
  await fixture('setup');
  const app = await openSession(await newPage(`http://127.0.0.1:${webPort}/#/settings`));
  try {
    await app.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
    await waitFor(app, 'document.body.innerText.includes("导出全部数据")', '设置页');
    await app.evaluate('[...document.querySelectorAll("button")].find(button => button.textContent === "导出全部数据")?.click()');
    let downloaded;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      downloaded = (await readdir(downloads)).find(name => /^asset-cost-backup-\d{8}-\d{6}\.json$/.test(name));
      if (downloaded) break;
      await delay(100);
    }
    if (!downloaded) throw new Error('浏览器没有保存 JSON 文件');
    const backupPath = join(downloads, downloaded);
    const saved = JSON.parse(await readFile(backupPath, 'utf8'));
    if (saved.assets?.length !== 1 || saved.costRecords?.length !== 1 || saved.revenueRecords?.length !== 1) throw new Error('下载文件缺少三表记录');
    await fixture('mutate');
    async function chooseDownloadedFile() {
      const documentNode = await app.send('DOM.getDocument');
      const input = await app.send('DOM.querySelector', { nodeId: documentNode.root.nodeId, selector: 'input[type=file]' });
      if (!input.nodeId) throw new Error('设置页未找到导入文件选择框');
      await app.send('DOM.setFileInputFiles', { nodeId: input.nodeId, files: [backupPath] });
      await waitFor(app, 'document.body.innerText.includes("备份预览")', '备份预览');
    }
    await chooseDownloadedFile();
    await app.evaluate('[...document.querySelectorAll("button")].find(button => button.textContent === "取消导入")?.click()');
    await fixture('mutated');
    await chooseDownloadedFile();
    await app.evaluate('[...document.querySelectorAll("button")].find(button => button.textContent?.includes("覆盖当前数据"))?.click()');
    await waitFor(app, 'document.body.innerText.includes("覆盖全部本地数据？")', '覆盖确认');
    await app.evaluate('[...document.querySelectorAll("button")].find(button => button.textContent === "确认替换")?.click()');
    await waitFor(app, 'location.hash === "#/"', '导入完成并返回首页');
    await fixture('verify');
    console.log('PASS: Chrome 实际下载 JSON、取消预览无写入、重新选择文件并恢复三表全字段');
  } finally { app.close(); }
} finally {
  browser?.kill('SIGTERM');
  await new Promise(done => server.close(done));
  await delay(500);
  await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
