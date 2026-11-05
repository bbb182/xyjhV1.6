/* ============================================================
   星语计划 · 数据接入层（前端）
   ------------------------------------------------------------
   作用：页面用 http(s) 打开时，从 /api/bootstrap 取数据库数据，
        并覆盖 window.XINGYU 中的「记录型」内容（作品、学生、账目等）；
        取不到（例如直接双击 index.html 的 file:// 方式、或纯静态托管）
        时静默回退到 js/data.js，站点功能不受影响。
   加载顺序：js/data.js → js/api.js → js/main.js → 页面脚本
   说明：这里使用同步 XHR，是为了保证后续脚本执行前数据已就绪；
        请求仅限同源本地接口，失败会立即回退。
   ============================================================ */
(function () {
  var X = window.XINGYU;
  if (!X) return;

  var API_BASE = "api";

  /* 供其他脚本调用的异步接口封装 */
  window.XYAPI = window.XYAPI || {
    base: API_BASE,
    online: false,

    request: function (method, path, body) {
      return fetch(API_BASE + path, {
        method: method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined
      }).then(function (res) {
        return res.text().then(function (text) {
          var data = null;
          try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
          if (!res.ok) {
            var err = new Error((data && data.error) || ("请求失败 " + res.status));
            err.status = res.status;
            throw err;
          }
          return data;
        });
      });
    },

    get: function (path) { return this.request("GET", path); },
    post: function (path, body) { return this.request("POST", path, body); },
    patch: function (path, body) { return this.request("PATCH", path, body); },

    /* 业务快捷方法 */
    createOrder: function (items, buyer) {
      var payload = { items: items };
      if (buyer) { payload.buyerName = buyer.name; payload.buyerContact = buyer.contact; }
      return this.post("/orders", payload);
    },
    createApplication: function (data) { return this.post("/applications", data); },
    orders: function () { return this.get("/orders"); },
    funds: function () { return this.get("/funds"); },
    applications: function () { return this.get("/applications"); },
    dashboard: function () { return this.get("/dashboard"); },
    reports: function () { return this.get("/reports"); }
  };

  /* 只有 http(s) 才尝试连接本地接口；file:// 直接使用 js/data.js */
  if (location.protocol !== "http:" && location.protocol !== "https:") return;

  var payload = null;
  try {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", API_BASE + "/bootstrap?t=" + Date.now(), false);
    xhr.setRequestHeader("Accept", "application/json");
    xhr.send(null);
    if (xhr.status >= 200 && xhr.status < 300) {
      payload = JSON.parse(xhr.responseText);
    }
  } catch (e) {
    payload = null; // 接口不可用 → 回退 data.js
  }

  if (!payload || !Array.isArray(payload.works) || !payload.works.length) return;

  /* 记录型数据以数据库为准；文案型配置同步覆盖（服务端已合并 data.js） */
  var keys = [
    "site", "nav", "categories", "categoryStyle", "stats", "pillars", "flow",
    "supportWays", "roles", "partners", "team", "advisors", "joinForm",
    "transparency", "students", "works"
  ];
  keys.forEach(function (k) {
    if (typeof payload[k] !== "undefined") X[k] = payload[k];
  });

  window.XYAPI.online = true;
  window.XY_DB = {
    online: true,
    works: X.works.length,
    students: X.students.length,
    source: "sqlite"
  };
})();
