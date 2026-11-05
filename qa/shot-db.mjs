/* 截图脚本：为「数据库内容展示」生成效果图（临时用） */
import { createRequire } from "module";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pw = require("C:/Users/bbb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core");
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 8477;
const BASE = "http://127.0.0.1:" + PORT;
const outDir = path.join(root, "_preview");
fs.mkdirSync(outDir, { recursive: true });

const server = spawn(process.execPath, [path.join(root, "server.js")], {
  cwd: root, env: Object.assign({}, process.env, { XY_PORT: String(PORT) }), stdio: "ignore"
});

async function wait() {
  for (let i = 0; i < 40; i++) {
    try { const r = await fetch(BASE + "/api/health"); if (r.ok) return; } catch (e) {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("服务未启动");
}

const browser = await pw.chromium.launch({ executablePath: chromePath, headless: true });
try {
  await wait();
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();

  // 注意：带 fade-up 的元素在 IntersectionObserver 触发前是 opacity:0，
  // 直接截图会得到空白图，必须先滚动到视口内并等待动画完成。
  async function shot(locator, file) {
    await locator.scrollIntoViewIfNeeded();
    await page.waitForTimeout(700);
    await locator.screenshot({ path: path.join(outDir, file) });
  }

  await page.goto(BASE + "/public.html", { waitUntil: "load" });
  await page.waitForSelector("#fundRows tr");
  await page.waitForTimeout(800);

  await shot(page.locator("section", { has: page.locator("#fundSummary") }).first(), "db-1-funds.png");
  await shot(page.locator("section", { has: page.locator("#trendChart") }).first(), "db-2-trend.png");
  await shot(page.locator("section", { has: page.locator("#reportList") }).first(), "db-3-reports.png");

  await page.goto(BASE + "/certificate.html?no=XY20260825001", { waitUntil: "load" });
  await page.waitForSelector(".certificate");
  await shot(page.locator(".certificate"), "db-4-certificate.png");

  await page.goto(BASE + "/admin.html", { waitUntil: "load" });
  await page.click('#adminMenu button[data-pane="applications"]');
  await page.waitForTimeout(1000);
  await shot(page.locator('.admin-pane[data-pane="applications"]'), "db-5-applications.png");

  console.log("截图完成：", fs.readdirSync(outDir).filter((f) => f.startsWith("db-")).join(", "));
} finally {
  await browser.close();
  server.kill();
}
