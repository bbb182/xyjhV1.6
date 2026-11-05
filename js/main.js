/* ============================================================
   星语计划 · 公共脚本
   负责：页头 / 页脚渲染、移动端菜单、购物车、动画、搜索
   ============================================================ */
(function(){

var X = window.XINGYU;
if(!X) return;

/* ---------- 工具 ---------- */
function $(sel, root){ return (root||document).querySelector(sel); }
function $$(sel, root){ return Array.prototype.slice.call((root||document).querySelectorAll(sel)); }
function money(n){
  var s = Math.round(n*100)/100;
  var parts = s.toFixed(2).replace(/\.00$/,"").replace(/(\d)(?=(\d{3})+(?!\d))/g,"$1,");
  return "¥" + parts;
}
function esc(str){
  return String(str||"").replace(/[&<>"']/g,function(c){
    return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
  });
}
function getWork(id){
  for(var i=0;i<X.works.length;i++){ if(X.works[i].id===id) return X.works[i]; }
  return null;
}
function getStudent(id){
  for(var i=0;i<X.students.length;i++){ if(X.students[i].id===id) return X.students[i]; }
  return null;
}
function catInfo(id){
  return X.categoryStyle[id] || {cls:"blue", label:id};
}

/* ---------- 作品卡片 ---------- */
function workCardHTML(w){
  var st = getStudent(w.studentId);
  var cat = catInfo(w.category);
  var badge = w.badge ? '<span class="work-badge">'+esc(w.badge)+'</span>' : '';
  return (
    '<article class="work-card" data-id="'+w.id+'" onclick="location.href=\'detail.html?id='+w.id+'\'">'+
      '<div class="work-cover">'+badge+
        '<button class="heart" onclick="event.stopPropagation();window.toggleLike(this,\''+w.id+'\')" aria-label="收藏">♡</button>'+
        '<img src="'+w.cover+'" alt="'+esc(w.title)+'">'+
      '</div>'+
      '<div class="work-info">'+
        '<h3>'+esc(w.title)+'</h3>'+
        '<div class="work-meta">'+
          '<img class="avatar" src="'+st.avatar+'" alt="'+esc(st.nick)+'">'+
          '<span>'+esc(st.nick)+' · '+st.age+'岁 · '+esc(st.city)+'</span>'+
          '<span>·</span><span>'+esc(cat.label)+'</span>'+
        '</div>'+
        '<div class="work-bottom">'+
          '<span class="work-price">'+money(w.price)+'</span>'+
          '<span class="work-sales">已售 '+w.sales+'</span>'+
        '</div>'+
      '</div>'+
    '</article>'
  );
}

/* ---------- 购物车（localStorage 演示） ---------- */
var CART_KEY = "xingyu_cart_v1";
function getCart(){
  try{ return JSON.parse(localStorage.getItem(CART_KEY)) || []; }catch(e){ return []; }
}
function saveCart(list){ localStorage.setItem(CART_KEY, JSON.stringify(list)); }
function cartCount(){
  return getCart().reduce(function(s,it){ return s + (it.qty||1); }, 0);
}
function addToCart(id, qty){
  qty = qty || 1;
  var list = getCart();
  var found = false;
  list.forEach(function(it){
    if(it.id===id){ it.qty += qty; found = true; }
  });
  if(!found) list.push({id:id, qty:qty});
  saveCart(list);
  updateCartBadge();
  toast("已加入购物车 ♥");
}
function updateCartBadge(){
  var b = $("#cartBadge");
  if(!b) return;
  var n = cartCount();
  b.textContent = n;
  b.classList.toggle("show", n>0);
}
window.addToCart = addToCart;
window.getCart = getCart;
window.saveCart = saveCart;
window.cartCount = cartCount;
window.updateCartBadge = updateCartBadge;

/* ---------- 收藏 ---------- */
window.toggleLike = function(btn, id){
  btn.classList.toggle("liked");
  btn.innerHTML = btn.classList.contains("liked") ? "♥" : "♡";
  toast(btn.classList.contains("liked") ? "已收藏，感谢你的喜欢" : "已取消收藏");
};

/* ---------- Toast ---------- */
var toastTimer = null;
function toast(msg){
  var t = $("#toast");
  if(!t){
    t = document.createElement("div");
    t.id = "toast";
    t.style.cssText = "position:fixed;left:50%;bottom:40px;transform:translateX(-50%) translateY(20px);background:rgba(38,67,95,.94);color:#fff;padding:12px 26px;border-radius:999px;font-size:14px;z-index:999;opacity:0;transition:.3s;box-shadow:0 12px 30px rgba(38,67,95,.3);pointer-events:none;white-space:nowrap;";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = "1";
  t.style.transform = "translateX(-50%) translateY(0)";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function(){
    t.style.opacity = "0";
    t.style.transform = "translateX(-50%) translateY(20px)";
  }, 1800);
}
window.toast = toast;

/* ---------- 页头 ---------- */
function renderHeader(){
  var box = $("#app-header");
  if(!box) return;
  var current = document.body.getAttribute("data-page") || "";
  var nav = X.nav.map(function(item){
    var active = (item.url.split(".")[0] === current) ? " active" : "";
    return '<a class="nav-link'+active+'" href="'+item.url+'">'+item.name+'</a>';
  }).join("");

  box.innerHTML =
    '<header class="site-header">'+
      '<div class="header-inner">'+
        '<a class="logo" href="index.html">'+
          '<span class="logo-mark badge-mark"><img src="images/logo-icon.png" alt="星语计划 · 非遗掐丝 星梦成真"></span>'+
          '<span class="logo-text"><h1>星语计划</h1><p>让每一颗星星，都被看见</p></span>'+
        '</a>'+
        '<nav class="site-nav">'+nav+'</nav>'+
        '<div class="header-actions">'+
          '<button class="icon-btn" id="searchToggle" aria-label="搜索">⌕</button>'+
          '<a class="icon-btn" href="mall.html" aria-label="购物车">🛍<span class="cart-badge" id="cartBadge"></span></a>'+
          '<a class="btn btn-primary btn-sm btn-join" href="join.html">支持公益</a>'+
          '<button class="menu-toggle" id="menuToggle" aria-label="菜单"><span></span><span></span><span></span></button>'+
        '</div>'+
      '</div>'+
      '<div class="header-search" id="headerSearch">'+
        '<form id="headerSearchForm">'+
          '<input type="text" placeholder="搜索作品，如：掐丝珐琅 / 银杏" autocomplete="off">'+
          '<button type="submit">⌕</button>'+
        '</form>'+
      '</div>'+
    '</header>'+
    '<div class="mobile-nav" id="mobileNav">'+
      nav +
      '<div class="m-cta">'+
        '<a class="btn btn-primary" href="mall.html">去公益商城</a>'+
        '<a class="btn btn-warm" href="join.html">支持公益</a>'+
      '</div>'+
    '</div>';

  /* 移动端菜单 */
  var toggle = $("#menuToggle"), mnav = $("#mobileNav");
  toggle.addEventListener("click", function(){
    var open = mnav.classList.toggle("open");
    toggle.classList.toggle("open", open);
    document.body.style.overflow = open ? "hidden" : "";
  });
  $$(".mobile-nav .nav-link", mnav).forEach(function(a){
    a.addEventListener("click", function(){ mnav.classList.remove("open"); toggle.classList.remove("open"); document.body.style.overflow=""; });
  });

  /* 搜索 */
  var st = $("#searchToggle"), hs = $("#headerSearch");
  st.addEventListener("click", function(){
    hs.classList.toggle("open");
    if(hs.classList.contains("open")){ var inp = hs.querySelector("input"); inp.focus(); }
  });
  $("#headerSearchForm").addEventListener("submit", function(e){
    e.preventDefault();
    var kw = this.querySelector("input").value.trim();
    location.href = "mall.html" + (kw ? "?q=" + encodeURIComponent(kw) : "");
  });

  updateCartBadge();
}

/* ---------- 页脚 ---------- */
function renderFooter(){
  var box = $("#app-footer");
  if(!box) return;
  box.innerHTML =
    '<footer class="site-footer">'+
      '<div class="footer-grid">'+
        '<div class="footer-brand">'+
          '<a class="logo" href="index.html">'+
            '<span class="logo-mark badge-mark"><img src="images/logo-icon.png" alt="星语计划 · 非遗掐丝 星梦成真"></span>'+
            '<span class="logo-text"><h1>星语计划</h1><p>让每一颗星星，都被看见</p></span>'+
          '</a>'+
          '<p>特殊并非缺陷，只是天赋的表达方式与众不同。星语计划把非遗掐丝珐琅技艺带进太原市小店区特殊教育中心小学校，以陪伴式课堂发掘天赋、以作品义卖反哺成长。</p>'+
          '<div class="socials">'+
            '<a href="join.html" aria-label="微信">微</a>'+
            '<a href="join.html" aria-label="微博">博</a>'+
            '<a href="join.html" aria-label="小红书">书</a>'+
            '<a href="mailto:'+X.site.contact.email+'" aria-label="邮箱">邮</a>'+
          '</div>'+
        '</div>'+
        '<div class="footer-col">'+
          '<h4>快速导航</h4>'+
          X.nav.map(function(n){ return '<a href="'+n.url+'">'+n.name+'</a>'; }).join("")+
        '</div>'+
        '<div class="footer-col">'+
          '<h4>支持我们</h4>'+
          '<a href="mall.html">进入公益商城</a>'+
          '<a href="public.html">查看公益公开</a>'+
          '<a href="stories.html">阅读星星故事</a>'+
          '<a href="join.html">志愿者报名</a>'+
          '<a href="join.html">企业合作</a>'+
          '<a href="certificate.html">爱心证书查询</a>'+
        '</div>'+
        '<div class="footer-col">'+
          '<h4>联系我们</h4>'+
          '<ul class="footer-contact">'+
            '<li><span class="ico">☎</span><i>电话：</i><a href="tel:'+X.site.contact.phone+'">'+X.site.contact.phone+'</a></li>'+
            '<li><span class="ico">✉</span><i>邮箱：</i><a href="mailto:'+X.site.contact.email+'">'+X.site.contact.email+'</a></li>'+
            '<li><span class="ico">⌖</span><i>地址：</i>'+X.site.contact.address+'</li>'+
          '</ul>'+
        '</div>'+
      '</div>'+
      '<div class="footer-bottom"><div class="inner">'+
        '<span>'+X.site.copyright+'</span>'+
        '<span>'+X.site.icp+' · 孩子们的故事与肖像均经授权匿名展示</span>'+
      '</div></div>'+
    '</footer>';
}

/* ---------- 回到顶部 / 滚动 ---------- */
function initBackTop(){
  var btn = document.createElement("button");
  btn.className = "back-top";
  btn.setAttribute("aria-label","回到顶部");
  btn.innerHTML = "↑";
  document.body.appendChild(btn);
  window.addEventListener("scroll", function(){
    btn.classList.toggle("show", window.scrollY > 500);
  }, {passive:true});
  btn.addEventListener("click", function(){ window.scrollTo({top:0, behavior:"smooth"}); });
}

/* ---------- 进入动画 ---------- */
function initReveal(){
  $$(".fade-up").forEach(function(el, i){
    el.style.transitionDelay = ((i%6)*0.06) + "s";
  });
  if(!("IntersectionObserver" in window)){ $$(".fade-up").forEach(function(el){ el.classList.add("in"); }); return; }
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(en){
      if(en.isIntersecting){ en.target.classList.add("in"); io.unobserve(en.target); }
    });
  }, {threshold:.12});
  $$(".fade-up").forEach(function(el){ io.observe(el); });
}

