import { testPorts } from './test-ports.mjs';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { spawn } from 'node:child_process';
import { build } from 'vite';

const chrome = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const [webPort, debugPort] = await testPorts();
const root = await mkdtemp(join(tmpdir(), 'asset-daily-cost-e2e-'));
const site = join(root, 'site'); const profile = join(root, 'profile');
const delay = milliseconds => new Promise(done => setTimeout(done, milliseconds));
await mkdir(profile);
await build({ logLevel: 'silent', build: { outDir: site } });
const baseUrl = `http://127.0.0.1:${webPort}/`;
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const server = createServer(async (request, response) => {
  try {
    const path = new URL(request.url ?? '/', baseUrl).pathname;
    const file = join(site, path === '/' ? 'index.html' : path);
    response.setHeader('Content-Type', mime[extname(file)] ?? 'application/octet-stream');
    if (path === '/' || path === '/index.html' || path === '/sw.js' || path === '/manifest.webmanifest') response.setHeader('Cache-Control', 'no-cache');
    response.end(await readFile(file));
  } catch { response.statusCode = 404; response.end('Not found'); }
});
await new Promise((done, reject) => { server.once('error', reject); server.listen(webPort, '127.0.0.1', done); });
async function getPage(url) {
  const response = await fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
  if (!response.ok) throw new Error(`Chrome page ${response.status}`);
  return response.json();
}
async function openSession(target) {
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((done, reject) => { socket.addEventListener('open', done, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  let nextId = 1; const pending = new Map();
  socket.addEventListener('message', event => { const message = JSON.parse(event.data); const done = pending.get(message.id); if (done) { pending.delete(message.id); done(message); } });
  const send = (method, params = {}) => new Promise((done, reject) => {
    const id = nextId++; pending.set(id, message => message.error ? reject(new Error(message.error.message)) : done(message.result));
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    return result.result?.value;
  };
  return { send, evaluate, close: () => socket.close() };
}
async function waitFor(session, expression, label) {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    if (await session.evaluate(expression)) return;
    await delay(100);
  }
  throw new Error(`${label} 超时；页面：${String(await session.evaluate('document.body?.innerText?.slice(0,500)'))}`);
}
const labelInput = label => `[...document.querySelectorAll('label')].find(item => item.textContent?.startsWith(${JSON.stringify(label)}))?.querySelector('input')`;
async function typeInto(session, label, value) {
  const selector = labelInput(label);
  const found = await session.evaluate(`Boolean(${selector})`);
  if (!found) throw new Error(`找不到输入框：${label}`);
  await session.evaluate(`(${selector}).focus(); (${selector}).select()`);
  await session.send('Input.insertText', { text: value });
}
async function clickText(session, text) {
  const clicked = await session.evaluate(`(() => { const element = [...document.querySelectorAll('button,a')].find(item => item.textContent?.trim() === ${JSON.stringify(text)}); if (!element) return false; element.click(); return true; })()`);
  if (!clicked) throw new Error(`找不到操作：${text}`);
}
async function startChrome(url = 'about:blank') {
  const browser = spawn(chrome, ['--headless=new', '--disable-gpu', '--disable-background-networking', '--no-first-run', '--no-proxy-server', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, url], { stdio: 'ignore' });
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try { if ((await fetch(`http://127.0.0.1:${debugPort}/json/list`)).ok) return browser; } catch { /* starting */ }
    await delay(100);
  }
  throw new Error('Chrome DevTools 未启动');
}

// This profile and origin are temporary; the user's browser data is never opened.
let browser;
let app;
try {
  browser = await startChrome();
  app = await openSession(await getPage('about:blank'));
  await app.send('Page.enable');
  await app.send('Page.addScriptToEvaluateOnNewDocument', { source: `const NativeDate = Date; window.Date = class extends NativeDate { constructor(...args) { super(...(args.length ? args : ['2026-10-09T12:00:00Z'])); } static now() { return new NativeDate('2026-10-09T12:00:00Z').getTime(); } };` });
  await app.send('Page.navigate', { url: baseUrl });
  await waitFor(app, 'document.body.innerText.includes("好物总览")', '首页启动');
  await app.evaluate(`new Promise((resolve, reject) => {
    const request = indexedDB.open('large-asset-cost');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('assets', 'readwrite');
      const base = { id: '11111111-1111-4111-8111-111111111111', name: '房租', purchaseCostCents: 3360000, purchaseDate: '2026-10-01', serviceStartDate: '2026-10-01', expiryDate: '2027-09-30', lifecycleStatus: 'active', endedDate: null, costMode: 'day', usageCount: 0, categoryId: null, iconId: null, note: null, createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' };
      const assets = [base,
        { ...base, id: crypto.randomUUID(), name: '持续使用', purchaseCostCents: 900, expiryDate: null },
        { ...base, id: '22222222-2222-4222-8222-222222222222', name: '已到期房租', expiryDate: '2026-10-08' },
        { ...base, id: crypto.randomUUID(), name: '尚未开始', serviceStartDate: '2026-10-10' },
        { ...base, id: crypto.randomUUID(), name: '待服役', lifecycleStatus: 'pending', serviceStartDate: null },
        { ...base, id: crypto.randomUUID(), name: '已退役', lifecycleStatus: 'retired', endedDate: '2026-10-08' },
        { ...base, id: crypto.randomUUID(), name: '已卖出', lifecycleStatus: 'sold', endedDate: '2026-10-08' },
        { ...base, id: crypto.randomUUID(), name: '按次', costMode: 'use', usageCount: 3 }];
      for (const asset of assets) tx.objectStore('assets').add(asset);
      tx.oncomplete = () => { db.close(); resolve(true); };
      tx.onerror = () => reject(tx.error);
    };
  })`);
  await app.send('Page.reload');
  await waitFor(app, 'document.querySelector(".daily-cost-summary")?.innerText.includes("¥93.05")', '一年租金和开放期间合计');
  if (!await app.evaluate('document.querySelector(".daily-cost-summary").innerText.includes("共 2 件")')) throw new Error('首页计入了期间外或非按天费用');
  await app.evaluate('location.hash = "#/assets/11111111-1111-4111-8111-111111111111/edit"');
  await waitFor(app, `(${labelInput('名称')})?.value === '房租'`, '房租编辑');
  await app.evaluate(`(() => { const input = ${labelInput('到期日期')}; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '2028-09-30'); input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await app.evaluate('document.querySelector("form").requestSubmit()');
  await waitFor(app, 'location.hash === "#/assets/11111111-1111-4111-8111-111111111111" && document.querySelector(".hero-metric")?.innerText.includes("¥45.96")', '两年租金保存后重新分摊');
  if (!await app.evaluate('document.querySelector(".hero-metric").innerText.includes("共 731 天") && document.body.innerText.includes("2028-09-30")')) throw new Error('详情未显示完整分摊期间');
  await app.evaluate('location.hash = "#/"');
  await waitFor(app, 'document.querySelector(".daily-cost-summary")?.innerText.includes("¥46.96")', '首页两年租金合计');
  await app.evaluate('location.hash = "#/stats"');
  await waitFor(app, 'document.querySelector(".stats-metric-grid")?.innerText.includes("¥46.96")', '统计今日成本');
  if (!await app.evaluate('document.body.innerText.includes("共 2 件")')) throw new Error('统计今日费用件数错误');
  await app.evaluate('location.hash = "#/assets/22222222-2222-4222-8222-222222222222"');
  await waitFor(app, 'document.querySelector("h1")?.textContent === "已到期房租"', '到期费用详情');
  if (!await app.evaluate('document.body.innerText.includes("不计入今日使用成本")')) throw new Error('到期费用详情缺少日期归属说明');
  for (const width of [320, 390]) {
    await app.send('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: true });
    if (await app.evaluate('document.documentElement.scrollWidth > innerWidth + 1')) throw new Error(`${width}px 日期期间详情横向溢出`);
  }
  console.log('PASS: 修改房租为两年后详情 ¥45.96/天（731天），首页与统计 ¥46.96；只计入今天的两件按天费用，期间外/非按天费用排除。');
} finally {
  app?.close();
  browser?.kill('SIGTERM');
  await new Promise(done => server.close(done));
  await delay(700);
  await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
