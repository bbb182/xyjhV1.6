/* ============================================================
   星语计划 · 数据库与接口验收脚本
   用法：node qa/verify-db.js
   ------------------------------------------------------------
   使用临时库文件运行，不会影响 db/xingyu.db。
   覆盖：建表、导入、顺序保持、订单事务与库存、金额服务端重算、
        申请校验、bootstrap 结构、HTTP 接口（起临时端口）。
   ============================================================ */

const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const { spawn } = require("child_process");

const ROOT = path.join(__dirname, "..");
const TEST_DB = path.join(os.tmpdir(), "xingyu-verify-" + Date.now() + ".db");
process.env.XY_DB = TEST_DB;

const db = require(path.join(ROOT, "db/db"));
const repo = require(path.join(ROOT, "db/repo"));
const { seed } = require(path.join(ROOT, "db/seed"));

const results = [];
function chk(name, pass, extra) {
  results.push([name, !!pass, extra]);
}
function throws(fn) {
  try { fn(); return null; } catch (e) { return e; }
}

/* ---------------- 1. 建表 + 导入 ---------------- */
const stat = seed({ isReset: true });

const tables = db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").map((r) => r.name);
const expectedTables = [
  "students", "milestones", "works", "work_features", "orders",
  "order_items", "fund_records", "applications", "disclosure_reports", "monthly_ledger"
];
chk("建表：" + expectedTables.length + " 张表齐全", expectedTables.every((t) => tables.indexOf(t) >= 0), tables.join(","));

chk("导入：学生 8 / 成长记录 32", stat.students === 8 && stat.milestones === 32, stat.students + "/" + stat.milestones);
chk("导入：作品 13 / 特性 52", stat.works === 13 && stat.features === 52, stat.works + "/" + stat.features);
chk("导入：月度账目 3 / 订单 6", stat.months === 3 && stat.orders === 6, stat.months + "/" + stat.orders);
chk("导入：资金 5 / 报告 4 / 申请 3", stat.funds === 5 && stat.reports === 4 && stat.applications === 3);

/* 幂等：重复执行行数不变 */
const again = seed({ isReset: false });
chk("重复导入幂等（学生数不变）", again.students === 8 && db.get("SELECT COUNT(*) AS n FROM students").n === 8);

/* ---------------- 2. 顺序保持 ---------------- */
const works = repo.listWorks({});
chk("作品编辑顺序保持（首页前 3 件）",
  works.slice(0, 3).map((w) => w.id).join(",") === "w01,w02,w03",
  works.slice(0, 3).map((w) => w.id).join(","));
chk("学生顺序保持 s1..s8", repo.listStudents().map((s) => s.id).join(",") === "s1,s2,s3,s4,s5,s6,s7,s8");

/* ---------------- 3. 数据同构（前端可直接消费） ---------------- */
const w1 = repo.getWork("w01");
chk("作品含嵌套 story 三段", !!(w1 && w1.story && w1.story.why && w1.story.how && w1.story.meaning));
chk("作品含特性数组 4 条", Array.isArray(w1.features) && w1.features.length === 4, String(w1.features.length));
const s1 = repo.getStudent("s1");
chk("学生含 tags 数组与 4 条里程碑", Array.isArray(s1.tags) && s1.tags.length === 3 && s1.milestones.length === 4);

/* ---------------- 4. 订单事务 ---------------- */
const before = repo.getWork("w06");
const order = repo.createOrder({ items: [{ id: "w06", qty: 2 }], buyerName: "测试", buyerContact: "13800000000" });
const after = repo.getWork("w06");
chk("下单生成订单号 XY+日期+序号", /^XY\d{11}$/.test(order.no), order.no);
chk("下单金额由服务端按单价计算", order.amountValue === Math.round(before.price * 2 * 100) / 100, String(order.amountValue));
chk("下单扣减库存", after.stock === before.stock - 2, before.stock + "→" + after.stock);
chk("下单累加销量", after.sales === before.sales + 2, before.sales + "→" + after.sales);
chk("订单明细落库", db.get("SELECT COUNT(*) AS n FROM order_items WHERE order_id = ?", [order.id]).n === 1);

/* 前端伪造价格无效 */
const forged = repo.createOrder({ items: [{ id: "w05", qty: 1, price: 1, unitPrice: 1 }] });
chk("伪造价格无效（以库价为准）", forged.amountValue === repo.getWork("w05").price, String(forged.amountValue));

/* 库存不足 → 抛错且不改库存 */
const stockBefore = repo.getWork("w01").stock;
const err = throws(() => repo.createOrder({ items: [{ id: "w01", qty: 99999 }] }));
chk("库存不足被拒绝", !!err && /库存不足/.test(err.message), err && err.message);
chk("拒绝后库存未被扣减", repo.getWork("w01").stock === stockBefore);

