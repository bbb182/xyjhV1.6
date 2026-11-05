/* ============================================================
   星语计划 · 本地服务器（静态站点 + REST API + SQLite）
   ------------------------------------------------------------
   运行：node server.js          默认 http://localhost:8080
   环境变量：
     XY_PORT=8080      端口
     XY_DB=...         数据库文件路径（默认 db/xingyu.db）
     XY_DB_READONLY=1  只读模式（部署时锁定数据）
   首次启动若数据库为空，会自动从 js/data.js 导入初始数据。
   ============================================================ */

const http = require("http");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const db = require("./db/db");
const repo = require("./db/repo");

const root = __dirname;
const port = Number(process.env.XY_PORT) || 8080;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".sql": "text/plain; charset=utf-8"
};

/* ============================================================
   一、静态文案（js/data.js）—— 缓存 + 文件变更自动重载
   ============================================================ */
const DATA_FILE = path.join(root, "js", "data.js");
let dataCache = { mtime: 0, value: null };

function loadSiteConfig() {
  let stat;
  try {
    stat = fs.statSync(DATA_FILE);
  } catch (e) {
    throw new Error("找不到 js/data.js");
  }
  if (dataCache.value && dataCache.mtime === stat.mtimeMs) return dataCache.value;

  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(DATA_FILE, "utf8"), sandbox, { filename: "js/data.js" });
  const X = sandbox.window.XINGYU;
  if (!X) throw new Error("js/data.js 未导出 window.XINGYU");

  // 记录型数据以数据库为准，这里只保留文案型配置
  const source = Object.assign({}, X);
  delete source.works;
  delete source.students;
  if (source.transparency) {
    source.transparency = Object.assign({}, source.transparency);
    delete source.transparency.months;
  }

  dataCache = { mtime: stat.mtimeMs, value: source };
  return source;
}

/** 全站渲染数据：文案配置 + 库里的学生/作品/月度账目 */
function buildBootstrap() {
  const config = loadSiteConfig();
  const works = repo.listWorks({ includeOff: false });
  const students = repo.listStudents();
  const transparency = Object.assign({}, config.transparency, {
    months: repo.listMonthlyLedger()
  });
  return Object.assign({}, config, { works, students, transparency });
}

/* ============================================================
   二、HTTP 工具
   ============================================================ */
function sendJSON(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function readBody(req, limitBytes) {
  const limit = limitBytes || 1024 * 1024;
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(Object.assign(new Error("请求体过大"), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (e) {
        reject(Object.assign(new Error("请求体不是合法 JSON"), { statusCode: 400 }));
      }
    });
    req.on("error", reject);
  });
}

/* ============================================================
   三、API 路由
   ============================================================ */
