/* ============================================================
   星语计划 · 数据访问层（Repository）
   ------------------------------------------------------------
   职责：把数据库行映射成与 js/data.js 完全同构的对象，
   前端页面无需改动即可直接消费（story / features / milestones 等嵌套结构保持不变）。
   ============================================================ */

const { all, get, run, tx } = require("./db");

/* ---------- 格式化 ---------- */
function money(n) {
  const v = Math.round(Number(n) * 100) / 100;
  const s = v.toFixed(2).replace(/\.00$/, "").replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,");
  return "¥" + s;
}
function safeJSON(text, fallback) {
  try { return JSON.parse(text); } catch (e) { return fallback; }
}

/* ---------- 作品 ---------- */
function mapWork(row, features) {
  return {
    id: row.id,
    title: row.title,
    studentId: row.student_id,
    category: row.category,
    date: row.published_on,
    price: row.price,
    originalPrice: row.original_price,
    stock: row.stock,
    sales: row.sales,
    likes: row.likes,
    badge: row.badge,
    cover: row.cover,
    story: {
      why: row.story_why || "",
      how: row.story_how || "",
      meaning: row.story_meaning || ""
    },
    features: features || [],
    status: row.status
  };
}

function listWorks(opts) {
  const o = opts || {};
  const where = [];
  const params = [];
  if (!o.includeOff) where.push("w.status = 'on'");
  if (o.category && o.category !== "all") { where.push("w.category = ?"); params.push(o.category); }
  if (o.studentId) { where.push("w.student_id = ?"); params.push(o.studentId); }
  if (o.q) {
    where.push("(w.title LIKE ? OR s.nick LIKE ? OR w.category LIKE ?)");
    const like = "%" + o.q + "%";
    params.push(like, like, like);
  }
  const sql =
    "SELECT w.* FROM works w JOIN students s ON s.id = w.student_id" +
    (where.length ? " WHERE " + where.join(" AND ") : "") +
    " ORDER BY " + sortClause(o.sort) +
    (o.limit ? " LIMIT " + Math.max(1, Number(o.limit)) : "");

  const rows = all(sql, params);
  const featureMap = featuresByWork(rows.map((r) => r.id));
  return rows.map((r) => mapWork(r, featureMap[r.id] || []));
}

function sortClause(sort) {
  switch (sort) {
    case "priceAsc": return "w.price ASC";
    case "priceDesc": return "w.price DESC";
    case "sales": return "w.sales DESC";
    case "latest": return "w.published_on DESC, w.sort_no ASC";
    // 默认：保持 js/data.js 的编辑顺序（首页取前 6 件依赖此顺序）
    default: return "w.sort_no ASC, w.id ASC";
  }
}

function featuresByWork(ids) {
  if (!ids.length) return {};
  const marks = ids.map(() => "?").join(",");
  const rows = all(
    "SELECT work_id, content FROM work_features WHERE work_id IN (" + marks + ") ORDER BY work_id, sort_no",
    ids
  );
  const map = {};
  rows.forEach((r) => { (map[r.work_id] = map[r.work_id] || []).push(r.content); });
  return map;
}

function getWork(id) {
  const row = get("SELECT * FROM works WHERE id = ?", [id]);
  if (!row) return null;
  const features = all("SELECT content FROM work_features WHERE work_id = ? ORDER BY sort_no", [id]).map((r) => r.content);
  return mapWork(row, features);
}

/* ---------- 学生 ---------- */
function milestonesByStudent(ids) {
  if (!ids.length) return {};
  const marks = ids.map(() => "?").join(",");
  const rows = all(
    "SELECT * FROM milestones WHERE student_id IN (" + marks + ") ORDER BY student_id, sort_no",
    ids
  );
  const map = {};
  rows.forEach((r) => {
    (map[r.student_id] = map[r.student_id] || []).push({
      date: r.occurred_on,
      title: r.title,
      desc: r.description || ""
    });
  });
  return map;
}