/* 不存在的作品 */
const err2 = throws(() => repo.createOrder({ items: [{ id: "w999", qty: 1 }] }));
chk("不存在作品被拒绝", !!err2 && /作品不存在/.test(err2.message));

/* 空订单 */
const err3 = throws(() => repo.createOrder({ items: [] }));
chk("空订单被拒绝", !!err3 && err3.statusCode === 400);

/* 订单状态流转 */
const updated = repo.updateOrderStatus(order.no, "已发货");
chk("订单状态可更新", updated && updated.status === "已发货");
chk("非法状态被拒绝", !!throws(() => repo.updateOrderStatus(order.no, "随便写")));

/* 爱心证书查询 */
const cert = repo.getOrderByNo(order.no);
chk("证书：可按订单号查询", !!(cert && cert.no === order.no));
chk("证书：捐赠额 = 订单金额 × 30%",
  !!cert && Math.abs(cert.donationValue - Math.round(cert.amountValue * 0.3 * 100) / 100) < 0.01,
  cert && cert.donation);
chk("证书：含受助儿童编号（匿名标注）", !!cert && /^[A-Z]\d+（匿名编号）$/.test(cert.beneficiary || ""), cert && cert.beneficiary);
chk("证书：含证书编号 AX-xxxxxx", !!cert && /^AX-\d{6}$/.test(cert.certificateNo), cert && cert.certificateNo);
chk("证书：订单不存在返回 null", repo.getOrderByNo("XY00000000000") === null);

/* ---------------- 5. 申请 ---------------- */
const app = repo.createApplication({ name: "测试同学", contact: "test@example.com", type: "志愿者报名" });
chk("申请写入并返回 id", !!(app && app.id > 0), app && String(app.id));
chk("申请默认状态为待审核", app.status === "待审核");
chk("缺联系方式被拒绝", !!throws(() => repo.createApplication({ name: "无联系方式", type: "志愿者报名" })));
chk("缺类型被拒绝", !!throws(() => repo.createApplication({ name: "a", contact: "b" })));
chk("申请状态可审核", repo.updateApplicationStatus(app.id, "已通过").status === "已通过");

/* ---------------- 6. 资金与账目 ---------------- */
const funds = repo.listFunds({});
chk("资金流水按日期倒序", funds.length === 5 && funds[0].date >= funds[4].date);
chk("资金金额含符号与千分位", /^[+-]¥/.test(funds[0].amount), funds[0].amount);
const sum = repo.sumFunds();
chk("收支汇总为数值字符串", /^¥/.test(sum.income) && /^¥/.test(sum.expense) && /^¥/.test(sum.balance), sum.balance);
chk("月度账目 3 条且含结余符号", repo.listMonthlyLedger().length === 3 && /^[+-]/.test(repo.listMonthlyLedger()[0].balance));

/* ---------------- 7. bootstrap ---------------- */
const { buildBootstrap } = require(path.join(ROOT, "server.js"));
const boot = buildBootstrap();
chk("bootstrap：按库顺序返回作品", boot.works.length === 13 && boot.works[0].id === "w01");
chk("bootstrap：学生来自库", boot.students.length === 8 && boot.students[0].id === "s1");
chk("bootstrap：月度账目来自库", Array.isArray(boot.transparency.months) && boot.transparency.months.length === 3);
chk("bootstrap：保留文案配置", !!(boot.site && boot.nav && boot.pillars && boot.flow && boot.roles && boot.partners));
chk("bootstrap：不再夹带 data.js 的旧作品/学生", typeof boot.site.name === "string" && boot.works[0].status === "on");

/* ---------------- 8. HTTP 接口 ---------------- */
const PORT = 8123 + Math.floor(Math.random() * 200);

