/* ============================================================
   星语计划 · 自动化质检脚本
   用法（在本机 Chrome 上）：
     node qa/check.mjs
   会依次打开 9 个页面 × 桌面/手机两种尺寸，
   检查横向溢出、图片加载、JS 报错，并截图到 _preview/。
   ============================================================ */
import { createRequire } from "module";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

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

const pages = [
  ["index", "index.html?qa=1"],
  ["works", "works.html?qa=1"],
  ["detail", "detail.html?id=w01&qa=1"],
  ["mall", "mall.html?qa=1"],
  ["stories", "stories.html?qa=1"],
  ["about", "about.html?qa=1"],
  ["public", "public.html?qa=1"],
  ["join", "join.html?qa=1"],
  ["certificate", "certificate.html?qa=1"],
  ["admin", "admin.html?qa=1"]
];

const viewports = [
  ["desktop", 1440, 900],
  ["mobile", 390, 844]
];

const outDir = path.join(root, "_preview");
fs.mkdirSync(outDir, { recursive: true });

const browser = await pw.chromium.launch({
  executablePath: chromePath,
  headless: true,
  args: ["--disable-features=LazyImageLoading"]
});

let failed = 0;

for (const [name, url] of pages) {
  for (const [vp, w, h] of viewports) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const consoleErrors = [];
    page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
    page.on("pageerror", (err) => consoleErrors.push(String(err)));

    const target = "file:///" + path.join(root, url).replace(/\\/g, "/");
    await page.goto(target, { waitUntil: "load", timeout: 20000 }).catch((e) => {
      consoleErrors.push("goto failed: " + e.message);
    });

    // 等待 QA 报告生成（页面加载期错误收集）
    try {
      await page.waitForSelector("#qa-report", { timeout: 8000, state: "attached" });
      await page.waitForFunction(() => document.getElementById("qa-report").textContent.length > 10, { timeout: 8000 });
    } catch (e) {
      consoleErrors.push("qa-report missing: " + e.message);
    }

    // 滚动整页，触发懒加载图片
    await page.evaluate(async () => {
      const step = 400;
      for (let y = 0; y <= document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 50));
      }
      window.scrollTo(0, 0);
    });

    // 等待全部图片加载完成（含懒加载）
    try {
      await page.waitForFunction(
        () => Array.from(document.images).every((im) => im.complete && im.naturalWidth > 0),
        { timeout: 8000 }
      );
    } catch (e) {
      // 超时后仍按实际状态统计
    }
    await page.waitForTimeout(2500);

    // 重新统计：溢出 / 越界元素 / 破损图片
    const report = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const inScrollable = (el) => {
        let p = el.parentElement;
        while (p && p !== document.body) {
          const o = getComputedStyle(p).overflowX;
          if (o === "auto" || o === "scroll" || o === "overlay") return true;
          p = p.parentElement;
        }
        return false;
      };
      const offenders = Array.from(document.querySelectorAll("body *")).filter((el) => {
        const r = el.getBoundingClientRect();
        return r.right > vw + 2 && el.offsetWidth > 0 && getComputedStyle(el).position !== "fixed" && !inScrollable(el);
      }).slice(0, 12).map((el) => el.tagName + "." + (el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className) + " right=" + Math.round(el.getBoundingClientRect().right));
      const brokenImgs = Array.from(document.querySelectorAll("img")).filter((im) => !im.complete || im.naturalWidth === 0).map((im) => im.getAttribute("src"));
      return {
        overflow: document.documentElement.scrollWidth > vw + 2,
        offenders: offenders,
        brokenImgs: brokenImgs,
        imgs: document.querySelectorAll("img").length
      };
    });

    await page.screenshot({ path: path.join(outDir, `${name}-${vp}.png`), fullPage: false });

    const broken = (report && report.brokenImgs && report.brokenImgs.length) || 0;
    const overflow = report ? report.overflow : "N/A";
    const offenders = report ? (report.offenders || []) : [];
    const jsErr = consoleErrors.filter((m) => m.indexOf("favicon") < 0);
    const status = (overflow === false && broken === 0 && jsErr.length === 0) ? "OK" : "!!";
    if (status !== "OK") failed++;

    console.log(
      `[${status}] ${name} @ ${vp}(${w}) ` +
      `overflow=${overflow} brokenImgs=${broken} jsErrors=${jsErr.length} ` +
      (offenders.length ? "offenders=" + JSON.stringify(offenders.slice(0, 4)) : "")
    );
    if (broken) console.log("   brokenImgs:", report.brokenImgs.join(", "));
    if (jsErr.length) console.log("   jsErrors:", jsErr.slice(0, 5).join(" | "));
    if (report && report.worksRendered !== undefined) console.log("   worksRendered:", report.worksRendered, "imgs:", report.imgs);
    await ctx.close();
  }
}

await browser.close();
console.log(failed === 0 ? "\n全部页面检查通过 ✅" : `\n共 ${failed} 项异常，请查看上方报告 ⚠️`);
