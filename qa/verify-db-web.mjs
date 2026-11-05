/* ============================================================
   星语计划 · 数据库接入的浏览器端验收（Playwright）
   用法：node qa/verify-db-web.mjs
   ------------------------------------------------------------
   会起一个临时端口 + 临时数据库，用真实 Chrome 打开页面，验证：
     1. 页面确实从 /api/bootstrap 取到数据库数据（window.XY_DB.online）
     2. 各页渲染数量正确、无 undefined、无 JS 报错、无 4xx 资源
     3. 报名表单提交后落库
     4. 商城下单后落库，且库存扣减
   ============================================================ */
import { createRequire } from "module";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const chromePath = process.env.XY_CHROME || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

let pw;
try {
  pw = require("C:/Users/bbb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core");
} catch (e) {
  console.error("未找到 playwright-core：", e.message);
  process.exit(1);
}

const PORT = 8300 + Math.floor(Math.random() * 300);
const BASE = "http://127.0.0.1:" + PORT;
const TEST_DB = path.join(os.tmpdir(), "xingyu-web-" + Date.now() + ".db");

const results = [];
const chk = (name, pass, extra) => results.push([name, !!pass, extra]);

/* ---------- 起服务 ---------- */
const server = spawn(process.execPath, [path.join(root, "server.js")], {
  cwd: root,
  env: Object.assign({}, process.env, { XY_PORT: String(PORT), XY_DB: TEST_DB }),
  stdio: "ignore"
});

async function waitServer(tries = 40) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(BASE + "/api/health");
      if (res.ok) return await res.json();
    } catch (e) { /* 未就绪 */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("服务未在预期时间内启动");
}

async function apiGet(p) {
  const res = await fetch(BASE + p);
  return { status: res.status, json: await res.json().catch(() => null) };
}

const browserRef = { current: null };
const serverRef = { current: server };