function listStudents() {
  const rows = all("SELECT * FROM students ORDER BY sort_no, id");
  const map = milestonesByStudent(rows.map((r) => r.id));
  return rows.map((r) => ({
    id: r.id,
    nick: r.nick,
    age: r.age,
    city: r.city,
    direction: r.direction || "",
    quote: r.quote || "",
    bio: r.bio || "",
    tags: safeJSON(r.tags, []),
    avatar: r.avatar || "",
    c1: r.c1 || "",
    c2: r.c2 || "",
    milestones: map[r.id] || []
  }));
}

function getStudent(id) {
  return listStudents().filter((s) => s.id === id)[0] || null;
}

/* ---------- 订单 ---------- */
function mapOrder(row, items) {
  return {
    id: row.id,
    no: row.order_no,
    buyer: row.buyer_name || "",
    contact: row.buyer_contact || "",
    amount: money(row.amount),
    amountValue: row.amount,
    status: row.status,
    note: row.note || "",
    time: formatTime(row.created_at),
    createdAt: row.created_at,
    items: items || []
  };
}

function formatTime(text) {
  // "2026-08-25 14:32:00" -> "08-25 14:32"
  const m = String(text || "").match(/^\d{4}-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  return m ? m[1] + "-" + m[2] + " " + m[3] + ":" + m[4] : String(text || "");
}

function itemsByOrder(ids) {
  if (!ids.length) return {};
  const marks = ids.map(() => "?").join(",");
  const rows = all(
    "SELECT * FROM order_items WHERE order_id IN (" + marks + ") ORDER BY id",
    ids
  );
  const map = {};
  rows.forEach((r) => {
    (map[r.order_id] = map[r.order_id] || []).push({
      workId: r.work_id,
      title: r.title,
      unitPrice: r.unit_price,
      qty: r.qty
    });
  });
  return map;
}

function listOrders(opts) {
  const o = opts || {};
  const where = [];
  const params = [];
  if (o.status) { where.push("status = ?"); params.push(o.status); }
  const rows = all(
    "SELECT * FROM orders" + (where.length ? " WHERE " + where.join(" AND ") : "") +
    " ORDER BY created_at DESC, id DESC" + (o.limit ? " LIMIT " + Math.max(1, Number(o.limit)) : ""),
    params
  );
  const map = itemsByOrder(rows.map((r) => r.id));
  return rows.map((r) => {
    const items = map[r.id] || [];
    const order = mapOrder(r, items);
    order.itemText = items.map((it) => it.title + " ×" + it.qty).join("、");
    return order;
  });
}

function nextOrderNo(db) {
  const d = new Date();
  const ymd = d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
  const prefix = "XY" + ymd;
  for (let i = 1; i < 1000; i++) {
    const no = prefix + String(i).padStart(3, "0");
    const hit = db.prepare("SELECT 1 FROM orders WHERE order_no = ?").get(no);
    if (!hit) return no;
  }
  throw new Error("当日订单号已用尽");
}

/**
 * 创建订单：价格与库存以数据库为准，不接受前端传入金额
 * @param {{buyerName?:string, buyerContact?:string, items:{id:string, qty:number}[], note?:string}} payload
 */
function createOrder(payload) {
  const items = Array.isArray(payload.items) ? payload.items : [];
  if (!items.length) throw badRequest("订单不能为空");

  return tx((db) => {
    const workStmt = db.prepare("SELECT * FROM works WHERE id = ?");
    const prepared = [];
    let amount = 0;

    for (const it of items) {
      const qty = Math.max(1, Number(it.qty) || 1);
      const w = workStmt.get(String(it.id || ""));
      if (!w) throw badRequest("作品不存在：" + it.id);
      if (w.status !== "on") throw badRequest("作品已下架：" + w.title);
      if (w.stock < qty) throw badRequest("库存不足：" + w.title);
      prepared.push({ work: w, qty });
      amount += w.price * qty;
    }

    const no = nextOrderNo(db);
    const r = db.prepare(
      "INSERT INTO orders (order_no, buyer_name, buyer_contact, amount, status, note) VALUES (?, ?, ?, ?, '待发货', ?)"
    ).run(no, payload.buyerName || null, payload.buyerContact || null, Math.round(amount * 100) / 100, payload.note || null);
    const orderId = Number(r.lastInsertRowid);

    const insItem = db.prepare(
      "INSERT INTO order_items (order_id, work_id, title, unit_price, qty) VALUES (?, ?, ?, ?, ?)"
    );
    const updWork = db.prepare("UPDATE works SET stock = stock - ?, sales = sales + ? WHERE id = ?");

    for (const p of prepared) {
      insItem.run(orderId, p.work.id, p.work.title, p.work.price, p.qty);
      updWork.run(p.qty, p.qty, p.work.id);
    }

    const row = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId);
    const its = db.prepare("SELECT * FROM order_items WHERE order_id = ? ORDER BY id").all(orderId);
    const order = mapOrder(row, its.map((x) => ({ workId: x.work_id, title: x.title, unitPrice: x.unit_price, qty: x.qty })));
    order.itemText = its.map((x) => x.title + " ×" + x.qty).join("、");
    return order;
  });
}