/* ---------- 数字滚动 ---------- */
function initCounter(){
  $$("[data-count]").forEach(function(el){
    var target = parseFloat(el.getAttribute("data-count"));
    var suffix = el.getAttribute("data-suffix") || "";
    var prefix = el.getAttribute("data-prefix") || "";
    var done = false;
    function run(){
      var start = null, dur = 1400;
      function step(ts){
        if(!start) start = ts;
        var p = Math.min((ts - start)/dur, 1);
        var eased = 1 - Math.pow(1-p, 3);
        el.textContent = prefix + Math.round(target*eased).toLocaleString("zh-CN") + suffix;
        if(p<1) requestAnimationFrame(step); else el.textContent = prefix + target.toLocaleString("zh-CN") + suffix;
      }
      requestAnimationFrame(step);
    }
    if(!("IntersectionObserver" in window)){ run(); return; }
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if(en.isIntersecting && !done){ done = true; run(); io.unobserve(en.target); }
      });
    }, {threshold:.4});
    io.observe(el);
  });
}

/* ---------- QA 自检（?qa=1） ---------- */
function initQA(){
  if(location.search.indexOf("qa=1") < 0) return;
  var rep = document.createElement("div");
  rep.id = "qa-report";
  rep.style.display = "none";
  document.body.appendChild(rep);
  var errors = [];
  window.addEventListener("error", function(e){ errors.push(String(e.message||e.error)); });
  window.addEventListener("load", function(){
    setTimeout(function(){
      var vw = document.documentElement.clientWidth;
      var overflow = document.documentElement.scrollWidth > vw + 2;
      var offenders = $$("body *").filter(function(el){
        var r = el.getBoundingClientRect();
        return r.right > vw + 2 && el.offsetWidth > 0 && getComputedStyle(el).position !== "fixed";
      }).slice(0,12).map(function(el){ return el.tagName + "." + (el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className) + " right=" + Math.round(el.getBoundingClientRect().right); });
      var brokenImgs = $$("img").filter(function(im){ return !im.complete || im.naturalWidth === 0; }).map(function(im){ return im.getAttribute("src"); });
      rep.textContent = JSON.stringify({
        page: location.pathname.split("/").pop(),
        vw: vw,
        overflow: overflow,
        offenders: offenders,
        brokenImgs: brokenImgs,
        errors: errors,
        worksRendered: $$(".work-card, .product-card").length,
        imgs: $$("img").length
      });
      document.title = "QA_OK:" + document.title;
    }, 400);
  });
}

/* ---------- 启动 ---------- */
document.addEventListener("DOMContentLoaded", function(){
  renderHeader();
  renderFooter();
  initBackTop();
  initReveal();
  initCounter();
  initQA();
});

/* 暴露给页面脚本 */
window.XYUtil = { $: $, $$: $$, money: money, esc: esc, getWork: getWork, getStudent: getStudent, catInfo: catInfo, workCardHTML: workCardHTML };

})();
