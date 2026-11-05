/* 公益公开：统计 / 图表 / 资金流 / 披露表 */
(function(){
  var X = window.XINGYU;
  if(!X) return;
  var U = window.XYUtil;
  var $ = U.$;

  var T = X.transparency;

  /* 核心数据卡 */
  $("#transStats").innerHTML = T.summary.map(function(s){
    return (
      '<div class="trans-card" style="--t-color:'+s.color+';--t-bg:'+s.bg+'">'+
        '<span>'+s.label+'</span>'+
        '<b>'+(s.prefix||"")+ (s.value>=10000 ? (s.value/10000).toFixed(1)+"万" : s.value.toLocaleString("zh-CN")) +'<small>'+(s.suffix||"")+'</small></b>'+
        '<span>'+s.note+'</span>'+
      '</div>'
    );
  }).join("");

  /* 收入环形图 */
  var C = 2 * Math.PI * 80;
  var svgNS = "http://www.w3.org/2000/svg";
  var donut = $("#incomeDonut");
  var cum = 0;
  var palette = T.income.items.map(function(it){ return it.color; });
  T.income.items.forEach(function(it, i){
    var circle = document.createElementNS(svgNS, "circle");
    circle.setAttribute("cx","100"); circle.setAttribute("cy","100"); circle.setAttribute("r","80");
    circle.setAttribute("fill","none");
    circle.setAttribute("stroke", it.color);
    circle.setAttribute("stroke-width","34");
    circle.setAttribute("stroke-linecap","butt");
    var len = it.pct * C / 100;
    circle.setAttribute("stroke-dasharray", len + " " + C);
    circle.setAttribute("stroke-dashoffset", -cum);
    circle.setAttribute("opacity", i === 0 ? "1" : ".92");
    donut.appendChild(circle);
    cum += len;
  });
  $("#donutTotal").textContent = T.income.total;
  $("#incomeTotal").textContent = T.income.total;
  $("#incomeLegend").innerHTML = T.income.items.map(function(it){
    return (
      '<div class="legend-row">'+
        '<i style="background:'+it.color+'"></i>'+
        '<span>'+it.name+'</span><b>'+it.pct+'%</b>'+
      '</div>'
    );
  }).join("");

  /* 支出条形图 */
  $("#expenseTotal").textContent = T.expense.total;
  var barColors = [["#5B93C8","#8F7CCF"],["#6FAE87","#A7CDB4"],["#F6C453","#E2A93B"],["#B9A9E4","#8F7CCF"],["#7FB5E0","#5B93C8"]];
  $("#expenseBars").innerHTML = T.expense.items.map(function(it, i){
    // colors 已是「一对渐变色」，不能再按 i 二次索引（支出项超过 2 条时原先会取到 undefined）
    var colors = barColors[i % barColors.length];
    return (
      '<div class="bar-row">'+
        '<div class="bar-label"><span>'+it.name+'</span><b>'+it.pct+'% · '+it.value+'</b></div>'+
        '<div class="bar-track"><div class="bar-fill" data-pct="'+it.pct+'" style="--b1:'+colors[0]+';--b2:'+colors[1]+'"></div></div>'+
      '</div>'
    );
  }).join("");

  /* 资金流向 */
  $("#flowSources").innerHTML = T.flowSources.map(function(f, i){
    var bg = ["linear-gradient(135deg,#7FB5E0,var(--blue-deep))","linear-gradient(135deg,#F8D583,var(--yellow-deep))","linear-gradient(135deg,#C9BEE8,var(--lav-deep))"];
    return '<div class="flow-node"><span class="f-icon" style="--f-bg:'+bg[i]+'">'+f.icon+'</span><div><b>'+f.name+'</b><span>'+f.desc+'</span></div></div>';
  }).join("");
  $("#flowUses").innerHTML = T.flowUses.map(function(f, i){
    var bg = ["linear-gradient(135deg,#7FB5E0,var(--blue-deep))","linear-gradient(135deg,#BFDFC6,var(--green-deep))","linear-gradient(135deg,#F8D583,var(--yellow-deep))","linear-gradient(135deg,#C9BEE8,var(--lav-deep))"];
    return '<div class="flow-node"><span class="f-icon" style="--f-bg:'+bg[i]+'">'+f.icon+'</span><div><b>'+f.name+'</b><span>'+f.desc+'</span></div></div>';
  }).join("");

  /* 月度披露 */
  $("#monthRows").innerHTML = T.months.map(function(m){
    return (
      '<tr>'+
        '<td><b>'+m.month+'</b></td>'+
        '<td>'+m.income+'</td>'+
        '<td>'+m.expense+'</td>'+
        '<td style="color:'+(m.balance.indexOf("-")===0?"var(--rose)":"var(--green-deep)")+'"><b>'+m.balance+'</b></td>'+
        '<td>'+m.note+'</td>'+
      '</tr>'
    );
  }).join("");

  /* 公开原则 */
  $("#principleGrid").innerHTML = T.principle.map(function(p, i){
    return (
      '<div class="mission-card">'+
        '<div class="num" style="--m-bg:linear-gradient(135deg,'+["#7FB5E0","#BFDFC6","#F8D583","#C9BEE8"][i]+',var(--blue-deep))">'+ (i+1) +'</div>'+
        '<p style="font-size:14px;color:var(--ink-2)">'+p+'</p>'+
      '</div>'
    );
  }).join("");

  /* 条形图动画 */
  setTimeout(function(){
    document.querySelectorAll(".bar-fill").forEach(function(b){
      b.style.width = b.getAttribute("data-pct") + "%";
    });
  }, 350);

  /* ============================================================
     以下为数据库内容的展示：月度趋势 / 资金流水明细 / 披露报告
     ============================================================ */

  function parseMoney(text){
    var n = Number(String(text == null ? "" : text).replace(/[^0-9.\-]/g, ""));
    return isFinite(n) ? n : 0;
  }
  function fmtMoney(n){
    var v = Math.round(Number(n) * 100) / 100;
    return "¥" + v.toFixed(2).replace(/\.00$/, "").replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,");
  }
  function esc(v){ return String(v == null ? "" : v); }

  /* 月度收支趋势（数据来自 monthly_ledger，经 bootstrap 注入 T.months） */
  (function renderTrend(){
    var box = document.getElementById("trendChart");
    if(!box) return;
    var months = (T && T.months) || [];
    if(!months.length){
      box.innerHTML = '<p style="font-size:13px;color:var(--ink-3);text-align:center;padding:40px 0">暂无月度数据</p>';
      return;
    }
    var max = 1;
    months.forEach(function(m){
      max = Math.max(max, Math.abs(parseMoney(m.income)), Math.abs(parseMoney(m.expense)));
    });
    box.innerHTML = months.map(function(m){
      var inc = Math.abs(parseMoney(m.income));
      var exp = Math.abs(parseMoney(m.expense));
      var h1 = Math.max(4, Math.round(inc / max * 100));
      var h2 = Math.max(4, Math.round(exp / max * 100));
      return '<div class="trend-col">'+
        '<div class="trend-bars">'+
          '<div class="trend-bar" style="height:'+h1+'%;background:linear-gradient(180deg,#7FB5E0,var(--blue-deep))"><em>'+esc(m.income)+'</em></div>'+
          '<div class="trend-bar" style="height:'+h2+'%;background:linear-gradient(180deg,#F8D583,var(--yellow-deep))"><em>'+esc(m.expense)+'</em></div>'+
        '</div>'+
        '<div class="trend-month">'+esc(m.month)+'</div>'+
      '</div>';
    }).join("");
  })();

  /* 资金流水明细 + 披露报告：优先读数据库，离线则给出提示 */
  var api = window.XYAPI;
  var fundRowsEl = document.getElementById("fundRows");
  var fundSummaryEl = document.getElementById("fundSummary");
  var fundHintEl = document.getElementById("fundHint");
  var reportListEl = document.getElementById("reportList");
  var reportHintEl = document.getElementById("reportHint");

  if(!api || !api.online){
    if(fundRowsEl) fundRowsEl.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--ink-3)">离线预览模式：启动本地服务后显示资金流水</td></tr>';
    if(reportListEl) reportListEl.innerHTML = '<div class="report-card"><b>离线预览：启动本地服务后显示披露报告</b></div>';
    if(fundHintEl) fundHintEl.style.display = "flex";
    if(reportHintEl) reportHintEl.style.display = "flex";
    return;
  }

  function transCard(label, value, note, color, bg){
    return '<div class="trans-card" style="--t-color:'+color+';--t-bg:'+bg+'">'+
      '<span>'+esc(label)+'</span>'+
      '<b>'+esc(value)+'</b>'+
      '<span>'+esc(note)+'</span></div>';
  }

  api.funds().then(function(res){
    var s = res.summary || {};
    if(fundSummaryEl){
      fundSummaryEl.innerHTML = [
        transCard("累计义卖收入", s.income || "¥0", "作品义卖与企业定制", "var(--blue-deep)", "var(--blue-soft)"),
        transCard("累计反哺支出", s.expense || "¥0", "四向反哺：家庭 / 学校 / 捐赠 / 运营", "var(--green-deep)", "var(--green-soft)"),
        transCard("当前结余", s.balance || "¥0", "专项账户余额", "var(--lav-deep)", "var(--lav-soft)"),
        transCard("定向公益捐赠", fmtMoney((s.incomeValue || 0) * 0.3), "按收入 30% 计，捐赠中国残疾人福利基金会", "var(--yellow-deep)", "var(--yellow-soft)")
      ].join("");
    }
    if(fundRowsEl){
      var rows = res.records || [];
      fundRowsEl.innerHTML = rows.length ? rows.map(function(f){
        var isIncome = f.type === "收入";
        return '<tr>'+
          '<td>'+esc(f.date)+'</td>'+
          '<td><span class="badge '+(isIncome ? "blue" : "lav")+'">'+esc(f.type)+'</span></td>'+
          '<td><b>'+esc(f.item)+'</b></td>'+
          '<td style="color:'+(isIncome ? "var(--green-deep)" : "var(--rose)")+'"><b>'+esc(f.amount)+'</b></td>'+
          '<td>'+esc(f.status || "—")+'</td>'+
          '<td>'+esc(f.note || "—")+'</td>'+
        '</tr>';
      }).join("") : '<tr><td colspan="6" style="text-align:center;color:var(--ink-3)">暂无流水</td></tr>';
    }
  }).catch(function(){
    if(fundRowsEl) fundRowsEl.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--ink-3)">资金流水读取失败，请确认本地服务已启动</td></tr>';
    if(fundHintEl) fundHintEl.style.display = "flex";
  });

  api.reports().then(function(list){
    if(!reportListEl) return;
    reportListEl.innerHTML = (list && list.length) ? list.map(function(r){
      var cls = r.status === "已发布" ? "green" : "warm";
      return '<div class="report-card">'+
        '<div><b>'+esc(r.name)+'</b><div class="rp-meta">'+esc(r.period)+' · '+esc(r.date || "—")+'</div></div>'+
        '<span class="badge '+cls+'">'+esc(r.status)+'</span>'+
      '</div>';
    }).join("") : '<div class="report-card"><b>暂无披露报告</b></div>';
  }).catch(function(){
    if(reportListEl) reportListEl.innerHTML = '<div class="report-card"><b>披露报告读取失败</b></div>';
    if(reportHintEl) reportHintEl.style.display = "flex";
  });
})();