function updateOrderStatus(orderNo, status) {
  const allowed = ["待发货", "已发货", "已完成", "退款中"];
  if (allowed.indexOf(status) < 0) throw badRequest("非法订单状态：" + status);
  const r = run("UPDATE orders SET status = ? WHERE order_no = ?", [status, orderNo]);
  if (!r.changes) throw notFound("订单不存在：" + orderNo);
  return listOrders({}).filter((o) => o.no === orderNo)[0];
}

/**
 * 按订单号取单张订单（爱心证书查询用）
 * 额外返回：公益捐赠额（订单金额 × 30%）、受助儿童编号
 */
function getOrderByNo(no) {
  const row = get("SELECT * FROM orders WHERE order_no = ?", [String(no || "").trim()]);
  if (!row) return null;

  const rawItems = all("SELECT * FROM order_items WHERE order_id = ? ORDER BY id", [row.id]);
  const items = rawItems.map((x) => ({
    workId: x.work_id,
    title: x.title,
    unitPrice: x.unit_price,
    qty: x.qty,
    subtotal: Math.round(x.unit_price * x.qty * 100) / 100
  }));

  // 受助儿童编号：取订单第一件作品对应的学生（匿名 ID 大写），查不到则留空
  let beneficiary = "";
  if (rawItems.length && rawItems[0].work_id) {
    const st = get("SELECT student_id FROM works WHERE id = ?", [rawItems[0].work_id]);
    if (st && st.student_id) beneficiary = String(st.student_id).toUpperCase();
  }

  const order = mapOrder(row, items);
  order.itemText = items.map((it) => it.title + " ×" + it.qty).join("、");
  order.donationValue = Math.round(row.amount * 0.3 * 100) / 100;
  order.donation = money(order.donationValue);
  order.beneficiary = beneficiary ? beneficiary + "（匿名编号）" : "";
  order.certificateNo = "AX-" + String(row.id).padStart(6, "0");
  return order;
}

/* ---------- 资金流水 ---------- */
function listFunds(opts) {
  const o = opts || {};
  const rows = all(
    "SELECT * FROM fund_records ORDER BY occurred_on DESC, id DESC" + (o.limit ? " LIMIT " + Math.max(1, Number(o.limit)) : "")
  );
  return rows.map((r) => ({
    id: r.id,
    date: r.occurred_on,
    type: r.type === "income" ? "收入" : "支出",
    typeCode: r.type,
    item: r.item,
    amount: (r.type === "income" ? "+" : "-") + money(r.amount),
    amountValue: r.type === "income" ? r.amount : -r.amount,
    status: r.status || "",
    note: r.note || ""
  }));
}

function sumFunds() {
  const row = get(
    "SELECT " +
    "COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END),0) AS income, " +
    "COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END),0) AS expense FROM fund_records"
  );
  return {
    income: money(row.income),
    expense: money(row.expense),
    incomeValue: row.income,
    expenseValue: row.expense,
    balance: money(row.income - row.expense)
  };
}

