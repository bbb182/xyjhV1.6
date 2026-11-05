/* ============================================================
   星语计划 · 爱心证书查询
   ------------------------------------------------------------
   数据来源：GET /api/orders/:orderNo（订单 + 明细 + 30% 捐赠额 + 受助编号）
   离线（file:// 或未启动服务）时给出提示，不报错。
   ============================================================ */
(function(){
  var X = window.XINGYU;
  if(!X) return;
  var U = window.XYUtil;
  var $ = U.$;

  var form = $("#certForm");
  var input = $("#certNo");
  var msg = $("#certMsg");
  var result = $("#certResult");
  var hint = $("#certHint");
  var api = window.XYAPI;

  if(!form || !input || !result) return;

  function showMsg(type, text){
    if(!msg) return;
    msg.className = "cert-msg " + type;
    msg.textContent = text;
  }
  function clearMsg(){
    if(msg){ msg.className = "cert-msg"; msg.textContent = ""; }
  }
  function esc(v){ return U.esc ? U.esc(v) : String(v == null ? "" : v); }

  /* 离线提示 */
  if(!api || !api.online){
    if(hint){
      hint.innerHTML = "当前为离线预览（" + location.protocol.replace(":", "") +
        "）。爱心证书需要读取订单数据库，请用 <code>node server.js</code> 启动后访问 http://localhost:8080/certificate.html 查询。";
    }
    showMsg("info", "未连接本地服务，无法查询订单。已准备示例证书样式，启动服务后即可返回真实数据。");
  }

  function render(order){
    var items = order.items || [];
    var itemHtml = items.length ? items.map(function(it){
      return '<li><b>' + esc(it.title) + '</b><span>×' + esc(it.qty) + ' · ' + esc(U.money(it.unitPrice)) + '</span></li>';
    }).join("") : '<li><b>' + esc(order.itemText || "—") + '</b><span></span></li>';

    result.innerHTML =
      '<div class="certificate">' +
        '<div class="cert-inner">' +
          '<div class="cert-head">' +
            '<div class="cert-title">爱心证书<small>STAR LANGUAGE PROJECT · CERTIFICATE OF LOVE</small></div>' +
            '<div class="cert-no">证书编号<b>' + esc(order.certificateNo || "—") + '</b></div>' +
          '</div>' +
          '<div class="cert-body">' +
            '<div class="cert-line"><span>订单号</span><span>' + esc(order.no) + '</span></div>' +
            '<div class="cert-line"><span>下单时间</span><span>' + esc(order.time) + '</span></div>' +
            '<div class="cert-line"><span>受助儿童</span><span>' + esc(order.beneficiary || "匿名编号待公布") + '</span></div>' +
            '<ul class="cert-items">' + itemHtml + '</ul>' +
            '<div class="cert-stats">' +
              '<div class="cert-stat"><span>订单金额</span><b>' + esc(order.amount) + '</b></div>' +
              '<div class="cert-stat warm"><span>公益捐赠（30%）</span><b>' + esc(order.donation) + '</b></div>' +
              '<div class="cert-stat"><span>当前状态</span><b style="font-size:16px">' + esc(order.status) + '</b></div>' +
            '</div>' +
            '<div class="cert-line"><span>善款去向</span><span>30% 定向捐赠中国残疾人福利基金会；其余按「四向反哺」用于困难家庭帮扶、合作校教学物料与项目运营。</span></div>' +
          '</div>' +
          '<div class="cert-foot">' +
            '<p>本证书由星语计划项目组颁发，捐赠金额与去向可在「公益公开」页核对。<br>让每一颗星星，都被看见。</p>' +
            '<div class="cert-seal"><b>星语计划</b><span>公益项目组</span></div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div style="text-align:center;margin-top:22px">' +
        '<button class="btn btn-ghost" id="printCert">🖨 打印 / 保存为 PDF</button>' +
      '</div>';

    var printBtn = $("#printCert");
    if(printBtn) printBtn.addEventListener("click", function(){ window.print(); });
  }

  function query(no){
    var value = String(no || "").trim();
    if(!value){ showMsg("error", "请输入订单号"); return; }
    if(!api || !api.online){
      showMsg("info", "未连接本地服务，暂时无法查询。启动 node server.js 后再试。");
      return;
    }
    clearMsg();
    result.innerHTML = "";
    if(hint) hint.textContent = "查询中…";
    api.get("/orders/" + encodeURIComponent(value))
      .then(function(order){
        if(hint) hint.textContent = "";
        render(order);
      })
      .catch(function(err){
        if(hint) hint.textContent = "";
        if(err && err.status === 404){
          showMsg("error", "没有找到订单「" + value + "」，请核对订单号（格式如 XY20260825001）。");
        } else {
          showMsg("error", (err && err.message) || "查询失败，请稍后再试");
        }
      });
  }

  form.addEventListener("submit", function(e){
    e.preventDefault();
    query(input.value);
  });

  /* 支持通过 ?no=XY... 直接进入并自动查询，方便下单后跳转 */
  var qs = new URLSearchParams(location.search);
  var preset = qs.get("no");
  if(preset){
    input.value = preset;
    query(preset);
  }
})();
