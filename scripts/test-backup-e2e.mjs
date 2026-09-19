import { testPorts } from './test-ports.mjs';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { build } from 'vite';

const chrome = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const [webPort, debugPort] = await testPorts();
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
  throw new Error(`${label} 超时：${String(await session.evaluate('document.body?.innerText')).slice(-600)}`);
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
    if (saved.schemaVersion !== 3 || saved.assets?.length !== 1 || saved.categories?.length !== 1 || saved.costRecords?.length !== 1 || saved.revenueRecords?.length !== 1) throw new Error('下载文件缺少四表记录');
    await fixture('mutate');
    async function chooseDownloadedFile() {
      const documentNode = await app.send('DOM.getDocument');
      const input = await app.send('DOM.querySelector', { nodeId: documentNode.root.nodeId, selector: 'input[data-import-kind=backup]' });
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
    await app.evaluate('location.hash = "#/"');
    await waitFor(app, 'document.body.innerText.includes("状态账本") && document.body.innerText.includes("类别账本")', 'V2 首页账本');
    await app.evaluate('[...document.querySelectorAll(".category-tabs button")].find(button => button.textContent?.includes("数码"))?.click()');
    await waitFor(app, 'location.hash.includes("category=55555555-5555-4555-8555-555555555555") && document.querySelector(".category-tabs button.active")?.textContent?.includes("数码")', '首页类别筛选写入历史');
    await app.evaluate('(() => { const select = document.querySelector("select[aria-label=成本排序]"); const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set; setter.call(select, "use-desc"); select.dispatchEvent(new Event("change", { bubbles: true })); })()');
    await waitFor(app, 'location.hash.includes("sort=use-desc") && document.querySelector("select[aria-label=成本排序]")?.value === "use-desc" && document.body.innerText.includes("备份测试资产")', '首页分类次均排序');
    await app.evaluate('document.querySelector(".asset-card-link")?.click()');
    await waitFor(app, 'location.hash.includes("/assets/11111111-1111-4111-8111-111111111111")', '从类别筛选进入好物');
    await app.evaluate('history.back()');
    await waitFor(app, 'location.hash.includes("category=55555555-5555-4555-8555-555555555555") && location.hash.includes("sort=use-desc") && document.querySelector(".category-tabs button.active")?.textContent?.includes("数码") && document.querySelector("select[aria-label=成本排序]")?.value === "use-desc"', '系统返回恢复类别筛选排序');
    await app.evaluate('document.querySelector(".asset-card-link")?.click()');
    await waitFor(app, 'document.body.innerText.includes("返回上一级")', '详情显示上下文返回');
    await app.evaluate('[...document.querySelectorAll("a")].find(link => link.textContent === "返回上一级")?.click()');
    await waitFor(app, 'location.hash.includes("category=55555555-5555-4555-8555-555555555555") && location.hash.includes("sort=use-desc") && document.querySelector(".category-tabs button.active")?.textContent?.includes("数码") && document.querySelector("select[aria-label=成本排序]")?.value === "use-desc"', '详情返回恢复类别筛选排序');
    await app.evaluate('(() => { const select = document.querySelector("select[aria-label=成本排序]"); const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set; setter.call(select, "day-desc"); select.dispatchEvent(new Event("change", { bubbles: true })); })()');
    await waitFor(app, 'document.body.innerText.includes("当前范围内暂无按日好物") && !document.body.innerText.includes("备份测试资产")', '按日排序排除按次好物');
    await app.evaluate('location.hash = "#/"');
    await app.evaluate('location.hash = "#/ledgers/active"');
    await waitFor(app, 'document.body.innerText.includes("服役中账本") && document.body.innerText.includes("备份测试资产")', '服役中账本');
    await app.evaluate('location.hash = "#/ledgers/retired"');
    await waitFor(app, 'document.body.innerText.includes("已退役账本") && document.body.innerText.includes("此账本暂无好物")', '空状态账本');
    await app.evaluate('location.hash = "#/categories/55555555-5555-4555-8555-555555555555"');
    await waitFor(app, 'document.body.innerText.includes("数码账本") && document.body.innerText.includes("备份测试资产")', '类别账本');
    await app.evaluate('(() => { const select = document.querySelector("select[aria-label=成本排序]"); const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set; setter.call(select, "use-asc"); select.dispatchEvent(new Event("change", { bubbles: true })); })()');
    await waitFor(app, 'location.hash.includes("sort=use-asc") && document.body.innerText.includes("备份测试资产")', '分类账本次均排序');
    await app.evaluate('document.querySelector(".asset-card-link")?.click()');
    await waitFor(app, 'location.hash.includes("/assets/11111111-1111-4111-8111-111111111111")', '从分类账本进入好物');
    await app.evaluate('history.back()');
    await waitFor(app, 'location.hash.includes("/categories/55555555-5555-4555-8555-555555555555") && location.hash.includes("sort=use-asc") && document.body.innerText.includes("数码账本")', '系统返回分类账本排序');
    await app.evaluate('document.querySelector(".asset-card-link")?.click()');
    await waitFor(app, 'document.body.innerText.includes("返回上一级")', '分类账本详情显示上下文返回');
    await app.evaluate('[...document.querySelectorAll("a")].find(link => link.textContent === "返回上一级")?.click()');
    await waitFor(app, 'location.hash.includes("/categories/55555555-5555-4555-8555-555555555555") && document.body.innerText.includes("数码账本")', '详情返回分类账本');
    await app.evaluate('(() => { const select = document.querySelector("select"); const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set; setter.call(select, "sold"); select.dispatchEvent(new Event("change", { bubbles: true })); })()');
    await waitFor(app, 'document.body.innerText.includes("此账本暂无好物")', '类别状态筛选');
    await app.evaluate('location.hash = "#/assets/11111111-1111-4111-8111-111111111111/edit"');
    await waitFor(app, 'document.body.innerText.includes("编辑好物")', '资产编辑');
    await app.evaluate('(() => { const input = [...document.querySelectorAll("input[type=date]")].find(item => item.closest("label")?.textContent?.startsWith("到期日期")); const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; setter.call(input, "2026-09-14"); input.dispatchEvent(new Event("input", { bubbles: true })); input.dispatchEvent(new Event("change", { bubbles: true })); })()');
    await waitFor(app, '[...document.querySelectorAll("button")].some(button => button.textContent === "清空到期日期")', '到期日期清空入口');
    await app.evaluate('[...document.querySelectorAll("button")].find(button => button.textContent === "清空到期日期")?.click()');
    await waitFor(app, '[...document.querySelectorAll("input[type=date]")].find(item => item.closest("label")?.textContent?.startsWith("到期日期"))?.value === ""', '清空到期日期');
    await app.evaluate('(() => { const select = [...document.querySelectorAll("select")].find(item => item.closest("label")?.textContent?.startsWith("使用状态")); const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set; setter.call(select, "retired"); select.dispatchEvent(new Event("change", { bubbles: true })); })()');
    await waitFor(app, 'document.body.innerText.includes("结束日期（可选）")', '退役结束日期可选');
    await app.evaluate('document.querySelector("form")?.requestSubmit()');
    await waitFor(app, 'location.hash === "#/assets/11111111-1111-4111-8111-111111111111" && document.body.innerText.includes("已退役") && document.body.innerText.includes("未填写")', '无结束日期退役保存');
    await app.evaluate('location.hash = "#/assets/11111111-1111-4111-8111-111111111111/edit"');
    await waitFor(app, 'document.body.innerText.includes("编辑好物")', '重新编辑退役资产');
    await app.evaluate('(() => { const select = [...document.querySelectorAll("select")].find(item => item.closest("label")?.textContent?.startsWith("使用状态")); const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set; setter.call(select, "sold"); select.dispatchEvent(new Event("change", { bubbles: true })); })()');
    await waitFor(app, 'document.body.innerText.includes("结束日期")', '结束日期字段');
    await app.evaluate('(() => { const input = [...document.querySelectorAll("input[type=date]")].find(item => item.closest("label")?.textContent?.startsWith("结束日期")); const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; setter.call(input, "2026-09-13"); input.dispatchEvent(new Event("input", { bubbles: true })); input.dispatchEvent(new Event("change", { bubbles: true })); })()');
    await waitFor(app, '[...document.querySelectorAll("button")].some(button => button.textContent === "清空结束日期")', '结束日期清空入口');
    await app.evaluate('[...document.querySelectorAll("button")].find(button => button.textContent === "清空结束日期")?.click()');
    await waitFor(app, '[...document.querySelectorAll("input[type=date]")].find(item => item.closest("label")?.textContent?.startsWith("结束日期"))?.value === ""', '清空结束日期');
    await app.evaluate('(() => { const input = [...document.querySelectorAll("input[type=date]")].find(item => item.closest("label")?.textContent?.startsWith("结束日期")); const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; setter.call(input, "2026-09-13"); input.dispatchEvent(new Event("input", { bubbles: true })); input.dispatchEvent(new Event("change", { bubbles: true })); })()');
    await waitFor(app, 'document.body.innerText.includes("卖价（元，必填）")', '必填卖价字段');
    await app.evaluate('(() => { const input = [...document.querySelectorAll("input")].find(item => item.closest("label")?.textContent?.startsWith("卖价（元，必填）")); const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; setter.call(input, "2"); input.dispatchEvent(new Event("input", { bubbles: true })); input.dispatchEvent(new Event("change", { bubbles: true })); })()');
    await app.evaluate('document.querySelector("form")?.requestSubmit()');
    await waitFor(app, 'location.hash === "#/assets/11111111-1111-4111-8111-111111111111" && document.body.innerText.includes("已卖出")', '状态保存');
    if (await app.evaluate('document.body.innerText.includes("+ 使用一次")')) throw new Error('已卖出资产仍显示 +1');
    if (!await app.evaluate('document.body.innerText.includes("卖价已按“出售”收益流水记录")')) throw new Error('已卖出资产缺少收益流水提示');
    if (!await app.evaluate('document.body.innerText.includes("¥2.00")')) throw new Error('卖价收益未计入详情');
    await app.evaluate('location.hash = "#/ledgers/sold"');
    await waitFor(app, 'document.body.innerText.includes("已卖出账本") && document.body.innerText.includes("备份测试资产")', '资产状态转移');
    await app.evaluate('location.hash = "#/settings"');
    await waitFor(app, 'document.body.innerText.includes("类别管理")', '类别管理页');
    await app.evaluate('(() => { const input = [...document.querySelectorAll("input")].find(item => item.closest("label")?.textContent?.startsWith("新增类别")); const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; setter.call(input, "家电"); input.dispatchEvent(new Event("input", { bubbles: true })); })()');
    await app.evaluate('[...document.querySelectorAll("button")].find(item => item.textContent === "新增类别")?.click()');
    await waitFor(app, 'Boolean([...document.querySelectorAll(".category-management li")].find(item => item.textContent?.includes("家电")))', '浏览器新增类别');
    await app.evaluate('(() => { const row = [...document.querySelectorAll(".category-management li")].find(item => item.textContent?.includes("家电")); row?.querySelector("button")?.click(); })()');
    await waitFor(app, 'document.body.innerText.includes("修改“家电”")', '类别改名表单');
    await app.evaluate('(() => { const input = [...document.querySelectorAll("input")].find(item => item.closest("label")?.textContent?.startsWith("修改“家电”")); const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; setter.call(input, "厨电"); input.dispatchEvent(new Event("input", { bubbles: true })); })()');
    await app.evaluate('[...document.querySelectorAll("button")].find(item => item.textContent === "保存名称")?.click()');
    await waitFor(app, 'Boolean([...document.querySelectorAll(".category-management li")].find(item => item.textContent?.includes("厨电")))', '浏览器类别改名');
    await app.evaluate('(() => { const row = [...document.querySelectorAll(".category-management li")].find(item => item.textContent?.includes("数码")); row?.querySelector("button.danger")?.click(); })()');
    await waitFor(app, 'document.body.innerText.includes("关联 1 件好物将转为未分类")', '删除非空类别确认');
    await app.evaluate('[...document.querySelectorAll(".dialog button")].find(item => item.textContent === "删除类别")?.click()');
    await waitFor(app, '!Boolean([...document.querySelectorAll(".category-management li")].find(item => item.textContent?.includes("数码")))', '浏览器删除类别');
    await app.evaluate('location.hash = "#/assets/11111111-1111-4111-8111-111111111111"');
    await waitFor(app, 'document.body.innerText.includes("未分类") && document.body.innerText.includes("已卖出")', '类别转未分类后资产保留');
    for (const width of [320, 375, 390, 430]) {
      await app.send('Emulation.setDeviceMetricsOverride', { width, height: 800, deviceScaleFactor: 1, mobile: true });
      const overflow = await app.evaluate('document.documentElement.scrollWidth > document.documentElement.clientWidth');
      if (overflow) throw new Error(`${width}px 详情页横向溢出`);
    }
    await app.evaluate('location.hash = "#/"');
    await waitFor(app, 'document.body.innerText.includes("状态账本")', '响应式首页');
    for (const width of [320, 375, 390, 430]) {
      await app.send('Emulation.setDeviceMetricsOverride', { width, height: 800, deviceScaleFactor: 1, mobile: true });
      const overflow = await app.evaluate('document.documentElement.scrollWidth > document.documentElement.clientWidth');
      if (overflow) throw new Error(`${width}px 首页横向溢出`);
    }
    await app.evaluate('location.hash = "#/settings"');
    await waitFor(app, 'document.body.innerText.includes("导入 JSON")', '旧版备份入口');
    const oldDocument = await app.send('DOM.getDocument');
    const oldInput = await app.send('DOM.querySelector', { nodeId: oldDocument.root.nodeId, selector: 'input[data-import-kind=backup]' });
    await app.send('DOM.setFileInputFiles', { nodeId: oldInput.nodeId, files: [resolve('tests/fixtures/backups/v1-sample.json')] });
    await waitFor(app, 'document.body.innerText.includes("旧版备份：导入后所有好物默认为服役中、未分类")', 'v1 预览映射');
    await app.evaluate('[...document.querySelectorAll("button")].find(item => item.textContent?.includes("覆盖当前数据"))?.click()');
    await waitFor(app, 'document.body.innerText.includes("覆盖全部本地数据？")', 'v1 覆盖确认');
    await app.evaluate('[...document.querySelectorAll(".dialog button")].find(item => item.textContent === "确认替换")?.click()');
    await waitFor(app, 'location.hash === "#/" && document.body.innerText.includes("旧版咖啡机")', 'v1 文件恢复');
    await app.evaluate('location.hash = "#/ledgers/active"');
    await waitFor(app, 'document.body.innerText.includes("旧版咖啡机")', 'v1 资产映射至服役中');
    await app.evaluate('location.hash = "#/categories/uncategorized"');
    await waitFor(app, 'document.body.innerText.includes("旧版咖啡机")', 'v1 资产映射至未分类');
    console.log('PASS: Chrome v1/v2 JSON 恢复、类别 CRUD、状态编辑、账本筛选及移动宽度');
  } finally { app.close(); }
} finally {
  browser?.kill('SIGTERM');
  await new Promise(done => server.close(done));
  await delay(500);
  await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
