/* 作品展示页：分类 / 搜索 / 排序 / 加载更多 */
(function(){
  var X = window.XINGYU;
  if(!X) return;
  var U = window.XYUtil;
  var $ = U.$;

  var state = {
    cat: "all",
    keyword: "",
    sort: "latest",
    shown: 9
  };

  var grid = $("#worksGrid");
  var empty = $("#worksEmpty");
  var chipsBox = $("#catChips");
  var searchBox = $("#worksSearch");
  var sortBox = $("#worksSort");
  if(!grid || !chipsBox) return;

  /* 读取 URL 参数 */
  var qs = new URLSearchParams(location.search);
  state.cat = qs.get("cat") || "all";
  state.keyword = qs.get("q") || "";
  if(searchBox) searchBox.value = state.keyword;
  if(!X.categories.some(function(c){ return c.id === state.cat; })) state.cat = "all";

  /* 分类按钮 */
  chipsBox.innerHTML = X.categories.map(function(c){
    return '<button class="chip'+(state.cat===c.id?" active":"")+'" data-cat="'+c.id+'">'+c.name+'</button>';
  }).join("");
  chipsBox.addEventListener("click", function(e){
    var btn = e.target.closest(".chip");
    if(!btn) return;
    state.cat = btn.getAttribute("data-cat");
    state.shown = 9;
    chipsBox.querySelectorAll(".chip").forEach(function(b){ b.classList.toggle("active", b===btn); });
    render();
  });

  /* 搜索 */
  var timer = null;
  if(searchBox) searchBox.addEventListener("input", function(){
    clearTimeout(timer);
    timer = setTimeout(function(){
      state.keyword = searchBox.value.trim();
      state.shown = 9;
      render();
    }, 260);
  });

  /* 排序 */
  if(sortBox) sortBox.addEventListener("change", function(){
    state.sort = sortBox.value;
    state.shown = 9;
    render();
  });

  function filterList(){
    var kw = state.keyword.toLowerCase();
    return X.works.filter(function(w){
      var st = U.getStudent(w.studentId);
      if(state.cat !== "all" && w.category !== state.cat) return false;
      if(kw && w.title.toLowerCase().indexOf(kw) < 0 && st.nick.toLowerCase().indexOf(kw) < 0) return false;
      return true;
    }).sort(function(a,b){
      if(state.sort === "priceAsc") return a.price - b.price;
      if(state.sort === "priceDesc") return b.price - a.price;
      if(state.sort === "sales") return b.sales - a.sales;
      return (b.date < a.date) ? -1 : 1;
    });
  }

  function render(){
    var list = filterList();
    var catName = X.categories.filter(function(c){ return c.id === state.cat; })[0].name;
    var title = $("#listTitle");
    if(title) title.textContent = catName;
    var count = $("#listCount");
    if(count) count.textContent = "共 " + list.length + " 件作品";

    empty.style.display = list.length ? "none" : "block";
    grid.innerHTML = list.slice(0, state.shown).map(U.workCardHTML).join("");
    var more = $("#loadMore");
    if(more) more.style.display = list.length > state.shown ? "inline-flex" : "none";
  }

  $("#loadMore").addEventListener("click", function(){
    state.shown += 6;
    render();
  });

  render();
})();
