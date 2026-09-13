import { createServer } from 'node:http';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { build } from 'vite';

const chrome = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const webPort = 4178;
const debugPort = 9228;
const temporaryRoot = await mkdtemp(join(tmpdir(), 'asset-usage-e2e-'));
const site = join(temporaryRoot, 'site');
const profile = join(temporaryRoot, 'profile');
const delay = milliseconds => new Promise(resolveDelay => setTimeout(resolveDelay, milliseconds));
await mkdir(profile);
await build({ logLevel: 'silent', build: { outDir: site, emptyOutDir: true, rollupOptions: { input: [resolve('index.html'), resolve('tests/e2e/usage.html')] } } });
const contentTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url ?? '/', `http://127.0.0.1:${webPort}`).pathname;
    const file = join(site, pathname === '/' ? 'index.html' : pathname);
    response.setHeader('Content-Type', contentTypes[extname(file)] ?? 'application/octet-stream');
    response.end(await readFile(file));
  } catch { response.statusCode = 404; response.end('Not found'); }
});
await new Promise((resolveListen, reject) => { server.once('error', reject); server.listen(webPort, '127.0.0.1', resolveListen); });

const pageUrl = parameters => `http://127.0.0.1:${webPort}/tests/e2e/usage.html?${parameters}`;
async function createPage(url) {
  const response = await fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
  if (!response.ok) throw new Error(`创建 Chrome 标签失败：${response.status}`);
  return response.json();
}
async function evaluate(target, expression) {
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolveOpen, reject) => { socket.addEventListener('open', resolveOpen, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  const response = await new Promise(resolveEvaluation => {
    socket.addEventListener('message', event => { const message = JSON.parse(event.data); if (message.id === 1) resolveEvaluation(message); });
    socket.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression, returnByValue: true } }));
  });
  socket.close();
  return response.result?.result?.value;
}
async function waitForResult(target) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const state = await evaluate(target, 'JSON.stringify({ result: document.documentElement.dataset.result || "pending", assetId: document.documentElement.dataset.assetId || "", detail: document.querySelector("#result")?.textContent || "" })');
    if (typeof state !== 'string') { await delay(100); continue; }
    const parsed = JSON.parse(state);
    if (parsed.result === 'passed') return parsed;
    if (parsed.result === 'failed') throw new Error(parsed.detail);
    await delay(100);
  }
  throw new Error('Chrome 页面测试超时');
}

let browser;
try {
  const databaseName = `usage-browser-${crypto.randomUUID()}`;
  const setupUrl = pageUrl(new URLSearchParams({ role: 'setup', database: databaseName }));
  browser = spawn(chrome, ['--headless=new', '--disable-gpu', '--disable-background-networking', '--no-first-run', '--no-proxy-server', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, setupUrl], { stdio: 'ignore' });
  let setupTarget;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const targets = await fetch(`http://127.0.0.1:${debugPort}/json/list`).then(response => response.json());
      setupTarget = targets.find(item => item.type === 'page' && item.url.includes('role=setup'));
      if (setupTarget) break;
    } catch { /* Chrome is starting */ }
    await delay(100);
  }
  if (!setupTarget) throw new Error('无法连接 Chrome DevTools 测试页面');
  const setup = await waitForResult(setupTarget);
  const incrementUrl = pageUrl(new URLSearchParams({ role: 'increment', database: databaseName, asset: setup.assetId }));
  const incrementTargets = await Promise.all([createPage(incrementUrl), createPage(incrementUrl)]);
  await Promise.all(incrementTargets.map(waitForResult));
  const verifyTarget = await createPage(pageUrl(new URLSearchParams({ role: 'verify', database: databaseName, asset: setup.assetId })));
  await waitForResult(verifyTarget);

  const appSetupTarget = await createPage(pageUrl(new URLSearchParams({ role: 'setup', database: 'large-asset-cost' })));
  await waitForResult(appSetupTarget);
  const appTarget = await createPage(`http://127.0.0.1:${webPort}/`);
  let buttonReady = false;
  for (let attempt = 0; attempt < 100 && !buttonReady; attempt += 1) {
    buttonReady = await evaluate(appTarget, '[...document.querySelectorAll("button")].some(button => button.textContent?.includes("+ 使用一次"))');
    if (!buttonReady) await delay(100);
  }
  if (!buttonReady) throw new Error('首页未显示 + 使用一次按钮');
  const pathBefore = await evaluate(appTarget, 'location.pathname');
  await evaluate(appTarget, '[...document.querySelectorAll("button")].find(button => button.textContent?.includes("+ 使用一次"))?.click()');
  let appState;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    appState = JSON.parse(await evaluate(appTarget, 'JSON.stringify({ path: location.pathname, body: document.body.innerText })'));
    if (appState.body.includes('累计 1 次') && appState.body.includes('已记录 1 次')) break;
    await delay(100);
  }
  if (appState.path !== pathBefore) throw new Error('点击卡片 +1 后发生了页面跳转');
  if (!appState.body.includes('累计 1 次') || !appState.body.includes('已记录 1 次')) throw new Error('首页 +1 后次数或成功反馈未更新');
  console.log('PASS: 真实浏览器两个同源标签各 +1 后次数为 2，首页 +1 不跳页并即时更新');
} finally {
  browser?.kill('SIGTERM');
  await new Promise(resolveClose => server.close(resolveClose));
  await delay(500);
  await rm(temporaryRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
