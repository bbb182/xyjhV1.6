/* ============================================================
   星语计划 · 数据库连接与初始化
   ------------------------------------------------------------
   使用 Node.js 内置 node:sqlite（Node >= 22.5），无需安装任何依赖。
   默认库文件：db/xingyu.db           可用环境变量 XY_DB 指定
   只读打开：XY_DB_READONLY=1         用于部署时锁定数据
   ============================================================ */

const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const DB_DIR = __dirname;
const DEFAULT_FILE = path.join(DB_DIR, "xingyu.db");

let _db = null;

function dbFile() {
  return process.env.XY_DB || DEFAULT_FILE;
}

function openDb() {
  if (_db) return _db;

  const file = dbFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });

  const readonly = process.env.XY_DB_READONLY === "1";
  // 注意：DatabaseSync 的第二个参数必须是对象，传 undefined 会抛错
  _db = readonly ? new DatabaseSync(file, { readOnly: true }) : new DatabaseSync(file);

  if (!readonly) {
    _db.exec("PRAGMA journal_mode = WAL;");
    _db.exec("PRAGMA foreign_keys = ON;");
    _db.exec("PRAGMA busy_timeout = 3000;");
    initSchema(_db);
  } else {
    _db.exec("PRAGMA foreign_keys = ON;");
  }
  return _db;
}

/* 建表：schema.sql 全部使用 IF NOT EXISTS，可重复执行 */
function initSchema(db) {
  const sql = fs.readFileSync(path.join(DB_DIR, "schema.sql"), "utf8");
  db.exec(sql);
}

/* ---------- 便捷封装 ---------- */
function all(sql, params) {
  const stmt = openDb().prepare(sql);
  return params ? stmt.all(...params) : stmt.all();
}

function get(sql, params) {
  const stmt = openDb().prepare(sql);
  return params ? stmt.get(...params) : stmt.get();
}

function run(sql, params) {
  const stmt = openDb().prepare(sql);
  return params ? stmt.run(...params) : stmt.run();
}

/* 事务：回调内抛错自动回滚 */
function tx(fn) {
  const db = openDb();
  db.exec("BEGIN");
  try {
    const result = fn(db);
    db.exec("COMMIT");
    return result;
  } catch (err) {
    try { db.exec("ROLLBACK"); } catch (e) { /* ignore */ }
    throw err;
  }
}

function closeDb() {
  if (_db) {
    try { _db.close(); } catch (e) { /* ignore */ }
    _db = null;
  }
}

/* 是否已有数据（用于判断是否需要 seed） */
function hasData() {
  try {
    const row = get("SELECT COUNT(*) AS n FROM works");
    return !!(row && row.n > 0);
  } catch (e) {
    return false;
  }
}

module.exports = {
  DB_DIR,
  dbFile,
  openDb,
  initSchema,
  all,
  get,
  run,
  tx,
  closeDb,
  hasData
};