try {
  const health = await waitServer();
  chk("服务启动且已自动导入数据", health.ok && health.seeded && health.counts.works === 13, JSON.stringify(health.counts));

  const browser = await pw.chromium.launch({ executablePath: chromePath, headless: true });
  browserRef.current = browser;

  /* ---------- 首页：数据库驱动 ---------- */
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = [];
    const badResponses = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    page.on("response", (r) => { if (r.status() >= 400) badResponses.push(r.status() + " " + r.url()); });

    await page.goto(BASE + "/index.html", { waitUntil: "load", timeout: 20000 });
    await page.waitForSelector("#hotWorks .work-card", { timeout: 10000 });

    const info = await page.evaluate(() => ({
      online: !!(window.XY_DB && window.XY_DB.online),
      source: window.XY_DB && window.XY_DB.source,
      firstWork: window.XINGYU.works[0] && window.XINGYU.works[0].title,
      firstId: window.XINGYU.works[0] && window.XINGYU.works[0].id,
      works: window.XINGYU.works.length,
      students: window.XINGYU.students.length,
      cards: document.querySelectorAll("#hotWorks .work-card").length,
      pillars: document.querySelectorAll("#pillars .pillar-card").length,
      flows: document.querySelectorAll("#flowSteps .flow-step").length,
      stories: document.querySelectorAll("#storyPreview .story-preview-card").length,
      undefinedText: /undefined/.test(document.body.innerText)
    }));

    chk("首页拿到数据库数据（XY_DB.online）", info.online && info.source === "sqlite", JSON.stringify(info.online));
    chk("作品来自库且顺序正确（w01 金山蓝海）", info.firstId === "w01" && /金山蓝海/.test(info.firstWork || ""), info.firstId);
    chk("首页作品卡 6 张 / 理念 3 张 / 闭环 6 步 / 故事 3 张",
      info.cards === 6 && info.pillars === 3 && info.flows === 6 && info.stories === 3,
      [info.cards, info.pillars, info.flows, info.stories].join("/"));
    chk("页面无 undefined 文本", !info.undefinedText);
    chk("首页无 JS 报错", errors.length === 0, errors.slice(0, 2).join(" | "));
    chk("首页无 4xx/5xx 资源", badResponses.length === 0, badResponses.slice(0, 3).join(" | "));

    /* 作品区滚动/图片 */
    const brokenImgs = await page.evaluate(() =>
      Array.from(document.images).filter((im) => !im.complete || im.naturalWidth === 0).map((im) => im.getAttribute("src"))
    );
    chk("首页无破图", brokenImgs.length === 0, brokenImgs.slice(0, 3).join(","));

    await ctx.close();
  }

  /* ---------- 作品页 / 详情页 / 后台 ---------- */
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

    await page.goto(BASE + "/works.html", { waitUntil: "load" });
    await page.waitForSelector("#worksGrid .work-card");
    const workCount = await page.locator("#worksGrid .work-card").count();
    chk("作品页渲染来自库的 13 件作品（首屏 9 件）", workCount === 9, String(workCount));

    await page.goto(BASE + "/detail.html?id=w02", { waitUntil: "load" });
    await page.waitForSelector("#storyText");
    const detailTitle = await page.locator("#heroTitle").innerText();
    chk("详情页标题来自库（一叶知秋）", /一叶知秋/.test(detailTitle), detailTitle);

    await page.goto(BASE + "/admin.html", { waitUntil: "load" });
    // 订单表在非激活面板内，元素存在但不可见，故用 attached
    await page.waitForSelector("#ordersTable tbody tr", { state: "attached" });
    await page.waitForTimeout(1200); // 等接口刷新
    const admin = await page.evaluate(() => ({
      orders: document.querySelectorAll("#ordersTable tbody tr").length,
      funds: document.querySelectorAll("#fundsTable tbody tr").length,
      firstOrder: (document.querySelector("#ordersTable tbody tr b") || {}).textContent || "",
      firstItem: (document.querySelector("#ordersTable tbody tr td:nth-child(2)") || {}).textContent || ""
    }));
    chk("后台订单表来自库（6 条）", admin.orders === 6, String(admin.orders));
    chk("后台资金表来自库（5 条）", admin.funds === 5, String(admin.funds));
    chk("后台订单号为库中真实订单", /^XY\d+/.test(admin.firstOrder.trim()), admin.firstOrder);
    chk("后台商品名来自库", /掐丝|金山|银杏|莲|郁金香|春信|归航/.test(admin.firstItem), admin.firstItem.trim().slice(0, 20));
    chk("作品/详情/后台无 JS 报错", errors.length === 0, errors.slice(0, 2).join(" | "));

    await ctx.close();
  }

  /* ---------- 公益公开页：库数据展示 ---------- */
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

    await page.goto(BASE + "/public.html", { waitUntil: "load" });
    await page.waitForSelector("#fundRows tr", { timeout: 10000 });
    await page.waitForTimeout(600);

    const pub = await page.evaluate(() => ({
      fundRows: document.querySelectorAll("#fundRows tr").length,
      summaryCards: document.querySelectorAll("#fundSummary .trans-card").length,
      firstFundItem: (document.querySelector("#fundRows tr td:nth-child(3)") || {}).textContent || "",
      trendCols: document.querySelectorAll("#trendChart .trend-col").length,
      reportCards: document.querySelectorAll("#reportList .report-card").length,
      reportText: document.querySelector("#reportList") ? document.querySelector("#reportList").innerText : ""
    }));

    chk("公开页：资金流水 5 条（来自 fund_records）", pub.fundRows === 5, String(pub.fundRows));
    chk("公开页：收支汇总 4 张卡", pub.summaryCards === 4, String(pub.summaryCards));
    chk("公开页：流水项目名来自库", /义卖|物料|捐赠|帮扶|定制/.test(pub.firstFundItem), pub.firstFundItem.trim());
    chk("公开页：月度趋势 3 根柱组（monthly_ledger）", pub.trendCols === 3, String(pub.trendCols));
    chk("公开页：披露报告 4 条（disclosure_reports）", pub.reportCards === 4, String(pub.reportCards));
    chk("公开页：报告含季度名称", /2026 年第二季度报告/.test(pub.reportText), pub.reportText.slice(0, 30));
    chk("公开页无 JS 报错", errors.length === 0, errors.slice(0, 2).join(" | "));
    await ctx.close();
  }

  /* ---------- 爱心证书查询 ---------- */
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));

    await page.goto(BASE + "/certificate.html", { waitUntil: "load" });
    await page.waitForSelector("#certNo");
    await page.fill("#certNo", "XY20260825001");
    await page.click('#certForm button[type="submit"]');
    await page.waitForSelector(".certificate", { timeout: 10000 });

    const cert = await page.evaluate(() => ({
      text: document.querySelector(".certificate").innerText,
      hasSeal: !!document.querySelector(".cert-seal"),
      hasPrint: !!document.querySelector("#printCert")
    }));
    chk("证书页：正确渲染证书卡", cert.hasSeal && cert.hasPrint);
    chk("证书页：显示订单号", /XY20260825001/.test(cert.text));
    chk("证书页：显示 30% 捐赠额 ¥80.4", /¥80\.4/.test(cert.text), (cert.text.match(/¥[\d,.]+/g) || []).join(","));
    chk("证书页：显示受助儿童编号", /受助儿童[\s\S]{0,20}[A-Z]\d+/.test(cert.text));
    chk("证书页无 JS 报错", errors.length === 0, errors.slice(0, 2).join(" | "));

    // 不存在的订单号
    await page.fill("#certNo", "XY00000000000");
    await page.click('#certForm button[type="submit"]');
    await page.waitForFunction(() => /没有找到订单/.test((document.getElementById("certMsg") || {}).textContent || ""), { timeout: 8000 });
    chk("证书页：错误订单号给出提示", true);
    await ctx.close();
  }

  /* ---------- 后台申请管理（审核闭环） ---------- */
  {
    const before = (await apiGet("/api/applications")).json.filter((a) => a.status === "待审核").length;
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(BASE + "/admin.html", { waitUntil: "load" });
    await page.click('#adminMenu button[data-pane="applications"]');
    await page.waitForSelector("#applicationsTable tbody tr", { state: "attached" });
    await page.waitForTimeout(900);

    const rows = await page.locator("#applicationsTable tbody tr").count();
    chk("后台：申请管理列表来自库（3 条）", rows === 3, String(rows));

    await page.locator('#applicationsTable [data-app-op="已通过"]').first().click();
    await page.waitForTimeout(900);
    const after = (await apiGet("/api/applications")).json.filter((a) => a.status === "待审核").length;
    chk("后台：点击通过后待审核数 -1", after === before - 1, before + "→" + after);
    await ctx.close();
  }

  /* ---------- 其余页面（HTTP 模式）无报错 ---------- */
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = [];
    const badResponses = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    page.on("response", (r) => { if (r.status() >= 400) badResponses.push(r.status() + " " + r.url()); });

    await page.goto(BASE + "/public.html", { waitUntil: "load" });
    const months = await page.locator("#monthRows tr").count();
    const bars = await page.locator(".bar-fill").count();
    chk("公益公开（HTTP）：月度披露 3 行、支出条 4 条", months === 3 && bars === 4, months + "/" + bars);

    await page.goto(BASE + "/stories.html", { waitUntil: "load" });
    const stories = await page.locator(".student-story").count();
    const timeline = await page.locator(".timeline-item").count();
    chk("星星故事（HTTP）：8 位学生 / 32 条时间轴", stories === 8 && timeline === 32, stories + "/" + timeline);

    await page.goto(BASE + "/about.html", { waitUntil: "load" });
    const partners = await page.locator(".partner-item").count();
    chk("项目介绍（HTTP）：伙伴列表已渲染", partners > 0, String(partners));

    chk("其余页面无 JS 报错", errors.length === 0, errors.slice(0, 2).join(" | "));
    chk("其余页面无 4xx/5xx 资源", badResponses.length === 0, badResponses.slice(0, 3).join(" | "));
    await ctx.close();
  }

  /* ---------- 报名提交落库 ---------- */
  {
    const before = await apiGet("/api/applications");
    const beforeCount = before.json.length;

    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(BASE + "/join.html", { waitUntil: "load" });
    await page.fill("#jfName", "浏览器验收");
    await page.fill("#jfContact", "13900001111");
    await page.selectOption("#jfType", { index: 0 });
    // 表单含必填的「同意条款」单选框，不勾选会被浏览器原生校验拦住
    await page.check('input[name="jfPrivate"]');
    await page.click('#joinForm button[type="submit"]');
    await page.waitForFunction(() => {
      const t = document.getElementById("toast");
      return t && /提交成功/.test(t.textContent);
    }, { timeout: 8000 });

    const toastText = await page.locator("#toast").innerText();
    const after = await apiGet("/api/applications");
    chk("报名提交后出现成功提示", /提交成功/.test(toastText), toastText.slice(0, 40));
    chk("报名落库（申请数 +1）", after.json.length === beforeCount + 1, beforeCount + "→" + after.json.length);
    chk("落库内容正确", after.json[0].name === "浏览器验收" && after.json[0].contact === "13900001111", JSON.stringify(after.json[0]));
    await ctx.close();
  }

  /* ---------- 商城下单落库 ---------- */
  {
    const beforeOrders = (await apiGet("/api/orders")).json.length;
    const beforeStock = (await apiGet("/api/works/w06")).json.stock;

    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(BASE + "/mall.html", { waitUntil: "load" });
    await page.waitForSelector(".add-cart");

    // 找到「归航 · 海与星」对应商品卡加入购物车
    const target = page.locator('.product-card', { hasText: "归航 · 海与星" }).first();
    await target.locator(".add-cart").click();
    await page.waitForFunction(() => document.querySelectorAll("#cartList .cart-item").length > 0, { timeout: 5000 });
    await page.click("#checkoutBtn");
    await page.waitForFunction(() => {
      const t = document.getElementById("toast");
      return t && /下单成功/.test(t.textContent);
    }, { timeout: 10000 });

    const toastText = await page.locator("#toast").innerText();
    const afterOrders = (await apiGet("/api/orders")).json;
    const afterStock = (await apiGet("/api/works/w06")).json.stock;

    chk("结算后提示下单成功并含订单号", /下单成功/.test(toastText) && /XY\d+/.test(toastText), toastText.slice(0, 60));
    chk("订单落库（订单数 +1）", afterOrders.length === beforeOrders + 1, beforeOrders + "→" + afterOrders.length);
    chk("下单后库存扣减", afterStock === beforeStock - 1, beforeStock + "→" + afterStock);
    chk("购物车已清空", (await page.locator("#cartList .cart-item").count()) === 0);
    await ctx.close();
  }
} catch (err) {
  chk("验收执行未中断", false, err.message);
} finally {
  if (browserRef.current) { try { await browserRef.current.close(); } catch (e) {} }
  try { serverRef.current.kill(); } catch (e) {}
  for (const suffix of ["", "-wal", "-shm"]) {
    try { fs.unlinkSync(TEST_DB + suffix); } catch (e) { /* ignore */ }
  }

  const pad = (s) => s + " ".repeat(Math.max(0, 44 - [...s].reduce((n, ch) => n + (ch.charCodeAt(0) > 255 ? 2 : 1), 0)));
  results.forEach(([name, pass, extra]) => {
    console.log((pass ? "[PASS] " : "[FAIL] ") + pad(name) + (pass ? "" : (extra || "")));
  });
  const failed = results.filter((r) => !r[1]).length;
  console.log("\n浏览器端验收：" + (results.length - failed) + "/" + results.length + " 通过" + (failed ? "，FAILED " + failed : ""));
  process.exit(failed ? 1 : 0);
}