function request(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      { host: "127.0.0.1", port: PORT, path: urlPath, method, headers: payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {} },
      (res) => {
        let text = "";
        res.on("data", (c) => { text += c; });
        res.on("end", () => {
          let json = null;
          try { json = JSON.parse(text); } catch (e) { /* 非 JSON */ }
          resolve({ status: res.statusCode, json, text });
        });
      }
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function waitHealthy(tries) {
  return request("GET", "/api/health")
    .then((r) => (r.status === 200 ? r : Promise.reject(new Error("未就绪"))))
    .catch(() => (tries <= 1 ? Promise.reject(new Error("服务未启动")) : new Promise((res) => setTimeout(res, 150)).then(() => waitHealthy(tries - 1))));
}

async function httpSuite() {
  const child = spawn(process.execPath, [path.join(ROOT, "server.js")], {
    cwd: ROOT,
    env: Object.assign({}, process.env, { XY_PORT: String(PORT), XY_DB: TEST_DB }),
    stdio: "ignore" // 避免占用管道
  });

  try {
    await waitHealthy(40);

    const health = await request("GET", "/api/health");
    chk("HTTP /api/health 200 且已导入", health.status === 200 && health.json.seeded === true && health.json.counts.works === 13);

    const bootRes = await request("GET", "/api/bootstrap");
    chk("HTTP /api/bootstrap 返回全站数据", bootRes.status === 200 && bootRes.json.works.length === 13 && !!bootRes.json.site);

    const worksRes = await request("GET", "/api/works?category=intangible&limit=3");
    chk("HTTP /api/works 支持分类与条数", worksRes.status === 200 && worksRes.json.length === 3 && worksRes.json.every((w) => w.category === "intangible"));

    const search = await request("GET", "/api/works?q=" + encodeURIComponent("银杏"));
    chk("HTTP /api/works 支持搜索", search.status === 200 && search.json.length >= 1);

    const detail = await request("GET", "/api/works/w01");
    chk("HTTP /api/works/:id 返回详情", detail.status === 200 && detail.json.id === "w01" && detail.json.features.length === 4);
    const missing = await request("GET", "/api/works/w999");
    chk("HTTP 不存在的作品返回 404", missing.status === 404);

    const students = await request("GET", "/api/students");
    chk("HTTP /api/students 返回 8 人", students.status === 200 && students.json.length === 8);

    const created = await request("POST", "/api/orders", { items: [{ id: "w02", qty: 1 }], buyerName: "接口测试" });
    chk("HTTP POST /api/orders 返回 201", created.status === 201 && /^XY/.test(created.json.no), created.json && created.json.no);

    const badOrder = await request("POST", "/api/orders", { items: [{ id: "w999", qty: 1 }] });
    chk("HTTP 非法作品下单返回 400", badOrder.status === 400 && /不存在/.test(badOrder.json.error || ""));

    const certRes = await request("GET", "/api/orders/XY20260825001");
    chk("HTTP 证书查询返回订单与捐赠额", certRes.status === 200 && /^¥/.test(certRes.json.donation || "") && !!certRes.json.certificateNo);
    const cert404 = await request("GET", "/api/orders/XY00000000000");
    chk("HTTP 证书查询不存在订单返回 404", cert404.status === 404);

    const appRes = await request("POST", "/api/applications", { name: "接口同学", contact: "api@example.com", type: "企业合作" });
    chk("HTTP POST /api/applications 返回 201", appRes.status === 201 && appRes.json.id > 0);

    const badApp = await request("POST", "/api/applications", { name: "" });
    chk("HTTP 缺字段申请返回 400", badApp.status === 400);

    const dash = await request("GET", "/api/dashboard");
    chk("HTTP /api/dashboard 字段完整", dash.status === 200 && typeof dash.json.worksOnSale === "number" && typeof dash.json.monthSales === "string");

    const fundsRes = await request("GET", "/api/funds");
    chk("HTTP /api/funds 含汇总", fundsRes.status === 200 && !!fundsRes.json.summary && Array.isArray(fundsRes.json.records));

    const unknown = await request("GET", "/api/nope");
    chk("HTTP 未知接口返回 404", unknown.status === 404);

    const dbBlocked = await request("GET", "/db/xingyu.db");
    chk("HTTP 禁止直接下载数据库文件", dbBlocked.status === 403 || dbBlocked.status === 404, String(dbBlocked.status));

    const page = await request("GET", "/index.html");
    chk("HTTP 首页可访问且引入 api.js", page.status === 200 && page.text.indexOf("js/api.js") >= 0);
  } finally {
    child.kill();
  }
}

httpSuite()
  .then(() => {
    /* ---------------- 输出 ---------------- */
    const pad = (s) => s + " ".repeat(Math.max(0, 40 - [...s].reduce((n, ch) => n + (ch.charCodeAt(0) > 255 ? 2 : 1), 0)));
    results.forEach(([name, pass, extra]) => {
      console.log((pass ? "[PASS] " : "[FAIL] ") + pad(name) + (pass ? "" : (extra || "")));
    });
    const failed = results.filter((r) => !r[1]).length;
    console.log("\n数据库验收：" + (results.length - failed) + "/" + results.length + " 通过" + (failed ? "，FAILED " + failed : ""));

    db.closeDb();
    for (const suffix of ["", "-wal", "-shm"]) {
      try { fs.unlinkSync(TEST_DB + suffix); } catch (e) { /* ignore */ }
    }
    process.exit(failed ? 1 : 0);
  })
  .catch((err) => {
    console.error("验收中断：", err.message);
    try { db.closeDb(); } catch (e) {}
    process.exit(1);
  });
