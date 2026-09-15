import { testPorts } from './test-ports.mjs';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { spawn } from 'node:child_process';
import { build } from 'vite';

const chrome = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const [webPort, debugPort] = await testPorts();
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
async function verifyIconGrid(session, kind) {
  const metrics = JSON.parse(await session.evaluate(`JSON.stringify((() => { const grid = document.querySelector('.icon-picker-grid'); const items = [...grid.querySelectorAll('button')].slice(0, 6).map(button => button.getBoundingClientRect()); return { count: grid.querySelectorAll('button').length, width: items[0]?.width, height: items[0]?.height, rowGap: items[5]?.top - items[0]?.bottom, scrollHeight: grid.scrollHeight, clientHeight: grid.clientHeight }; })())`));
  if (metrics.count < 6 || metrics.width < 50 || metrics.height < 50 || metrics.rowGap < 5 || metrics.scrollHeight <= metrics.clientHeight) throw new Error(`${kind} 全部图标网格排版异常：${JSON.stringify(metrics)}`);
  const scrollTop = await session.evaluate('(() => { const grid = document.querySelector(".icon-picker-grid"); grid.scrollTop = 400; return grid.scrollTop; })()');
  if (scrollTop < 100) throw new Error(`${kind} 全部图标无法独立滚动`);
  await session.evaluate('document.querySelector(".icon-picker-grid").scrollTop = 0');
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
  await waitFor(online, 'document.body?.innerText?.includes("好物总览")', '在线首页');
  await waitFor(online, 'navigator.serviceWorker?.getRegistration().then(registration => Boolean(registration?.active))', 'Service Worker 激活');
  await online.send('Page.reload');
  await waitFor(online, 'Boolean(navigator.serviceWorker?.controller)', 'Service Worker 控制首页');
  await waitFor(online, 'document.body?.innerText?.includes("好物总览")', '受控首页');
  const manifest = JSON.parse(await readFile(join(site, 'manifest.webmanifest'), 'utf8'));
  if (manifest.start_url !== './#/' || manifest.scope !== './' || manifest.icons.length !== 3 || !manifest.icons.every(icon => icon.src.startsWith('jiuyong-'))) throw new Error('manifest 启动范围或图标错误');
  await online.evaluate('location.hash = "#/settings"');
  await waitFor(online, 'document.body?.innerText?.includes("清透蓝")', '主题设置页');
  await online.evaluate('[...document.querySelectorAll(".theme-options button")].find(button => button.textContent?.includes("清透蓝"))?.click()');
  await waitFor(online, 'document.querySelector("meta[name=theme-color]")?.content === "#dbe7ff"', 'Chrome 顶部颜色随主题更新');
  await online.send('Page.reload');
  await waitFor(online, 'document.querySelector("meta[name=theme-color]")?.content === "#dbe7ff"', '主题颜色刷新后保留');
  await online.evaluate('location.hash = "#/assets/new"');
  await waitFor(online, 'document.body?.innerText?.includes("记下一件好物")', '在线新增资产页');
  await typeInto(online, '名称', '更新前资产');
  await typeInto(online, '购买金额', '200');
  await online.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
  await online.evaluate('document.querySelector(".form-asset-icon")?.click()');
  await waitFor(online, 'Boolean(document.querySelector(".icon-picker-grid"))', '图标选择器');
  for (const width of [320, 390, 430]) {
    await online.send('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 3, mobile: true });
    await verifyIconGrid(online, `${width}px 立体`);
  }
  await online.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
  if (process.env.ICON_PICKER_SCREENSHOT) {
    const shot = await online.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await writeFile(process.env.ICON_PICKER_SCREENSHOT, Buffer.from(shot.data, 'base64'));
  }
  await online.evaluate('[...document.querySelectorAll(".icon-kind-tabs button")].find(button => button.textContent?.includes("Emoji"))?.click()');
  await verifyIconGrid(online, 'Emoji');
  await online.evaluate('[...document.querySelectorAll(".icon-kind-tabs button")].find(button => button.textContent?.includes("线性"))?.click()');
  await verifyIconGrid(online, '线性');
  await online.evaluate('[...document.querySelectorAll(".icon-kind-tabs button")].find(button => button.textContent?.includes("立体"))?.click()');
  await online.evaluate('document.querySelector(".icon-picker-grid button[aria-label=Laptop]")?.click()');
  await waitFor(online, 'Boolean(document.querySelector(".form-asset-icon img[src*=laptop]"))', '立体图标预览');
  await online.evaluate('[...document.querySelectorAll("label")].find(label => label.textContent?.includes("按次"))?.querySelector("input")?.click()');
  await online.evaluate('document.querySelector("form")?.requestSubmit()');
  await waitFor(online, 'location.hash.startsWith("#/assets/") && !location.hash.includes("new")', '在线资产保存');
  const originalAssetHash = await online.evaluate('location.hash');
  await online.evaluate('location.hash = "#/"');
  await waitFor(online, 'Boolean(document.querySelector(".asset-visual img[src*=laptop]"))', '立体图标保存后显示在首页');
  await online.evaluate(`location.hash = ${JSON.stringify(originalAssetHash)}`);
  await waitFor(online, 'location.hash.includes("/assets/")', '返回好物详情');
  await online.evaluate('location.hash += "/edit"');
  await waitFor(online, 'document.body?.innerText?.includes("编辑好物")', '编辑页');
  if (!await online.evaluate('Boolean(document.querySelector(".form-asset-icon img[src*=laptop]"))')) throw new Error('立体图标编辑时未保留');
  await typeInto(online, '名称', '更新后资产');
  const otherTab = await openSession(await getPage(`${baseUrl}${originalAssetHash}/edit`));
  await waitFor(otherTab, `Boolean(${labelInput('名称')})`, '另一标签编辑页');
  await typeInto(otherTab, '名称', '另一标签未保存草稿');
  await build({ logLevel: 'silent', plugins: [{ name: 'test-pwa-version', transformIndexHtml: html => html.replace('</head>', '<meta name="pwa-test-build" content="v2" /></head>') }], build: { outDir: siteV2 } });
  if ((await readFile(join(site, 'sw.js'), 'utf8')) === (await readFile(join(siteV2, 'sw.js'), 'utf8'))) throw new Error('第二次构建未产生新的 Service Worker');
  servedSite = siteV2;
  await online.evaluate('navigator.serviceWorker.getRegistration().then(registration => registration.update().then(() => true))');
  await waitFor(online, 'document.body?.innerText?.includes("有新版本可用")', '新版本提示');
  await waitFor(otherTab, 'document.body?.innerText?.includes("有新版本可用")', '另一标签收到更新提示');
  if (await online.evaluate('document.querySelector("meta[name=pwa-test-build]")?.content === "v2"')) throw new Error('编辑中发生自动刷新');
  await clickText(online, '保存后更新');
  await waitFor(online, 'document.body?.innerText?.includes("请先保存或取消正在进行的编辑")', '编辑草稿保护');
  if (await online.evaluate('document.querySelector("meta[name=pwa-test-build]")?.content === "v2"')) throw new Error('未保存编辑被更新覆盖');
  await online.evaluate('document.querySelector("form")?.requestSubmit()');
  await waitFor(online, `location.hash === ${JSON.stringify(originalAssetHash)}`, '编辑保存');
  await clickText(online, '保存后更新');
  await waitFor(online, 'document.querySelector("meta[name=pwa-test-build]")?.content === "v2"', '应用更新生效');
  await waitFor(online, 'document.body?.innerText?.includes("更新后资产")', '更新后数据保留');
  await delay(500);
  if (await otherTab.evaluate('document.querySelector("meta[name=pwa-test-build]")?.content === "v2"')) throw new Error('另一标签更新丢弃了未保存草稿');
  if (await otherTab.evaluate(`(${labelInput('名称')})?.value`) !== '另一标签未保存草稿') throw new Error('另一标签草稿未保留');
  await clickText(otherTab, '保存后更新');
  await waitFor(otherTab, 'document.body?.innerText?.includes("请先保存或取消正在进行的编辑")', '已激活更新仍保护草稿');
  await clickText(otherTab, '取消');
  await clickText(otherTab, '放弃并离开');
  await waitFor(otherTab, `location.hash === ${JSON.stringify(originalAssetHash)}`, '离开另一标签草稿');
  await otherTab.evaluate('location.hash = "#/settings"');
  await waitFor(otherTab, `Boolean(${labelInput('新增类别')})`, '更新后设置入口');
  await typeInto(otherTab, '新增类别', '未保存类别');
  await clickText(otherTab, '保存后刷新更新');
  await waitFor(otherTab, 'document.body?.innerText?.includes("请先保存或取消正在进行的编辑")', '设置页更新入口保护类别草稿');
  if (await otherTab.evaluate('document.querySelector("meta[name=pwa-test-build]")?.content === "v2"')) throw new Error('设置页绕过了更新保护');
  await typeInto(otherTab, '新增类别', '');
  await clickText(otherTab, '保存后刷新更新');
  await waitFor(otherTab, 'document.querySelector("meta[name=pwa-test-build]")?.content === "v2"', '另一标签主动更新');
  otherTab.close();
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
    await waitFor(offline, 'document.body?.innerText?.includes("好物总览")', '断网冷启动首页');
    if (!await offline.evaluate('Boolean(navigator.serviceWorker?.controller)')) throw new Error('离线页面不是 Service Worker 控制的页面');
    await offline.evaluate('location.hash = "#/assets/new"');
    await waitFor(offline, 'document.body?.innerText?.includes("记下一件好物")', '离线新增资产页');
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
    const input = await offline.send('DOM.querySelector', { nodeId: documentNode.root.nodeId, selector: 'input[data-import-kind=backup]' });
    await offline.send('DOM.setFileInputFiles', { nodeId: input.nodeId, files: [join(downloads, downloaded)] });
    await waitFor(offline, 'document.body?.innerText?.includes("备份预览")', '离线导入预览');
    await clickText(offline, '覆盖当前数据…');
    await clickText(offline, '确认替换');
    await waitFor(offline, 'location.hash === "#/"', '离线导入完成');
    await waitFor(offline, 'document.body?.innerText?.includes("离线咖啡机")', '离线数据恢复');
    console.log('PASS: 生产构建安装与手动更新、多标签及设置入口草稿保护、旧数据保留、断开静态服务后冷启动、离线 CRUD/+1/JSON 备份');
  } finally { offline.close(); }
} finally {
  browser?.kill('SIGTERM');
  if (serverOpen) await new Promise(done => server.close(done));
  await delay(700);
  await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
