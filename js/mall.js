/* 公益商城：筛选 / 搜索 / 排序 / 购物车 */
(function(){
  var X = window.XINGYU;
  if(!X) return;
  var U = window.XYUtil;
  var $ = U.$;

  var state = { cat:"all", keyword:"", sort:"sales" };
  var qs = new URLSearchParams(location.search);
  state.keyword = qs.get("q") || "";

  var grid = $("#mallGrid");
  var catsBox = $("#mallCats");
  var searchBox = $("#mallSearch");
  var sortBox = $("#mallSort");
  if(!grid || !catsBox) return;
  searchBox.value = state.keyword;

  catsBox.innerHTML = X.categories.map(function(c){
    return '<button class="chip'+(state.cat===c.id?" active":"")+'" data-cat="'+c.id+'">'+c.name+'</button>';
  }).join("");
  catsBox.addEventListener("click", function(e){
    var btn = e.target.closest(".chip");
    if(!btn) return;
    state.cat = btn.getAttribute("data-cat");
    catsBox.querySelectorAll(".chip").forEach(function(b){ b.classList.toggle("active", b===btn); });
    render();
  });

  var timer = null;
  searchBox.addEventListener("input", function(){
    clearTimeout(timer);
    timer = setTimeout(function(){
      state.keyword = searchBox.value.trim();
      render();
    }, 260);
  });
  sortBox.addEventListener("change", function(){ state.sort = sortBox.value; render(); });

  function filtered(){
    var kw = state.keyword.toLowerCase();
    var list = X.works.filter(function(w){
      var st = U.getStudent(w.studentId);
      if(state.cat !== "all" && w.category !== state.cat) return false;
      if(kw && w.title.toLowerCase().indexOf(kw) < 0 && st.nick.toLowerCase().indexOf(kw) < 0) return false;
      return true;
    });
    return list.sort(function(a,b){
      if(state.sort === "priceAsc") return a.price - b.price;
      if(state.sort === "priceDesc") return b.price - a.price;
      if(state.sort === "latest") return (b.date < a.date) ? -1 : 1;
      return b.sales - a.sales;
    });
  }

  function render(){
    var list = filtered();
    $("#mallTitle").textContent = X.categories.filter(function(c){return c.id===state.cat;})[0].name;
    $("#mallCount").textContent = "共 " + list.length + " 件商品";
    $("#mallEmpty").style.display = list.length ? "none" : "block";
    grid.innerHTML = list.map(function(w){
      var st = U.getStudent(w.studentId);
      var cat = U.catInfo(w.category);
      return (
        '<article class="product-card" data-id="'+w.id+'">'+
          '<div class="product-cover">'+
            (w.badge ? '<span class="product-badge">'+U.esc(w.badge)+'</span>' : '')+
            '<img src="'+w.cover+'" alt="'+U.esc(w.title)+'">'+
          '</div>'+
          '<div class="product-info">'+
            '<h3>'+U.esc(w.title)+'</h3>'+
            '<div class="prod-meta"><span>'+st.nick+'</span><span>已售 '+w.sales+'</span><span>'+cat.label+'</span></div>'+
            '<div class="product-bottom">'+
              '<span class="price">'+U.money(w.price)+'</span>'+
              '<button class="add-cart" data-id="'+w.id+'" aria-label="加入购物车">＋</button>'+
            '</div>'+
          '</div>'+
        '</article>'
      );
    }).join("");
  }

  grid.addEventListener("click", function(e){
    var add = e.target.closest(".add-cart");
    if(add){
      e.preventDefault();
      window.addToCart(add.getAttribute("data-id"), 1);
      renderCart();
      return;
    }
    var card = e.target.closest(".product-card");
    if(card) location.href = "detail.html?id=" + card.getAttribute("data-id");
  });

  /* ---------- 购物车 ---------- */
  var cartList = $("#cartList");
  var cartTotalEl = $("#cartTotal");
  var cartInfoEl = $("#cartInfo");
  var checkoutBtn = $("#checkoutBtn");

  function renderCart(){
    var items = window.getCart();
    var total = 0;
    items.forEach(function(it){
      var w = U.getWork(it.id);
      if(w) total += w.price * it.qty;
    });
    if(!items.length){
      cartList.innerHTML = '<div class="cart-empty"><div class="big">🛍</div>购物车还是空的<br>去挑一件喜欢的作品吧</div>';
    } else {
      cartList.innerHTML = items.map(function(it){
        var w = U.getWork(it.id);
        if(!w) return "";
        return (
          '<div class="cart-item">'+
            '<img src="'+w.cover+'" alt="'+U.esc(w.title)+'">'+
            '<div class="ci-info">'+
              '<b>'+U.esc(w.title)+'</b>'+
              '<span class="ci-price">'+U.money(w.price)+'</span>'+
              '<span class="cart-qty">'+
                '<button data-op="minus" data-id="'+w.id+'">−</button>'+
                '<input value="'+it.qty+'" readonly>'+
                '<button data-op="plus" data-id="'+w.id+'">+</button>'+
              '</span>'+
            '</div>'+
          '</div>'
        );
      }).join("");
    }
    cartTotalEl.textContent = U.money(total);
    var n = items.reduce(function(s,it){ return s + it.qty; }, 0);
    cartInfoEl.textContent = n + " 件商品";
    checkoutBtn.disabled = !items.length;
  }

  cartList.addEventListener("click", function(e){
    var btn = e.target.closest("button[data-op]");
    if(!btn) return;
    var items = window.getCart();
    var it = items.filter(function(x){ return x.id === btn.getAttribute("data-id"); })[0];
    if(!it) return;
    if(btn.getAttribute("data-op") === "plus") it.qty++;
    else { it.qty--; if(it.qty < 1) items = items.filter(function(x){ return x.id !== it.id; }); }
    window.saveCart(items);
    window.updateCartBadge();
    renderCart();
  });

  checkoutBtn.addEventListener("click", function(){
    var items = window.getCart();
    if(!items.length) return;
    var api = window.XYAPI;

    /* 离线（file:// 或纯静态托管）：保持原演示行为 */
    if(!api || !api.online){
      window.toast("演示环境：订单已生成，正式上线后将接入支付与订单系统");
      setTimeout(function(){
        window.saveCart([]);
        window.updateCartBadge();
        renderCart();
      }, 1200);
      return;
    }

    checkoutBtn.disabled = true;
    checkoutBtn.textContent = "提交中…";
    api.createOrder(items.map(function(it){ return { id: it.id, qty: it.qty }; }))
      .then(function(order){
        /* 同步更新本地库存与销量，避免与数据库不一致 */
        items.forEach(function(it){
          var w = U.getWork(it.id);
          if(w){ w.stock = Math.max(0, (w.stock || 0) - it.qty); w.sales = (w.sales || 0) + it.qty; }
        });
        window.toast("下单成功！订单号 " + order.no + "，我们会在 24 小时内联系你 ✨");
        window.saveCart([]);
        window.updateCartBadge();
        renderCart();
      })
      .catch(function(err){
        window.toast(err && err.message ? err.message : "下单失败，请稍后再试");
      })
      .then(function(){
        checkoutBtn.textContent = "去结算";
        checkoutBtn.disabled = !window.getCart().length;
      });
  });

  render();
  renderCart();
})();
