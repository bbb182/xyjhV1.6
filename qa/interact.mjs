/* ============================================================
   星语计划 · 交互功能验证（Playwright，file:// 离线模式）
   用法：node qa/interact.mjs
   ------------------------------------------------------------
   期望值全部从 js/data.js 动态读取，内容改动后不会误报。
   重点验证：模块渲染数量、分类筛选、搜索、加购、结算、时间轴、图表、表单。
   ============================================================ */
import { createRequire } from "module";
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pw = require("C:/Users/bbb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core");
const chromePath = process.env.XY_CHROME || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

/* ---------- 读取基准数据 ---------- */
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, "js/data.js"), "utf8"), sandbox);
const X = sandbox.window.XINGYU;

const workCount = X.works.length;
const hotCount = Math.min(6, workCount);
const studentCount = X.students.length;
const milestoneCount = X.students.reduce((n, s) => n + (s.milestones || []).length, 0);

const firstCat = X.categories.find((c) => c.id !== "all");
const catWorkCount = X.works.filter((w) => w.category === firstCat.id).length;
const sampleNick = X.students[0].nick;
const nickWorkCount = X.works.filter((w) => w.studentId === X.students[0].id).length;

const browser = await pw.chromium.launch({ executablePath: chromePath, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
let failures = 0;

function check(name, cond) {
  console.log((cond ? "[OK] " : "[!!] ") + name + (cond ? "" : "   ← 期望不符"));
  if (!cond) failures++;
}

const url = (f) => "file:///" + path.join(root, f).replace(/\\/g, "/");

/* ---------- 首页模块数量 ---------- */
await page.goto(url("index.html"), { waitUntil: "load" });
check(`首页：理念卡片 ${X.pillars.length} 个`, await page.locator(".pillar-card").count() === X.pillars.length);
check(`首页：闭环步骤 ${X.flow.length} 个`, await page.locator(".flow-step").count() === X.flow.length);
check(`首页：热门作品 ${hotCount} 张`, await page.locator(".work-card").count() === hotCount);
check(`首页：故事卡片 3 张`, await page.locator(".story-preview-card").count() === 3);
check(`首页：数据卡 ${X.stats.length} 个`, await page.locator(".stat-card").count() === X.stats.length);

/* ---------- 作品页：分类与搜索 ---------- */
await page.goto(url("works.html"), { waitUntil: "load" });
check(`作品页：分类按钮 ${X.categories.length} 个`, await page.locator(".chip").count() === X.categories.length);
await page.locator(`.chip[data-cat='${firstCat.id}']`).click();
await page.waitForTimeout(150);
check(`作品页：${firstCat.name} 分类 ${catWorkCount} 件`, await page.locator(".work-card").count() === catWorkCount);

await page.locator(".chip[data-cat='all']").click();
await page.locator("#worksSearch").fill(sampleNick);
await page.waitForTimeout(500);
check(`作品页：搜索作者「${sampleNick}」命中 ${nickWorkCount} 件`, await page.locator(".work-card").count() === nickWorkCount);

/* ---------- 详情页加购 ---------- */
await page.goto(url("detail.html?id=w01"), { waitUntil: "load" });
await page.evaluate(() => localStorage.removeItem("xingyu_cart_v1"));
await page.locator("#addCart").click();
await page.waitForTimeout(300);
const cart = await page.evaluate(() => JSON.parse(localStorage.getItem("xingyu_cart_v1") || "null"));
check("详情页：加购写入 localStorage", !!(cart && cart[0] && cart[0].id === "w01" && cart[0].qty === 1));
check("详情页：缩略图 3 个", await page.locator(".gallery-thumbs img").count() === 3);
check("详情页：相关作品 3 张", await page.locator("#relatedGrid .work-card").count() === 3);

/* ---------- 商城购物车与结算（离线演示分支） ---------- */
await page.goto(url("mall.html"), { waitUntil: "load" });
check(`商城：商品 ${workCount} 件`, await page.locator(".product-card").count() === workCount);
check("商城：购物车含 w01", await page.locator(".cart-item").count() === 1);
await page.locator(".add-cart[data-id='w02']").click();
await page.waitForTimeout(250);
check("商城：加购后 2 项", await page.locator(".cart-item").count() === 2);
await page.locator("#checkoutBtn").click();
await page.waitForTimeout(1600);
check("商城：结算后清空车", await page.locator(".cart-empty").count() === 1);

/* ---------- 故事页时间轴 ---------- */
await page.goto(url("stories.html"), { waitUntil: "load" });
check(`故事页：学生 ${studentCount} 位`, await page.locator(".student-story").count() === studentCount);
check(`故事页：时间轴节点 ${milestoneCount} 个`, await page.locator(".timeline-item").count() === milestoneCount);

/* ---------- 公益公开图表 ---------- */
await page.goto(url("public.html"), { waitUntil: "load" });
check(`公益公开：数据卡 ${X.transparency.summary.length} 个`, await page.locator(".trans-card").count() === X.transparency.summary.length);
check(`公益公开：环形图 ${X.transparency.income.items.length} 段`, await page.locator("#incomeDonut circle").count() === X.transparency.income.items.length);
check(`公益公开：支出条 ${X.transparency.expense.items.length} 条`, await page.locator(".bar-fill").count() === X.transparency.expense.items.length);
check(`公益公开：披露表 ${X.transparency.months.length} 行`, await page.locator("#monthRows tr").count() === X.transparency.months.length);

/* ---------- 加入我们表单 ---------- */
await page.goto(url("join.html"), { waitUntil: "load" });
check(`加入我们：角色卡 ${X.roles.length} 个`, await page.locator(".role-card").count() === X.roles.length);
await page.locator("#jfName").fill("测试者");
await page.locator("#jfContact").fill("13800000000");
await page.locator("input[name='jfPrivate']").check();
await page.locator("#joinForm button[type='submit']").click();
await page.waitForTimeout(400);
const toast = await page.locator("#toast").textContent();
check("加入我们：提交出现成功提示", String(toast).indexOf("提交成功") >= 0);

await browser.close();
console.log(failures === 0 ? "\n交互验证全部通过 ✅" : `\n${failures} 项交互异常 ⚠️`);
process.exit(failures === 0 ? 0 : 1);
