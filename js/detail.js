/* 作品详情页：根据 ?id= 渲染 */
(function(){
  var X = window.XINGYU;
  if(!X) return;
  var U = window.XYUtil;
  var $ = U.$;

  var qs = new URLSearchParams(location.search);
  var w = U.getWork(qs.get("id") || "w01") || X.works[0];
  var st = U.getStudent(w.studentId);
  var cat = U.catInfo(w.category);

  document.title = w.title + " · 星语计划";

  /* 面包屑 */
  $("#crumb").innerHTML =
    '<a href="index.html">首页</a><span class="sep">/</span>'+
    '<a href="works.html">作品展示</a><span class="sep">/</span><span>'+U.esc(w.title)+'</span>';

  /* Hero */
  $("#heroTitle").textContent = w.title;

  /* 大图与缩略图（细节放大视图） */
  var mainImg = $("#mainImage");
  mainImg.src = w.cover;
  mainImg.alt = w.title;
  var views = [
    { label: "原图", style: "" },
    { label: "细节 1", style: "transform:scale(1.85);transform-origin:22% 28%" },
    { label: "细节 2", style: "transform:scale(1.85);transform-origin:80% 72%" }
  ];
  $("#galleryThumbs").innerHTML = views.map(function(v, i){
    return '<img src="'+w.cover+'" alt="'+v.label+'" class="'+(i===0?"on":"")+'" data-view="'+i+'">';
  }).join("");
  $("#galleryThumbs").addEventListener("click", function(e){
    var t = e.target.closest("img");
    if(!t) return;
    var i = parseInt(t.getAttribute("data-view"), 10);
    mainImg.style.cssText = views[i].style;
    this.querySelectorAll("img").forEach(function(im){ im.classList.toggle("on", im===t); });
  });

  /* 信息卡 */
  var was = w.originalPrice ? '<span class="was">'+U.money(w.originalPrice)+'</span>' : '';
  var badge = w.badge ? '<span class="tag warm">'+U.esc(w.badge)+'</span>' : '';
  $("#infoCard").innerHTML =
    '<div class="info-tags">'+
      '<span class="tag '+cat.cls+'">'+cat.label+'</span>'+
      badge+
      '<span class="tag green">原创作品</span>'+
    '</div>'+
    '<h2 class="detail-title">'+U.esc(w.title)+'</h2>'+
    '<div class="author-row">'+
      '<img src="'+st.avatar+'" alt="'+st.nick+'">'+
      '<div><b>'+st.nick+'</b><span>'+st.age+'岁 · '+st.city+' · '+st.direction+'</span></div>'+
      '<a class="to-story" href="stories.html#student-'+st.id+'">看他的故事 →</a>'+
    '</div>'+
    '<ul class="meta-list">'+
      '<li>作品类别<b>'+cat.label+'</b></li>'+
      '<li>创作时间<b>'+w.date+'</b></li>'+
      '<li>作品编号<b>XY-'+w.id.toUpperCase()+'</b></li>'+
      '<li>累计销量<b>'+w.sales+' 件</b></li>'+
    '</ul>'+
    '<div class="price-row">'+
      '<span class="now">'+U.money(w.price)+'</span>'+was+
    '</div>'+
    '<p class="stock-note"><em>●</em> '+(w.stock>50 ? "库存充足" : "仅剩 "+w.stock+" 件")+' · 收益将公开透明地用于孩子成长支持</p>'+
    '<div class="buy-row">'+
      '<span class="qty">'+
        '<button type="button" id="qtyMinus">−</button>'+
        '<input id="qtyInput" type="text" value="1" inputmode="numeric">'+
        '<button type="button" id="qtyPlus">+</button>'+
      '</span>'+
      '<button class="btn btn-warm" id="buyNow" style="height:48px">立即购买</button>'+
      '<button class="btn btn-primary" id="addCart" style="height:48px">加入购物车</button>'+
      '<button class="action-btn" id="likeBtn">♡ 收藏</button>'+
      '<button class="action-btn" id="shareBtn">↗ 分享</button>'+
    '</div>'+
    '<div class="notice-box">💛 购买的不只是一件作品，更是一份对特殊少年才华的认可。</div>';

  /* 数量 */
  var qtyInput = $("#qtyInput");
  $("#qtyMinus").addEventListener("click", function(){
    var n = parseInt(qtyInput.value,10) || 1;
    if(n>1) qtyInput.value = n-1;
  });
  $("#qtyPlus").addEventListener("click", function(){
    var n = parseInt(qtyInput.value,10) || 1;
    qtyInput.value = Math.min(n+1, w.stock);
  });

  /* 购买 */
  $("#addCart").addEventListener("click", function(){
    window.addToCart(w.id, parseInt(qtyInput.value,10) || 1);
  });
  $("#buyNow").addEventListener("click", function(){
    window.addToCart(w.id, parseInt(qtyInput.value,10) || 1);
    setTimeout(function(){ location.href = "mall.html"; }, 700);
  });

  /* 收藏 */
  var liked = false;
  $("#likeBtn").addEventListener("click", function(){
    liked = !liked;
    this.classList.toggle("liked", liked);
    this.innerHTML = liked ? "♥ 已收藏" : "♡ 收藏";
    window.toast(liked ? "已收藏，感谢你的喜欢" : "已取消收藏");
  });

  /* 分享 */
  $("#shareBtn").addEventListener("click", function(){
    var url = location.href;
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(url).then(function(){
        window.toast("作品链接已复制，快分享给朋友吧");
      }, function(){ window.toast("链接：" + url); });
    } else {
      window.toast("链接：" + url);
    }
  });

  /* 创作故事 */
  $("#storyText").innerHTML =
    '<h4>为什么创作这件作品</h4><p>'+U.esc(w.story.why)+'</p>'+
    '<h4>创作过程</h4><p>'+U.esc(w.story.how)+'</p>'+
    '<h4>作品的意义</h4><p>'+U.esc(w.story.meaning)+'</p>';

  /* 艺术特点 */
  $("#featureList").innerHTML = w.features.map(function(f){
    return '<li><span class="dot">✓</span>'+U.esc(f)+'</li>';
  }).join("");

  /* 作者档案 */
  $("#studentPanel").innerHTML =
    '<img src="'+st.avatar+'" alt="'+st.nick+'">'+
    '<div>'+
      '<h4>'+st.nick+' · '+st.age+'岁</h4>'+
      '<p>'+st.bio+'</p>'+
    '</div>'+
    '<a class="btn btn-primary btn-sm" href="stories.html#student-'+st.id+'">阅读成长故事</a>';

  /* 同类推荐 */
  var related = X.works.filter(function(x){ return x.category === w.category && x.id !== w.id; });
  if(related.length < 3){
    X.works.forEach(function(x){
      if(related.length >= 3) return;
      if(x.id !== w.id && !related.some(function(r){ return r.id === x.id; })) related.push(x);
    });
  }
  $("#relatedGrid").innerHTML = related.slice(0,3).map(U.workCardHTML).join("");
})();
