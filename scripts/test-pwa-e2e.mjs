import { createServer } from 'node:http';
import { mkdtemp, mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { spawn } from 'node:child_process';
import { build } from 'vite';

const chrome = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const webPort = 4182;
const debugPort = 9232;
const root = await mkdtemp(join(tmpdir(), 'asset-pwa-e2e-'));
const site = join(root, 'site'); const siteV2 = join(root, 'site-v2'); let servedSite = site; const profile = join(root, 'profile'); const downloads = join(root, 'downloads');
const delay = milliseconds => new Promise(done => setTimeout(done, milliseconds));
await mkdir(profile); await mkdir(downloads);
await build({ logLevel: 'silent', build: { outDir: site } });
const baseUrl = `http://127.0.0.1:${webPort}/`;
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const server = createServer(async (request, response) => {
  try {
    const path = new URL(request.url ?? '/', baseUrl).pathname;
    const file = join(servedSite, path === '/' ? 'index.html' : path);
    response.setHeader('Content-Type', mime[extname(file)] ?? 'application/octet-stream');
    if (path === '/' || path === '/index.html' || path === '/sw.js' || path === '/manifest.webmanifest') response.setHeader('Cache-Control', 'no-cache');
    response.end(await readFile(file));
  } catch { response.statusCode = 404; response.end('Not found'); }
});
await new Promise((done, reject) => { server.once('error', reject); server.listen(webPort, '127.0.0.1', done); });
let serverOpen = true;
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
  const evaluate = async expression => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }))?.result?.value;
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
let browser;
try {
  browser = await startChrome();
  const online = await openSession(await getPage(baseUrl));
  await waitFor(online, 'document.body?.innerText?.includes("资产看板")', '在线首页');
  await waitFor(online, 'navigator.serviceWorker?.getRegistration().then(registration => Boolean(registration?.active))', 'Service Worker 激活');
  await online.send('Page.reload');
  await waitFor(online, 'Boolean(navigator.serviceWorker?.controller)', 'Service Worker 控制首页');
  await waitFor(online, 'document.body?.innerText?.includes("资产看板")', '受控首页');
  const manifest = JSON.parse(await readFile(join(site, 'manifest.webmanifest'), 'utf8'));
  if (manifest.start_url !== './#/' || manifest.scope !== './' || manifest.icons.length !== 3) throw new Error('manifest 启动范围或图标错误');
  await online.evaluate('location.hash = "#/assets/new"');
  await waitFor(online, 'document.body?.innerText?.includes("新增资产")', '在线新增资产页');
  await typeInto(online, '名称', '更新前资产');
  await typeInto(online, '购买金额', '200');
  await online.evaluate('[...document.querySelectorAll("label")].find(label => label.textContent?.includes("按次"))?.querySelector("input")?.click()');
  await online.evaluate('document.querySelector("form")?.requestSubmit()');
  await waitFor(online, 'location.hash.startsWith("#/assets/") && !location.hash.includes("new")', '在线资产保存');
  const originalAssetHash = await online.evaluate('location.hash');
  await online.evaluate('location.hash += "/edit"');
  await waitFor(online, 'document.body?.innerText?.includes("编辑资产")', '编辑页');
  await typeInto(online, '名称', '更新后资产');
  await build({ logLevel: 'silent', plugins: [{ name: 'test-pwa-version', transformIndexHtml: html => html.replace('</head>', '<meta name="pwa-test-build" content="v2" /></head>') }], build: { outDir: siteV2 } });
  if ((await readFile(join(site, 'sw.js'), 'utf8')) === (await readFile(join(siteV2, 'sw.js'), 'utf8'))) throw new Error('第二次构建未产生新的 Service Worker');
  servedSite = siteV2;
  await online.evaluate('navigator.serviceWorker.getRegistration().then(registration => registration.update().then(() => true))');
  await waitFor(online, 'document.body?.innerText?.includes("有新版本可用")', '新版本提示');
  if (await online.evaluate('document.querySelector("meta[name=pwa-test-build]")?.content === "v2"')) throw new Error('编辑中发生自动刷新');
  await clickText(online, '保存后更新');
  await waitFor(online, 'document.body?.innerText?.includes("请先保存或取消正在进行的编辑")', '编辑草稿保护');
  if (await online.evaluate('document.querySelector("meta[name=pwa-test-build]")?.content === "v2"')) throw new Error('未保存编辑被更新覆盖');
  await online.evaluate('document.querySelector("form")?.requestSubmit()');
  await waitFor(online, `location.hash === ${JSON.stringify(originalAssetHash)}`, '编辑保存');
  await clickText(online, '保存后更新');
  await waitFor(online, 'document.querySelector("meta[name=pwa-test-build]")?.content === "v2"', '应用更新生效');
  await waitFor(online, 'document.body?.innerText?.includes("更新后资产")', '更新后数据保留');
  online.close();
  browser.kill('SIGTERM'); await delay(700);
  await new Promise(done => server.close(done)); serverOpen = false;

  browser = await startChrome();
  const targets = await fetch(`http://127.0.0.1:${debugPort}/json/list`).then(response => response.json());
  const blank = targets.find(target => target.type === 'page' && target.url === 'about:blank');
  if (!blank) throw new Error('离线冷启动未找到空白页');
  const offline = await openSession(blank);
  try {
    await offline.send('Network.enable');
    await offline.send('Network.setCacheDisabled', { cacheDisabled: true });
    await offline.send('Page.navigate', { url: baseUrl });
    await waitFor(offline, 'document.body?.innerText?.includes("资产看板")', '断网冷启动首页');
    if (!await offline.evaluate('Boolean(navigator.serviceWorker?.controller)')) throw new Error('离线页面不是 Service Worker 控制的页面');
    await offline.evaluate('location.hash = "#/assets/new"');
    await waitFor(offline, 'document.body?.innerText?.includes("新增资产")', '离线新增资产页');
    await typeInto(offline, '名称', '离线咖啡机');
    await typeInto(offline, '购买金额', '100');
    await offline.evaluate('[...document.querySelectorAll("label")].find(label => label.textContent?.includes("按次"))?.querySelector("input")?.click()');
    await offline.evaluate('document.querySelector("form")?.requestSubmit()');
    await waitFor(offline, 'location.hash.startsWith("#/assets/") && !location.hash.includes("new")', '离线资产保存');
    const assetHash = await offline.evaluate('location.hash');
    await clickText(offline, '+ 使用一次');
    await waitFor(offline, 'document.body?.innerText?.includes("累计 1 次")', '离线使用次数');
    await offline.evaluate('location.hash += "/records/new?type=consumable"');
    await waitFor(offline, 'document.body?.innerText?.includes("新增投入或收益")', '离线新增流水页');
    await typeInto(offline, '金额', '10');
    await offline.evaluate('document.querySelector("form")?.requestSubmit()');
    await waitFor(offline, `location.hash === ${JSON.stringify(assetHash)}`, '离线流水保存');
    await waitFor(offline, 'document.body?.innerText?.includes("耗材投入")', '离线流水详情');
    await offline.evaluate('location.hash = "#/settings"');
    await waitFor(offline, 'document.body?.innerText?.includes("导出全部数据")', '离线设置页');
    await offline.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
    await clickText(offline, '导出全部数据');
    let downloaded;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      downloaded = (await readdir(downloads)).find(name => /^asset-cost-backup-.*\.json$/.test(name));
      if (downloaded) break;
      await delay(100);
    }
    if (!downloaded) throw new Error('离线导出未保存 JSON');
    const saved = JSON.parse(await readFile(join(downloads, downloaded), 'utf8'));
    if (saved.assets.length !== 2 || saved.costRecords.length !== 1 || !saved.assets.some(asset => asset.name === '离线咖啡机' && asset.usageCount === 1) || !saved.assets.some(asset => asset.name === '更新后资产')) throw new Error('离线备份内容错误');
    const documentNode = await offline.send('DOM.getDocument');
    const input = await offline.send('DOM.querySelector', { nodeId: documentNode.root.nodeId, selector: 'input[type=file]' });
    await offline.send('DOM.setFileInputFiles', { nodeId: input.nodeId, files: [join(downloads, downloaded)] });
    await waitFor(offline, 'document.body?.innerText?.includes("备份预览")', '离线导入预览');
    await clickText(offline, '覆盖当前数据…');
    await clickText(offline, '确认替换');
    await waitFor(offline, 'location.hash === "#/"', '离线导入完成');
    await waitFor(offline, 'document.body?.innerText?.includes("离线咖啡机")', '离线数据恢复');
    console.log('PASS: 生产构建安装与手动更新、编辑草稿保护、旧数据保留、断开静态服务后冷启动、离线 CRUD/+1/JSON 备份');
  } finally { offline.close(); }
} finally {
  browser?.kill('SIGTERM');
  if (serverOpen) await new Promise(done => server.close(done));
  await delay(700);
  await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
