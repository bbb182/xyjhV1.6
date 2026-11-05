/* ============================================================
   星语计划 · 管理后台
   ------------------------------------------------------------
   数据来源优先级：
     1. 数据库接口（window.XYAPI.online === true）—— 订单、资金、披露、汇总
     2. 内置演示数据 —— 离线/file:// 或接口不可用时兜底
   作品、学生、成长记录始终来自 window.XINGYU（已由 js/api.js 注入数据库内容）
   ============================================================ */
(function(){
  var X = window.XINGYU;
  if(!X) return;
  var U = window.XYUtil;
  var $ = U.$;
  var $$ = U.$$;

  var titles = {
    dash: "仪表盘", students: "学生管理", works: "作品管理", stories: "成长记录",
    orders: "订单管理", sales: "销售统计", applications: "申请管理",
    funds: "资金记录", disclosure: "披露中心"
  };

  /* 菜单切换 */
  $("#adminMenu").addEventListener("click", function(e){
    var btn = e.target.closest("button[data-pane]");
    if(!btn) return;
    var pane = btn.getAttribute("data-pane");
    $$("#adminMenu button").forEach(function(b){ b.classList.toggle("active", b===btn); });
    $$(".admin-pane").forEach(function(p){ p.classList.toggle("active", p.getAttribute("data-pane")===pane); });
    $("#paneTitle").textContent = titles[pane];
    window.scrollTo({top:0, behavior:"smooth"});
  });

  /* 顶部按钮跳转 */
  document.addEventListener("click", function(e){
    var g = e.target.closest("[data-goto]");
    if(g){
      var pane = g.getAttribute("data-goto");
      $$("#adminMenu button").forEach(function(b){ b.classList.toggle("active", b.getAttribute("data-pane")===pane); });
      $$(".admin-pane").forEach(function(p){ p.classList.toggle("active", p.getAttribute("data-pane")===pane); });
      $("#paneTitle").textContent = titles[pane];
    }
    var d = e.target.closest("[data-demo]");
    if(d) window.toast(d.getAttribute("data-demo"));
  });

  /* 表格行过滤器 */
  var searchBox = $("#adminSearch");
  if(searchBox){
    searchBox.addEventListener("input", function(){
      var kw = searchBox.value.trim().toLowerCase();
      $$(".admin-pane.active .admin-table tbody tr").forEach(function(tr){
        tr.style.display = tr.textContent.toLowerCase().indexOf(kw) >= 0 ? "" : "none";
      });
    });
  }

  /* ---------- 表格工具 ---------- */
  function badge(status){
    var map = {
      "已完成":"green","待发货":"warm","已发货":"blue","退款中":"lav","待审核":"warm",
      "上架中":"green","已下架":"gray","已发布":"green","整理中":"warm","已入账":"green","已核销":"blue"
    };
    return '<span class="badge '+(map[status]||"gray")+'">'+status+'</span>';
  }
  function rowActions(extra){
    return '<span class="row-actions"><button>编辑</button>'+(extra||'<button>详情</button>')+'<button class="danger">删除</button></span>';
  }
  function esc(v){ return U.esc ? U.esc(v) : String(v == null ? "" : v); }
  function money(n){ return U.money ? U.money(n) : "¥" + n; }

  /* ---------- 仪表盘统计 ---------- */
  function renderDash(s){
    $("#dashStats").innerHTML = [
      { label:"今日订单", value:String(s.todayOrders), unit:" 单", bg:"var(--blue-soft)", ico:"☰" },
      { label:"本月销售额", value:s.monthSales, unit:"", bg:"var(--yellow-soft)", ico:"¥" },
      { label:"在售作品", value:String(s.worksOnSale), unit:" 件", bg:"var(--green-soft)", ico:"✎" },
      { label:"待处理申请", value:String(s.pendingApplications), unit:" 条", bg:"var(--lav-soft)", ico:"✦" }
    ].map(function(s){
      return '<div class="admin-stat"><span class="as-label">'+s.label+'</span><div class="as-value">'+s.value+'<small>'+s.unit+'</small></div><span class="as-ico" style="--a-bg:'+s.bg+'">'+s.ico+'</span></div>';
    }).join("");
  }
  renderDash({
    todayOrders: 0,
    monthSales: money(X.works.reduce(function(sum, w){ return sum + w.price * w.sales; }, 0)),
    worksOnSale: X.works.length,
    pendingApplications: 0
  });

  /* ---------- 订单 ---------- */
  var DEMO_ORDERS = [
    { no:"XY20260825001", items:"金山蓝海 · 日月同辉 ×1", buyer:"林**", amount:"¥268", status:"待发货", time:"08-25 14:32" },
    { no:"XY20260825002", items:"一叶知秋 · 银杏 ×2", buyer:"王**", amount:"¥336", status:"已完成", time:"08-25 11:08" },
    { no:"XY20260824018", items:"归航 · 海与星 ×1", buyer:"陈**", amount:"¥68", status:"已发货", time:"08-24 20:45" },
    { no:"XY20260824007", items:"双生郁金香 ×1", buyer:"赵**", amount:"¥138", status:"已完成", time:"08-24 16:20" },
    { no:"XY20260823021", items:"清荷 · 莲心 ×1", buyer:"周**", amount:"¥158", status:"退款中", time:"08-23 10:11" },
    { no:"XY20260822012", items:"春信 · 花枝 ×1", buyer:"吴**", amount:"¥78", status:"已完成", time:"08-22 09:36" }
  ];

  function ordersTableHTML(list){
    return '<thead><tr><th>订单号</th><th>商品</th><th>买家</th><th>金额</th><th>状态</th><th>时间</th><th>操作</th></tr></thead><tbody>' +
      (list.length ? list.map(function(o){
        return '<tr><td><b>'+esc(o.no)+'</b></td><td>'+esc(o.items)+'</td><td>'+esc(o.buyer)+'</td><td><b>'+esc(o.amount)+'</b></td><td>'+badge(o.status)+'</td><td>'+esc(o.time)+'</td><td>'+rowActions()+'</td></tr>';
      }).join("") : '<tr><td colspan="7" style="text-align:center;color:var(--ink-3)">暂无订单</td></tr>') + '</tbody>';
  }
  function renderOrders(list){
    $("#dashOrders").innerHTML = ordersTableHTML(list.slice(0,5));
    $("#ordersTable").innerHTML = ordersTableHTML(list);
  }
  renderOrders(DEMO_ORDERS);

  /* ---------- 作品表格 ---------- */
  var workRows = function(list){
    return '<thead><tr><th>作品</th><th>作者</th><th>分类</th><th>价格</th><th>库存</th><th>销量</th><th>状态</th><th>操作</th></tr></thead><tbody>' +
      list.map(function(w){
        var st = U.getStudent(w.studentId) || { nick:"-", avatar:"" };
        var cat = U.catInfo(w.category);
        return '<tr data-status="'+(w.stock>0?"on":"off")+'">'+
          '<td><div style="display:flex;align-items:center;gap:10px"><img class="t-cover" src="'+w.cover+'" alt=""><div><b>'+esc(w.title)+'</b><div style="font-size:12px;color:var(--ink-3)">XY-'+esc(String(w.id).toUpperCase())+'</div></div></div></td>'+
          '<td><div style="display:flex;align-items:center;gap:8px"><img class="t-avatar" src="'+st.avatar+'" alt="">'+esc(st.nick)+'</div></td>'+
          '<td>'+esc(cat.label)+'</td><td><b>'+money(w.price)+'</b></td><td>'+w.stock+'</td><td>'+w.sales+'</td>'+
          '<td>'+badge(w.stock>0?"上架中":"已下架")+'</td>'+
          '<td>'+rowActions('<button>上下架</button>')+'</td>'+
        '</tr>';
      }).join("") + '</tbody>';
  };
  $("#dashWorks").innerHTML = workRows(X.works.slice(0,5));
  $("#worksTable").innerHTML = workRows(X.works);

  /* 作品筛选 tabs */
  $("#worksTabs").addEventListener("click", function(e){
    var btn = e.target.closest("button[data-filter]");
    if(!btn) return;
    var f = btn.getAttribute("data-filter");
    $$("#worksTabs button").forEach(function(b){ b.classList.toggle("active", b===btn); });
    $$("#worksTable tbody tr").forEach(function(tr){
      var on = tr.getAttribute("data-status") === "on";
      tr.style.display = (f==="all" || (f==="on"&&on) || (f==="off"&&!on)) ? "" : "none";
    });
  });

  /* ---------- 学生表格 ---------- */
  $("#studentTable").innerHTML =
    '<thead><tr><th>学生</th><th>年龄 / 城市</th><th>兴趣方向</th><th>作品</th><th>成长记录</th><th>状态</th><th>操作</th></tr></thead><tbody>' +
    X.students.map(function(s, i){
      var works = X.works.filter(function(w){ return w.studentId===s.id; }).length;
      return '<tr>'+
        '<td><div style="display:flex;align-items:center;gap:10px"><img class="t-avatar" src="'+s.avatar+'" alt=""><b>'+esc(s.nick)+'</b></div></td>'+
        '<td>'+s.age+' 岁 · '+esc(s.city)+'</td><td>'+esc(s.direction)+'</td>'+
        '<td>'+works+' 件</td><td>'+(s.milestones||[]).length+' 条</td>'+
        '<td>'+badge(i===2?"已结业":"在训")+'</td>'+
        '<td>'+rowActions()+'</td></tr>';
    }).join("") + '</tbody>';

  /* ---------- 成长记录表格 ---------- */
  var msRows = [];
  X.students.forEach(function(s){
    (s.milestones||[]).forEach(function(m){
      msRows.push({nick:s.nick, date:m.date, title:m.title, student:s.id});
    });
  });
  $("#milestoneTable").innerHTML =
    '<thead><tr><th>学生</th><th>日期</th><th>成长记录</th><th>状态</th><th>操作</th></tr></thead><tbody>' +
    msRows.slice(0,14).map(function(m){
      return '<tr><td><b>'+esc(m.nick)+'</b></td><td>'+esc(m.date)+'</td><td>'+esc(m.title)+'</td><td>'+badge("已发布")+'</td><td>'+rowActions()+'</td></tr>';
    }).join("") + '</tbody>';

  /* ---------- 销售统计 ---------- */
  var totalSales = X.works.reduce(function(s,x){ return s+x.sales; }, 0) || 1;
  $("#salesTable").innerHTML =
    '<thead><tr><th>排名</th><th>作品</th><th>销量</th><th>销售额</th><th>占比</th></tr></thead><tbody>' +
    X.works.slice().sort(function(a,b){ return b.sales-a.sales; }).slice(0,5).map(function(w, i){
      var pct = Math.round(w.sales/totalSales*100);
      return '<tr><td><b>#'+(i+1)+'</b></td>'+
        '<td><div style="display:flex;align-items:center;gap:10px"><img class="t-cover" src="'+w.cover+'" alt=""><b>'+esc(w.title)+'</b></div></td>'+
        '<td>'+w.sales+'</td><td><b>'+money(w.price*w.sales)+'</b></td><td>'+pct+'%</td></tr>';
    }).join("") + '</tbody>';

  /* ---------- 资金流水 ---------- */
  var DEMO_FUNDS = [
    { date:"2026-07-31", type:"收入", item:"义卖季度结算", amount:"+¥29,640", status:"已入账", note:"7 月掐丝珐琅作品义卖" },
    { date:"2026-07-20", type:"支出", item:"掐丝珐琅教学物料采购", amount:"-¥52,300", status:"已核销", note:"太原市小店区特殊教育中心小学校" },
    { date:"2026-07-12", type:"收入", item:"企业 LOGO 定制订单", amount:"+¥30,000", status:"已入账", note:"企业 CSR 定制" },
    { date:"2026-07-05", type:"支出", item:"暖心纾困 · 家庭帮扶", amount:"-¥18,420", status:"已核销", note:"6 户困难家庭补助" },
    { date:"2026-07-01", type:"支出", item:"公益捐赠（30% 定向）", amount:"-¥8,892", status:"已核销", note:"中国残疾人福利基金会" }
  ];

  function renderFunds(list){
    $("#dashFunds").innerHTML =
      '<thead><tr><th>日期</th><th>类型</th><th>项目</th><th>金额</th><th>状态</th><th>说明</th></tr></thead><tbody>' +
      list.slice(0,4).map(function(f){
        return '<tr><td>'+esc(f.date)+'</td><td><span class="badge '+(f.type==="收入"?"blue":"lav")+'">'+esc(f.type)+'</span></td><td><b>'+esc(f.item)+'</b></td><td><b style="color:'+(String(f.amount).indexOf("+")===0?"var(--green-deep)":"var(--rose)")+'">'+esc(f.amount)+'</b></td><td>'+badge(f.status)+'</td><td>'+esc(f.note)+'</td></tr>';
      }).join("") + '</tbody>';
    $("#fundsTable").innerHTML =
      '<thead><tr><th>日期</th><th>类型</th><th>项目</th><th>金额</th><th>凭证</th><th>状态</th><th>说明</th><th>操作</th></tr></thead><tbody>' +
      list.map(function(f){
        return '<tr><td>'+esc(f.date)+'</td><td><span class="badge '+(f.type==="收入"?"blue":"lav")+'">'+esc(f.type)+'</span></td><td><b>'+esc(f.item)+'</b></td><td><b style="color:'+(String(f.amount).indexOf("+")===0?"var(--green-deep)":"var(--rose)")+'">'+esc(f.amount)+'</b></td><td>凭证-'+esc(String(f.date).replace(/-/g,""))+'</td><td>'+badge(f.status)+'</td><td>'+esc(f.note)+'</td><td>'+rowActions()+'</td></tr>';
      }).join("") + '</tbody>';
  }
  renderFunds(DEMO_FUNDS);

  /* ---------- 披露报告 ---------- */
  var DEMO_REPORTS = [
    { name:"2026 年第二季度报告", period:"2026 Q2", status:"已发布", date:"2026-07-25" },
    { name:"2026 年第一季度报告", period:"2026 Q1", status:"已发布", date:"2026-04-20" },
    { name:"2025 年年度审计报告", period:"2025 全年", status:"已发布", date:"2026-03-15" },
    { name:"2026 年第三季度报告", period:"2026 Q3", status:"整理中", date:"预计 2026-10" }
  ];

  function renderReports(list){
    $("#reportTable").innerHTML =
      '<thead><tr><th>报告</th><th>期间</th><th>审计状态</th><th>发布日期</th><th>操作</th></tr></thead><tbody>' +
      list.map(function(r){
        return '<tr><td><b>'+esc(r.name)+'</b></td><td>'+esc(r.period)+'</td><td>'+badge(r.status)+'</td><td>'+esc(r.date)+'</td><td>'+rowActions('<button>预览</button>')+'</td></tr>';
      }).join("") + '</tbody>';
  }
  renderReports(DEMO_REPORTS);

  /* ---------- 申请管理（数据库） ---------- */
  var DEMO_APPS = [
    { id: 1, name: "李同学", contact: "138****2048", type: "志愿者报名", org: "山西应用科技学院", message: "希望参与掐丝珐琅课堂陪伴", status: "待审核", createdAt: "2026-11-05 09:12" },
    { id: 2, name: "张女士", contact: "zhang@example.com", type: "企业合作", org: "某文创公司", message: "想定制一批年会礼品", status: "待审核", createdAt: "2026-11-04 15:40" },
    { id: 3, name: "王老师", contact: "135****7712", type: "学校合作", org: "杏花岭区特教学校", message: "希望共建兴趣课堂", status: "已通过", createdAt: "2026-11-02 10:05" }
  ];

  function renderApps(list){
    var stats = { "待审核": 0, "已通过": 0, "已拒绝": 0 };
    list.forEach(function(a){ if(stats[a.status] != null) stats[a.status]++; });

    var statsBox = $("#appStats");
    if(statsBox){
      statsBox.innerHTML = [
        { label: "待审核", value: stats["待审核"], bg: "var(--yellow-soft)", ico: "◔" },
        { label: "已通过", value: stats["已通过"], bg: "var(--green-soft)", ico: "✓" },
        { label: "已拒绝", value: stats["已拒绝"], bg: "var(--rose-soft,#FBEFF2)", ico: "✕" },
        { label: "累计申请", value: list.length, bg: "var(--blue-soft)", ico: "✉" }
      ].map(function(s){
        return '<div class="admin-stat"><span class="as-label">'+s.label+'</span><div class="as-value">'+s.value+'<small> 条</small></div><span class="as-ico" style="--a-bg:'+s.bg+'">'+s.ico+'</span></div>';
      }).join("");
    }

    var table = $("#applicationsTable");
    if(!table) return;
    table.innerHTML =
      '<thead><tr><th>申请人</th><th>联系方式</th><th>类型</th><th>机构</th><th>留言</th><th>状态</th><th>时间</th><th>操作</th></tr></thead><tbody>' +
      (list.length ? list.map(function(a){
        var actions = a.status === "待审核"
          ? '<span class="row-actions"><button data-app-op="已通过" data-app-id="'+a.id+'">通过</button><button class="danger" data-app-op="已拒绝" data-app-id="'+a.id+'">拒绝</button></span>'
          : '<span class="row-actions"><button data-demo="该申请已处理">详情</button></span>';
        return '<tr>'+
          '<td><b>'+esc(a.name)+'</b></td>'+
          '<td>'+esc(a.contact)+'</td>'+
          '<td>'+esc(a.type)+'</td>'+
          '<td>'+esc(a.org || "—")+'</td>'+
          '<td>'+esc(a.message || "—")+'</td>'+
          '<td>'+badge(a.status)+'</td>'+
          '<td>'+esc(a.createdAt || "—")+'</td>'+
          '<td>'+actions+'</td>'+
        '</tr>';
      }).join("") : '<tr><td colspan="8" style="text-align:center;color:var(--ink-3)">暂无申请</td></tr>') +
      '</tbody>';
  }
  renderApps(DEMO_APPS);

  /* 审核操作：走 PATCH /api/applications/:id */
  var appTable = $("#applicationsTable");
  if(appTable){
    appTable.addEventListener("click", function(e){
      var btn = e.target.closest("[data-app-op]");
      if(!btn) return;
      var apiRef = window.XYAPI;
      if(!apiRef || !apiRef.online){ window.toast("离线预览：启动本地服务后可审核"); return; }
      var id = btn.getAttribute("data-app-id");
      var status = btn.getAttribute("data-app-op");
      btn.disabled = true;
      apiRef.patch("/applications/" + id, { status: status }).then(function(){
        window.toast("已" + status.replace("已", "") + "该申请");
        return apiRef.applications().then(renderApps);
      }).catch(function(err){
        window.toast((err && err.message) || "操作失败");
        btn.disabled = false;
      });
    });
  }

  /* ---------- 接口在线时刷新为数据库数据 ---------- */
  var api = window.XYAPI;
  if(api && api.online){
    api.applications().then(renderApps).catch(function(){});

    api.orders().then(function(list){
      renderOrders(list.map(function(o){
        return {
          no: o.no,
          items: o.itemText || (o.items || []).map(function(it){ return it.title + " ×" + it.qty; }).join("、"),
          buyer: o.buyer,
          amount: o.amount,
          status: o.status,
          time: o.time
        };
      }));
    }).catch(function(){});

    api.funds().then(function(res){
      renderFunds((res.records || []).map(function(f){
        return { date: f.date, type: f.type, item: f.item, amount: f.amount, status: f.status, note: f.note };
      }));
    }).catch(function(){});

    api.reports().then(function(list){
      if(list && list.length){
        renderReports(list.map(function(r){
          return { name: r.name, period: r.period, status: r.status, date: r.date };
        }));
      }
    }).catch(function(){});

    api.dashboard().then(function(d){
      var today = new Date();
      var todayKey = today.getFullYear() + "-" + String(today.getMonth()+1).padStart(2,"0") + "-" + String(today.getDate()).padStart(2,"0");
      api.orders().then(function(list){
        var todayOrders = (list || []).filter(function(o){
          return String(o.createdAt || "").slice(0,10) === todayKey;
        }).length;
        renderDash({
          todayOrders: todayOrders,
          monthSales: d.monthSales,
          worksOnSale: d.worksOnSale,
          pendingApplications: d.pendingApplications
        });
      }).catch(function(){});
    }).catch(function(){});
  }
})();