async function handleApi(req, res, pathname, query) {
  const method = req.method.toUpperCase();
  const seg = pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  const route = seg[0] || "";

  /* 健康检查 */
  if (route === "health" && method === "GET") {
    return sendJSON(res, 200, {
      ok: true,
      db: db.dbFile(),
      seeded: db.hasData(),
      counts: {
        works: db.get("SELECT COUNT(*) AS n FROM works").n,
        students: db.get("SELECT COUNT(*) AS n FROM students").n,
        orders: db.get("SELECT COUNT(*) AS n FROM orders").n,
        applications: db.get("SELECT COUNT(*) AS n FROM applications").n
      },
      time: new Date().toISOString()
    });
  }

  /* 全站渲染数据（前端 js/api.js 使用） */
  if (route === "bootstrap" && method === "GET") {
    return sendJSON(res, 200, buildBootstrap());
  }

  /* 作品 */
  if (route === "works") {
    if (method === "GET" && !seg[1]) {
      return sendJSON(res, 200, repo.listWorks({
        category: query.get("category") || "",
        q: query.get("q") || "",
        sort: query.get("sort") || "",
        limit: query.get("limit") || ""
      }));
    }
    if (method === "GET" && seg[1]) {
      const w = repo.getWork(decodeURIComponent(seg[1]));
      return w ? sendJSON(res, 200, w) : sendJSON(res, 404, { error: "作品不存在" });
    }
  }

  /* 学生 */
  if (route === "students") {
    if (method === "GET" && !seg[1]) return sendJSON(res, 200, repo.listStudents());
    if (method === "GET" && seg[1]) {
      const s = repo.getStudent(decodeURIComponent(seg[1]));
      return s ? sendJSON(res, 200, s) : sendJSON(res, 404, { error: "学生不存在" });
    }
  }

  /* 订单 */
  if (route === "orders") {
    if (method === "GET" && !seg[1]) {
      return sendJSON(res, 200, repo.listOrders({
        status: query.get("status") || "",
        limit: query.get("limit") || ""
      }));
    }
    if (method === "POST" && !seg[1]) {
      const body = await readBody(req);
      return sendJSON(res, 201, repo.createOrder(body));
    }
    // 爱心证书查询：按订单号取单张订单
    if (method === "GET" && seg[1]) {
      const order = repo.getOrderByNo(decodeURIComponent(seg[1]));
      return order ? sendJSON(res, 200, order) : sendJSON(res, 404, { error: "订单不存在" });
    }
    if (method === "PATCH" && seg[1]) {
      const body = await readBody(req);
      return sendJSON(res, 200, repo.updateOrderStatus(decodeURIComponent(seg[1]), body.status));
    }
  }

  /* 资金流水 */
  if (route === "funds" && method === "GET") {
    return sendJSON(res, 200, {
      records: repo.listFunds({ limit: query.get("limit") || "" }),
      summary: repo.sumFunds()
    });
  }

  /* 报名 / 合作申请 */
  if (route === "applications") {
    if (method === "GET" && !seg[1]) {
      return sendJSON(res, 200, repo.listApplications({
        status: query.get("status") || "",
        limit: query.get("limit") || ""
      }));
    }
    if (method === "POST" && !seg[1]) {
      const body = await readBody(req);
      return sendJSON(res, 201, repo.createApplication(body));
    }
    if (method === "PATCH" && seg[1]) {
      const body = await readBody(req);
      return sendJSON(res, 200, repo.updateApplicationStatus(decodeURIComponent(seg[1]), body.status));
    }
  }

  /* 披露报告 / 月度账目 / 后台汇总 */
  if (route === "reports" && method === "GET") return sendJSON(res, 200, repo.listReports());
  if (route === "monthly" && method === "GET") return sendJSON(res, 200, repo.listMonthlyLedger());
  if (route === "dashboard" && method === "GET") return sendJSON(res, 200, repo.dashboard());

  return sendJSON(res, 404, { error: "接口不存在", path: pathname });
}

/* ============================================================
   四、静态文件
   ============================================================ */
function serveStatic(res, pathname) {
  let urlPath;
  try {
    urlPath = decodeURIComponent(pathname);
  } catch (e) {
    res.writeHead(400);
    res.end("bad request");
    return;
  }
  if (urlPath === "/") urlPath = "/index.html";

  const filePath = path.normalize(path.join(root, urlPath));
  if (filePath !== root && !filePath.startsWith(root + path.sep)) {
    res.writeHead(403);
    res.end("forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404 Not Found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-cache"
    });
    res.end(data);
  });
}

/* ============================================================
   五、启动
   ============================================================ */
function start() {
  // 空库自动导入，保证 `node server.js` 开箱可用
  if (!db.hasData()) {
    try {
      require("./db/seed").seed({ isReset: false });
      console.log("已自动导入初始数据（js/data.js → SQLite）");
    } catch (e) {
      console.error("初始数据导入失败：", e.message);
    }
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    const pathname = url.pathname;

    try {
      if (pathname.startsWith("/api/")) {
        await handleApi(req, res, pathname, url.searchParams);
        return;
      }
      // 数据库文件与 db/ 目录不对外暴露
      if (/\.db(-wal|-shm)?$/i.test(pathname) || /^\/db\//i.test(pathname)) {
        res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("forbidden");
        return;
      }
      serveStatic(res, pathname);
    } catch (err) {
      const code = err.statusCode || 500;
      if (code >= 500) console.error("请求处理失败：", err);
      sendJSON(res, code, { error: err.message || "服务器内部错误" });
    }
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error("端口 " + port + " 已被占用，请关闭占用程序后重试。");
      process.exit(1);
    }
    throw err;
  });

  server.listen(port, () => {
    console.log("星语计划本地服务器已启动： http://localhost:" + port + "/");
    console.log("  接口示例：/api/health  /api/bootstrap  /api/works  /api/orders");
    console.log("  数据库：" + db.dbFile());
    console.log("  关闭本窗口即可停止服务。");
  });

  const shutdown = () => { try { db.closeDb(); } catch (e) {} process.exit(0); };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

if (require.main === module) start();

module.exports = { start, buildBootstrap };
