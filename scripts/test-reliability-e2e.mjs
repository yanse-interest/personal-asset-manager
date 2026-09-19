import { testPorts } from './test-ports.mjs';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { spawn } from 'node:child_process';
import { build } from 'vite';

const chrome = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const [webPort, debugPort] = await testPorts();
const root = await mkdtemp(join(tmpdir(), 'asset-reliability-e2e-'));
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

async function faultPage(source, hash = '#/') {
  const session = await openSession(await getPage('about:blank'));
  await session.send('Page.enable');
  await session.send('Page.addScriptToEvaluateOnNewDocument', { source });
  await session.send('Page.navigate', { url: `${baseUrl}${hash}` });
  return session;
}
// Native IndexedDB is used only against this test's temporary Chrome profile.
const readAssets = `new Promise((resolve, reject) => { const request = indexedDB.open('large-asset-cost'); request.onerror = () => reject(request.error); request.onsuccess = () => { const db = request.result; const tx = db.transaction('assets'); const read = tx.objectStore('assets').getAll(); read.onsuccess = () => resolve(read.result); tx.oncomplete = () => db.close(); }; })`;
let browser;
const sessions = [];
try {
  browser = await startChrome();
  const invalid = await faultPage(`localStorage.setItem('jiuyong-theme', 'invalid-theme'); localStorage.setItem('jiuyong-mode', 'invalid-mode');`);
  sessions.push(invalid);
  await waitFor(invalid, 'document.body.innerText.includes("好物总览")', '无效外观配置仍可启动');
  if (!await invalid.evaluate('document.documentElement.dataset.theme === "lime" && document.documentElement.dataset.mode === "light"')) throw new Error('无效外观配置未回退默认值');
  const unavailable = await faultPage(`Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Denied', 'SecurityError'); } });`, '#/settings');
  sessions.push(unavailable);
  await waitFor(unavailable, 'document.body.innerText.includes("清透蓝")', '外观存储不可用仍可打开设置');
  await unavailable.evaluate('[...document.querySelectorAll(".theme-options button")].find(button => button.textContent.includes("清透蓝")).click()');
  await waitFor(unavailable, 'document.documentElement.dataset.theme === "blue"', '不可持久化时仍可切换外观');
  await unavailable.evaluate('[...document.querySelectorAll(".mode-options button")].find(button => button.textContent.includes("深色")).click()');
  await waitFor(unavailable, 'document.documentElement.dataset.mode === "dark"', '不可持久化时仍可切换深色模式');
  const darkPalette = await unavailable.evaluate(`(() => {
    const root = getComputedStyle(document.documentElement);
    return { color: root.color, background: root.backgroundColor, accent: root.getPropertyValue('--accent').trim(), glow: root.getPropertyValue('--glow').trim() };
  })()`);
  if (darkPalette.color !== 'rgb(244, 244, 241)' || darkPalette.background !== 'rgb(18, 19, 16)') throw new Error(`深色模式根节点颜色未生效：${JSON.stringify(darkPalette)}`);
  if (darkPalette.accent !== '#a9c1ff' || darkPalette.glow !== '#32477d') throw new Error(`深色模式未保留所选主题：${JSON.stringify(darkPalette)}`);
  const denied = await faultPage(`indexedDB.open = () => { throw new DOMException('Denied', 'SecurityError'); };`);
  sessions.push(denied);
  await waitFor(denied, 'document.body.innerText.includes("无法打开本地数据库")', '数据库启动失败可恢复提示');
  if (await denied.evaluate('Boolean(document.querySelector("form"))')) throw new Error('数据库不可用仍允许写入表单');

  const app = await openSession(await getPage(baseUrl)); sessions.push(app);
  async function createAsset(name) {
    await app.evaluate('location.hash = "#/assets/new"');
    await waitFor(app, `Boolean(${labelInput('名称')})`, '新增表单');
    await typeInto(app, '名称', name); await typeInto(app, '购买金额', '100');
    await app.evaluate('[...document.querySelectorAll("label")].find(label => label.textContent.includes("按次"))?.querySelector("input")?.click()');
    // Two synchronous submissions exercise the ref guard before React has rendered disabled.
    await app.evaluate('document.querySelector("form").requestSubmit(); document.querySelector("form").requestSubmit()');
    await waitFor(app, 'location.hash.startsWith("#/assets/") && !location.hash.includes("new")', '新增完成');
    return app.evaluate('location.hash');
  }
  const first = await createAsset('审查资产甲'); const second = await createAsset('审查资产乙');
  if ((await app.evaluate(readAssets)).length !== 2) throw new Error('重复提交造成重复资产');
  await app.evaluate(`location.hash = ${JSON.stringify(`${first}/edit`)}`);
  await waitFor(app, `(${labelInput('名称')})?.value === '审查资产甲'`, '加载第一件编辑');
  await app.evaluate(`location.hash = ${JSON.stringify(`${second}/edit`)}`);
  await waitFor(app, `(${labelInput('名称')})?.value === '审查资产乙'`, '同组件切换资产重置草稿');
  await typeInto(app, '名称', '不可丢失草稿');
  await app.evaluate('document.querySelector("a.brand").click()');
  await waitFor(app, 'document.body.innerText.includes("放弃未保存修改")', '导航保护草稿');
  await clickText(app, '取消');
  await waitFor(app, `(${labelInput('名称')})?.value === '不可丢失草稿'`, '取消离开保留草稿');
  await app.evaluate('document.querySelector("form").requestSubmit()');
  await waitFor(app, `location.hash === ${JSON.stringify(second)}`, '草稿正常保存');
  const failedRead = await faultPage(`const get = IDBObjectStore.prototype.get; IDBObjectStore.prototype.get = function (...args) { if (this.name === 'assets') throw new DOMException('Read failed', 'UnknownError'); return get.apply(this, args); };`, `${first}/edit`);
  sessions.push(failedRead);
  await waitFor(failedRead, 'document.body.innerText.includes("无法读取好物")', '编辑读取失败提示');
  if (await failedRead.evaluate('Boolean(document.querySelector("form"))')) throw new Error('读取失败仍提供可新增的编辑表单');

  await app.evaluate(`location.hash = ${JSON.stringify(first)}`);
  await waitFor(app, 'document.body.innerText.includes("更正次数")', '次数更正入口');
  await clickText(app, '更正次数'); await typeInto(app, '累计使用次数', '8');
  const concurrent = await openSession(await getPage(`${baseUrl}${first}`)); sessions.push(concurrent);
  await waitFor(concurrent, 'document.body.innerText.includes("+ 使用一次")', '第二标签详情');
  await clickText(concurrent, '+ 使用一次');
  await waitFor(app, 'document.body.innerText.includes("累计 1 次")', '跨标签次数实时更新');
  await clickText(app, '保存更正');
  await waitFor(app, 'Boolean(document.querySelector("#usage-correction-error"))', '旧更正快照拒绝覆盖新次数');
  if ((await app.evaluate(readAssets)).find(asset => first.includes(asset.id)).usageCount !== 1) throw new Error('旧草稿覆盖了另一标签使用次数');
  await clickText(app, '取消');
  await app.evaluate('location.hash = "#/stats"');
  await waitFor(app, 'Boolean(document.querySelector(".distribution-row")) && Boolean(document.querySelector(".category-insights a"))', '丰富统计');
  if (!await app.evaluate('[...document.querySelectorAll(".distribution-row")].some(row => row.textContent.includes("未分类") && row.querySelector("strong")?.textContent === "2")')) throw new Error('分类分布遗漏未分类资产');
  if (!await app.evaluate('document.body.innerText.includes("投入概览") && document.body.innerText.includes("陪伴与使用") && document.body.innerText.includes("当前低成本代表")')) throw new Error('统计页缺少投入、陪伴或成本指标');
  if (!await app.evaluate('document.querySelector(".category-insights a")?.textContent.includes("陪伴最久") && document.querySelector(".category-insights a")?.textContent.includes("天")')) throw new Error('分类洞察缺少陪伴最久好物');
  await app.evaluate('location.hash = "#/assets/new"');
  await waitFor(app, `Boolean(${labelInput('名称')})`, '写入异常表单');
  await typeInto(app, '名称', '保存失败后重试'); await typeInto(app, '购买金额', '99');
  await app.evaluate(`window.originalAdd = IDBObjectStore.prototype.add; IDBObjectStore.prototype.add = function (...args) { if (this.name === 'assets') throw new DOMException('模拟存储空间不足', 'QuotaExceededError'); return window.originalAdd.apply(this, args); }; document.querySelector('form').requestSubmit();`);
  await waitFor(app, 'document.body.innerText.includes("模拟存储空间不足")', '保存失败可读提示');
  if (await app.evaluate(`(${labelInput('名称')})?.value`) !== '保存失败后重试' || (await app.evaluate(readAssets)).length !== 2) throw new Error('失败保存丢失草稿或写入残留');
  await app.evaluate('IDBObjectStore.prototype.add = window.originalAdd');
  await app.evaluate(`new Promise((resolve, reject) => { const request = indexedDB.open('large-asset-cost'); request.onerror = () => reject(request.error); request.onsuccess = () => { const db = request.result; const tx = db.transaction(['assets', 'categories', 'costRecords', 'revenueRecords'], 'readwrite'); const store = tx.objectStore('assets'); window.releaseTestWrite = false; const deadline = Date.now() + 10000; const loop = () => { if (!window.releaseTestWrite && Date.now() < deadline) store.get('__test_lock__').onsuccess = loop; }; store.get('__test_lock__').onsuccess = () => { loop(); resolve(true); }; tx.oncomplete = () => db.close(); }; })`);
  await app.evaluate('document.querySelector("form").requestSubmit(); document.querySelector("form").requestSubmit(); document.querySelector("a.brand").click()');
  await waitFor(app, 'document.body.innerText.includes("正在保存") && Boolean(document.querySelector("[role=dialog]"))', '事务提交中禁止离开');
  await app.evaluate('window.releaseTestWrite = true');
  await waitFor(app, 'location.hash.startsWith("#/assets/") && !location.hash.includes("new") && document.body.innerText.includes("保存失败后重试")', '事务完成后正常导航');
  if ((await app.evaluate(readAssets)).length !== 3) throw new Error('写入等待期间重复提交了资产');
  for (const width of [320, 375, 390, 430]) {
    await app.send('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: true });
    for (const hash of ['#/', '#/categories', '#/stats', '#/settings', first, `${first}/edit`]) {
      await app.evaluate(`location.hash = ${JSON.stringify(hash)}`);
      const heading = ({ '#/': '好物', '#/categories': '分类', '#/stats': '使用统计', '#/settings': '设置与数据', [first]: '审查资产甲', [`${first}/edit`]: '编辑好物' })[hash];
      await waitFor(app, `document.querySelector('h1')?.textContent === ${JSON.stringify(heading)} && !document.body.innerText.includes('正在加载')`, `${width}px ${hash}`);
      if (await app.evaluate('document.documentElement.scrollWidth > innerWidth + 1')) throw new Error(`${width}px ${hash} 页面横向溢出`);
    }
  }
  await app.evaluate('location.hash = "#/invalid-path"');
  await waitFor(app, 'document.body.innerText.includes("页面不存在")', '404 页面');
  if (await app.evaluate('document.body.innerText.includes("后续阶段实现")')) throw new Error('404 仍使用开发占位');
  await app.evaluate(`window.originalBigInt = BigInt; window.BigInt = () => { throw new Error('模拟渲染异常'); }; document.querySelector('a.brand').click();`);
  await waitFor(app, 'document.body.innerText.includes("这个页面暂时无法显示")', '页面错误边界');
  await app.evaluate('window.BigInt = window.originalBigInt');
  await clickText(app, '设置与备份');
  await waitFor(app, 'document.body.innerText.includes("导出全部数据")', '渲染异常后仍可进入备份');
  console.log('PASS: 外观异常容错、数据库/编辑读取失败、重复提交、同组件切换、草稿导航保护、跨标签次数冲突、写入失败重试与提交中离开保护、未分类统计、320/375/390/430px 主页面、渲染错误恢复');
} finally {
  for (const session of sessions) session.close();
  browser?.kill('SIGTERM');
  await new Promise(done => server.close(done));
  await delay(700);
  await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
