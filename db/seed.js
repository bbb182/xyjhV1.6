/* ============================================================
   星语计划 · 初始数据导入（seed）
   ------------------------------------------------------------
   把 js/data.js 里的内容导入数据库，保持「内容只有一处来源」。
   用法：
     node db/seed.js           幂等导入/更新（推荐）
     node db/seed.js --reset   先清空所有表再导入
     node db/seed.js --Stats   仅打印导入结果
   ============================================================ */

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { openDb, tx, closeDb } = require("./db");

const ROOT = path.join(__dirname, "..");
const DATA_FILE = path.join(ROOT, "js", "data.js");

/* ---------- 读取 js/data.js ---------- */
function loadSiteData() {
  const code = fs.readFileSync(DATA_FILE, "utf8");
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: "js/data.js" });
  const X = sandbox.window.XINGYU;
  if (!X || !Array.isArray(X.works)) {
    throw new Error("js/data.js 结构异常：未找到 window.XINGYU.works");
  }
  return X;
}

/* ---------- 金额/日期解析 ---------- */
function toNumber(text) {
  if (typeof text === "number") return text;
  const n = Number(String(text).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}
function toSigned(type, text) {
  // 支出存正数，方向由 type 决定
  return Math.abs(toNumber(text));
}
function dayToISO(monthText) {
  // "2026 年 5 月" -> "2026-05"
  const m = String(monthText).match(/(\d{4})\s*年\s*(\d{1,2})\s*月/);
  if (!m) return String(monthText);
  return m[1] + "-" + String(m[2]).padStart(2, "0");
}

/* ---------- 演示订单 / 资金 / 申请（后台原型数据） ---------- */
const DEMO_ORDERS = [
  { no: "XY20260825001", items: "金山蓝海 · 日月同辉 ×1", buyer: "林**", amount: "¥268", status: "待发货", time: "2026-08-25 14:32:00" },
  { no: "XY20260825002", items: "一叶知秋 · 银杏 ×2", buyer: "王**", amount: "¥336", status: "已完成", time: "2026-08-25 11:08:00" },
  { no: "XY20260824018", items: "归航 · 海与星 ×1", buyer: "陈**", amount: "¥68", status: "已发货", time: "2026-08-24 20:45:00" },
  { no: "XY20260824007", items: "双生郁金香 ×1", buyer: "赵**", amount: "¥138", status: "已完成", time: "2026-08-24 16:20:00" },
  { no: "XY20260823021", items: "清荷 · 莲心 ×1", buyer: "周**", amount: "¥158", status: "退款中", time: "2026-08-23 10:11:00" },
  { no: "XY20260822012", items: "春信 · 花枝 ×1", buyer: "吴**", amount: "¥78", status: "已完成", time: "2026-08-22 09:36:00" }
];

const DEMO_FUNDS = [
  { date: "2026-07-31", type: "income", item: "义卖季度结算", amount: "¥96,420", status: "已入账", note: "7 月掐丝珐琅作品义卖" },
  { date: "2026-07-20", type: "expense", item: "掐丝珐琅教学物料采购", amount: "¥52,300", status: "已核销", note: "太原市小店区特殊教育中心小学校" },
  { date: "2026-07-12", type: "income", item: "企业 LOGO 定制订单", amount: "¥48,000", status: "已入账", note: "企业 CSR 定制" },
  { date: "2026-07-05", type: "expense", item: "暖心纾困 · 家庭帮扶", amount: "¥18,420", status: "已核销", note: "6 户困难家庭补助" },
  { date: "2026-07-01", type: "expense", item: "公益捐赠（30% 定向）", amount: "¥8,892", status: "已核销", note: "中国残疾人福利基金会" }
];

const DEMO_REPORTS = [
  { name: "2026 年第二季度报告", period: "2026 Q2", status: "已发布", date: "2026-07-25" },
  { name: "2026 年第一季度报告", period: "2026 Q1", status: "已发布", date: "2026-04-20" },
  { name: "2025 年年度审计报告", period: "2025 全年", status: "已发布", date: "2026-03-15" },
  { name: "2026 年第三季度报告", period: "2026 Q3", status: "整理中", date: "预计 2026-10" }
];

const DEMO_APPLICATIONS = [
  { name: "李同学", contact: "138****2048", type: "志愿者报名", org: "山西应用科技学院", message: "希望参与掐丝珐琅课堂陪伴" },
  { name: "张女士", contact: "zhang@example.com", type: "企业合作", org: "某文创公司", message: "想定制一批年会礼品" },
  { name: "王老师", contact: "135****7712", type: "学校合作", org: "杏花岭区特教学校", message: "希望共建兴趣课堂" }
];

/* ---------- 清空 ---------- */
function reset(db) {
  const tables = [
    "order_items", "orders", "work_features", "works", "milestones", "students",
    "fund_records", "applications", "disclosure_reports", "monthly_ledger"
  ];
  for (const t of tables) db.exec("DELETE FROM " + t + ";");
  db.exec("DELETE FROM sqlite_sequence WHERE name IN ('order_items','orders','work_features','milestones','fund_records','applications','disclosure_reports');");
}

/* ---------- 导入 ---------- */
function seed({ isReset }) {
  const X = loadSiteData();
  const db = openDb();
  const stat = { students: 0, milestones: 0, works: 0, features: 0, months: 0, orders: 0, funds: 0, reports: 0, applications: 0 };

  tx(() => {
    if (isReset) reset(db);

    /* 学生 + 成长记录 */
    const insStudent = db.prepare(`
      INSERT INTO students (id, nick, age, city, direction, quote, bio, tags, avatar, c1, c2, status, sort_no)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
      ON CONFLICT(id) DO UPDATE SET
        nick=excluded.nick, age=excluded.age, city=excluded.city, direction=excluded.direction,
        quote=excluded.quote, bio=excluded.bio, tags=excluded.tags, avatar=excluded.avatar,
        c1=excluded.c1, c2=excluded.c2, sort_no=excluded.sort_no
    `);
    const delMilestones = db.prepare("DELETE FROM milestones WHERE student_id = ?");
    const insMilestone = db.prepare(
      "INSERT INTO milestones (student_id, occurred_on, title, description, sort_no) VALUES (?, ?, ?, ?, ?)"
    );

    X.students.forEach(function (s, sIndex) {
      insStudent.run(
        s.id, s.nick, s.age, s.city, s.direction || null, s.quote || null, s.bio || null,
        JSON.stringify(s.tags || []), s.avatar || null, s.c1 || null, s.c2 || null, sIndex
      );
      stat.students++;

      delMilestones.run(s.id);
      (s.milestones || []).forEach(function (m, i) {
        insMilestone.run(s.id, m.date, m.title, m.desc || null, i);
        stat.milestones++;
      });
    });

    /* 作品 + 特性 */
    const insWork = db.prepare(`
      INSERT INTO works (id, title, student_id, category, published_on, price, original_price,
                         stock, sales, likes, badge, cover, story_why, story_how, story_meaning, status, sort_no)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'on', ?)
      ON CONFLICT(id) DO UPDATE SET
        title=excluded.title, student_id=excluded.student_id, category=excluded.category,
        published_on=excluded.published_on, price=excluded.price, original_price=excluded.original_price,
        stock=excluded.stock, sales=excluded.sales, likes=excluded.likes, badge=excluded.badge,
        cover=excluded.cover, story_why=excluded.story_why, story_how=excluded.story_how,
        story_meaning=excluded.story_meaning, sort_no=excluded.sort_no
    `);
    const delFeatures = db.prepare("DELETE FROM work_features WHERE work_id = ?");
    const insFeature = db.prepare("INSERT INTO work_features (work_id, content, sort_no) VALUES (?, ?, ?)");

    X.works.forEach(function (w, wIndex) {
      insWork.run(
        w.id, w.title, w.studentId, w.category, w.date || null,
        toNumber(w.price), w.originalPrice == null ? null : toNumber(w.originalPrice),
        toNumber(w.stock), toNumber(w.sales), toNumber(w.likes), w.badge || null, w.cover,
        (w.story && w.story.why) || null, (w.story && w.story.how) || null, (w.story && w.story.meaning) || null,
        wIndex
      );
      stat.works++;

      delFeatures.run(w.id);
      (w.features || []).forEach(function (f, i) {
        insFeature.run(w.id, f, i);
        stat.features++;
      });
    });

    /* 月度账目 */
    const insMonth = db.prepare(`
      INSERT INTO monthly_ledger (month, income, expense, balance, note) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(month) DO UPDATE SET income=excluded.income, expense=excluded.expense,
        balance=excluded.balance, note=excluded.note
    `);
    for (const m of (X.transparency && X.transparency.months) || []) {
      insMonth.run(m.month, toNumber(m.income), toNumber(m.expense), toNumber(m.balance), m.note || null);
      stat.months++;
    }

    /* 演示订单（仅 reset 或首次导入时创建，避免覆盖真实订单） */
    const orderCount = db.prepare("SELECT COUNT(*) AS n FROM orders").get().n;
    if (isReset || orderCount === 0) {
      const insOrder = db.prepare(
        "INSERT OR REPLACE INTO orders (order_no, buyer_name, buyer_contact, amount, status, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      );
      const insItem = db.prepare(
        "INSERT INTO order_items (order_id, work_id, title, unit_price, qty) VALUES (?, ?, ?, ?, ?)"
      );
      for (const o of DEMO_ORDERS) {
        const amount = toNumber(o.amount);
        const parts = o.items.split("×");
        const title = parts[0].trim();
        const qty = Math.max(1, toNumber(parts[1] || 1));
        const work = X.works.find((w) => w.title === title) || null;
        const r = insOrder.run(o.no, o.buyer, null, amount, o.status, null, o.time);
        insItem.run(Number(r.lastInsertRowid), work ? work.id : null, title, amount / qty, qty);
        stat.orders++;
      }
    }

    /* 资金流水 */
    const fundCount = db.prepare("SELECT COUNT(*) AS n FROM fund_records").get().n;
    if (isReset || fundCount === 0) {
      const insFund = db.prepare(
        "INSERT INTO fund_records (occurred_on, type, item, amount, status, note) VALUES (?, ?, ?, ?, ?, ?)"
      );
      for (const f of DEMO_FUNDS) {
        insFund.run(f.date, f.type, f.item, toSigned(f.type, f.amount), f.status, f.note);
        stat.funds++;
      }
    }

    /* 披露报告 */
    const insReport = db.prepare(
      "INSERT INTO disclosure_reports (name, period, audit_status, published_on) VALUES (?, ?, ?, ?)"
    );
    const reportCount = db.prepare("SELECT COUNT(*) AS n FROM disclosure_reports").get().n;
    if (isReset || reportCount === 0) {
      for (const r of DEMO_REPORTS) { insReport.run(r.name, r.period, r.status, r.date); stat.reports++; }
    }

    /* 报名申请 */
    const appCount = db.prepare("SELECT COUNT(*) AS n FROM applications").get().n;
    if (isReset || appCount === 0) {
      const insApp = db.prepare(
        "INSERT INTO applications (name, contact, type, org, message, status) VALUES (?, ?, ?, ?, ?, '待审核')"
      );
      for (const a of DEMO_APPLICATIONS) { insApp.run(a.name, a.contact, a.type, a.org, a.message); stat.applications++; }
    }
  });

  return stat;
}

/* ---------- CLI ---------- */
if (require.main === module) {
  const args = process.argv.slice(2);
  const isReset = args.includes("--reset");
  try {
    const stat = seed({ isReset });
    const file = process.env.XY_DB || path.join(__dirname, "xingyu.db");
    console.log("星语计划 · 数据导入完成" + (isReset ? "（已重置）" : ""));
    console.log("  库文件：" + file);
    console.log("  学生 " + stat.students + " · 成长记录 " + stat.milestones +
                " · 作品 " + stat.works + " · 特性 " + stat.features);
    console.log("  月度账目 " + stat.months + " · 订单 " + stat.orders +
                " · 资金流水 " + stat.funds + " · 报告 " + stat.reports +
                " · 申请 " + stat.applications);
    closeDb();
  } catch (err) {
    console.error("导入失败：", err.message);
    process.exit(1);
  }
}

module.exports = { seed, loadSiteData };
