/* ============================================================
   星语计划 · 数据库结构（SQLite 3）
   ------------------------------------------------------------
   设计原则：
   1. 「记录型」数据入库 —— 学生、成长记录、作品、订单、资金流水、
      报名申请、披露报告、月度账目；
   2. 「文案型」配置仍留在 js/data.js —— 站点信息、导航、理念卡、
      闭环步骤、团队顾问等，属于编辑内容而非业务记录，
      改文案不需要动库，符合「改内容只动一个文件」的既有约定；
   3. 所有金额用 REAL 存储（单位：元），展示时由 db/repo.js 格式化；
   4. 多值字段（学生标签 tags、作品特性 features）拆表或存 JSON。
   ============================================================ */

PRAGMA foreign_keys = ON;

/* ---------- 学生（匿名档案） ---------- */
CREATE TABLE IF NOT EXISTS students (
  id           TEXT PRIMARY KEY,               -- s1 / s2 ...
  nick         TEXT NOT NULL,                  -- 展示用姓名（已获监护人授权）
  age          INTEGER NOT NULL CHECK (age BETWEEN 6 AND 30),
  city         TEXT NOT NULL,
  direction    TEXT,                           -- 兴趣方向
  quote        TEXT,
  bio          TEXT,
  tags         TEXT,                           -- JSON 数组字符串
  avatar       TEXT,
  c1           TEXT,                           -- 卡片渐变色 1
  c2           TEXT,                           -- 卡片渐变色 2
  status       TEXT NOT NULL DEFAULT 'active', -- active / graduated
  sort_no      INTEGER NOT NULL DEFAULT 0,     -- 保持 js/data.js 中的编辑顺序
  created_at   TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

/* ---------- 成长记录（一人一档的时间轴） ---------- */
CREATE TABLE IF NOT EXISTS milestones (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id   TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  occurred_on  TEXT NOT NULL,                  -- 2026.01
  title        TEXT NOT NULL,
  description  TEXT,
  sort_no      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_milestones_student ON milestones(student_id, sort_no);

/* ---------- 作品 ---------- */
CREATE TABLE IF NOT EXISTS works (
  id             TEXT PRIMARY KEY,             -- w01 / w02 ...
  title          TEXT NOT NULL,
  student_id     TEXT NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  category       TEXT NOT NULL,                -- intangible / culture / collection ...
  published_on   TEXT,                         -- 2026.01
  price          REAL NOT NULL CHECK (price >= 0),
  original_price REAL,
  stock          INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  sales          INTEGER NOT NULL DEFAULT 0 CHECK (sales >= 0),
  likes          INTEGER NOT NULL DEFAULT 0 CHECK (likes >= 0),
  badge          TEXT,
  cover          TEXT NOT NULL,                -- 相对路径 images/works/...
  story_why      TEXT,                         -- 创作缘由
  story_how      TEXT,                         -- 制作工序
  story_meaning  TEXT,                         -- 作品意义
  status         TEXT NOT NULL DEFAULT 'on',   -- on 上架 / off 下架
  sort_no        INTEGER NOT NULL DEFAULT 0,   -- 保持 js/data.js 中的展示顺序
  created_at     TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_works_student  ON works(student_id);
CREATE INDEX IF NOT EXISTS idx_works_category ON works(category, status);

/* ---------- 作品特性（工艺说明，一行一条） ---------- */
CREATE TABLE IF NOT EXISTS work_features (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id  TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  content  TEXT NOT NULL,
  sort_no  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_features_work ON work_features(work_id, sort_no);

/* ---------- 订单 ---------- */
CREATE TABLE IF NOT EXISTS orders (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no      TEXT NOT NULL UNIQUE,          -- XY20261105001
  buyer_name    TEXT,
  buyer_contact TEXT,
  amount        REAL NOT NULL DEFAULT 0 CHECK (amount >= 0),
  status        TEXT NOT NULL DEFAULT '待发货', -- 待发货/已发货/已完成/退款中
  note          TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status, created_at);

/* ---------- 订单明细（下单时快照标题与单价） ---------- */
CREATE TABLE IF NOT EXISTS order_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  work_id    TEXT REFERENCES works(id) ON DELETE SET NULL,
  title      TEXT NOT NULL,
  unit_price REAL NOT NULL CHECK (unit_price >= 0),
  qty        INTEGER NOT NULL CHECK (qty > 0)
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

/* ---------- 资金流水 ---------- */
CREATE TABLE IF NOT EXISTS fund_records (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  occurred_on TEXT NOT NULL,                   -- 2026-07-31
  type        TEXT NOT NULL CHECK (type IN ('income','expense')),
  item        TEXT NOT NULL,
  amount      REAL NOT NULL CHECK (amount >= 0), -- 恒为正，方向由 type 决定
  status      TEXT,                            -- 已入账 / 已核销
  note        TEXT
);
CREATE INDEX IF NOT EXISTS idx_funds_date ON fund_records(occurred_on);

/* ---------- 报名 / 合作申请 ---------- */
CREATE TABLE IF NOT EXISTS applications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  contact    TEXT NOT NULL,
  type       TEXT NOT NULL,                    -- 志愿者报名 / 企业合作 ...
  org        TEXT,
  message    TEXT,
  status     TEXT NOT NULL DEFAULT '待审核',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status, created_at);

/* ---------- 披露报告 ---------- */
CREATE TABLE IF NOT EXISTS disclosure_reports (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL,
  period       TEXT NOT NULL,
  audit_status TEXT NOT NULL DEFAULT '整理中', -- 已发布 / 整理中
  published_on TEXT
);

/* ---------- 月度账目（公益公开页的收支明细表） ---------- */
CREATE TABLE IF NOT EXISTS monthly_ledger (
  month   TEXT PRIMARY KEY,                    -- 2026 年 5 月
  income  REAL NOT NULL DEFAULT 0,
  expense REAL NOT NULL DEFAULT 0,
  balance REAL NOT NULL DEFAULT 0,
  note    TEXT
);