/* ---------- 报名 / 合作申请 ---------- */
function createApplication(payload) {
  const name = String(payload.name || "").trim();
  const contact = String(payload.contact || "").trim();
  const type = String(payload.type || "").trim();
  if (!name) throw badRequest("请填写称呼");
  if (!contact) throw badRequest("请填写联系方式");
  if (!type) throw badRequest("请选择参与类型");
  const r = run(
    "INSERT INTO applications (name, contact, type, org, message, status) VALUES (?, ?, ?, ?, ?, '待审核')",
    [name, contact, type, payload.org ? String(payload.org).trim() : null, payload.message ? String(payload.message).trim() : null]
  );
  return get("SELECT * FROM applications WHERE id = ?", [Number(r.lastInsertRowid)]);
}

function listApplications(opts) {
  const o = opts || {};
  const where = [];
  const params = [];
  if (o.status) { where.push("status = ?"); params.push(o.status); }
  return all(
    "SELECT * FROM applications" + (where.length ? " WHERE " + where.join(" AND ") : "") +
    " ORDER BY created_at DESC, id DESC" + (o.limit ? " LIMIT " + Math.max(1, Number(o.limit)) : ""),
    params
  ).map((r) => ({
    id: r.id,
    name: r.name,
    contact: r.contact,
    type: r.type,
    org: r.org || "",
    message: r.message || "",
    status: r.status,
    createdAt: r.created_at
  }));
}

function updateApplicationStatus(id, status) {
  const allowed = ["待审核", "已通过", "已拒绝"];
  if (allowed.indexOf(status) < 0) throw badRequest("非法申请状态：" + status);
  const r = run("UPDATE applications SET status = ? WHERE id = ?", [status, Number(id)]);
  if (!r.changes) throw notFound("申请不存在：" + id);
  return listApplications({}).filter((a) => a.id === Number(id))[0];
}

/* ---------- 披露报告 / 月度账目 ---------- */
function listReports() {
  return all("SELECT * FROM disclosure_reports ORDER BY id").map((r) => ({
    id: r.id,
    name: r.name,
    period: r.period,
    status: r.audit_status,
    date: r.published_on || ""
  }));
}

function listMonthlyLedger() {
  return all("SELECT * FROM monthly_ledger ORDER BY month").map((r) => ({
    month: r.month,
    income: money(r.income),
    expense: money(r.expense),
    balance: (r.balance >= 0 ? "+" : "-") + money(Math.abs(r.balance)),
    note: r.note || ""
  }));
}

/* ---------- 后台汇总 ---------- */
function dashboard() {
  const workCount = get("SELECT COUNT(*) AS n FROM works WHERE status='on'").n;
  const pendingApps = get("SELECT COUNT(*) AS n FROM applications WHERE status='待审核'").n;
  const orderCount = get("SELECT COUNT(*) AS n FROM orders").n;
  const monthSales = get(
    "SELECT COALESCE(SUM(amount),0) AS s FROM orders WHERE substr(created_at,1,7) = strftime('%Y-%m','now','localtime')"
  ).s;
  return {
    worksOnSale: workCount,
    pendingApplications: pendingApps,
    orders: orderCount,
    monthSales: money(monthSales),
    funds: sumFunds()
  };
}

/* ---------- 错误 ---------- */
function badRequest(msg) {
  const e = new Error(msg);
  e.statusCode = 400;
  return e;
}
function notFound(msg) {
  const e = new Error(msg);
  e.statusCode = 404;
  return e;
}

module.exports = {
  money,
  listWorks,
  getWork,
  listStudents,
  getStudent,
  listOrders,
  createOrder,
  updateOrderStatus,
  getOrderByNo,
  listFunds,
  sumFunds,
  createApplication,
  listApplications,
  updateApplicationStatus,
  listReports,
  listMonthlyLedger,
  dashboard
};
