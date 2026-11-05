/* ============================================================
   星语计划 · 首页渲染层验收脚本
   运行：node qa/verify-render.js
   用最小 DOM 桩真实执行 js/home.js，断言四个区块的渲染产物
   （沙箱内无法启动无头浏览器，故用此方式覆盖渲染逻辑）
   ============================================================ */
const fs = require("fs");
const vm = require("vm");
const path = require("path");
const root = path.join(__dirname, "..");

/* 1. 载入真实数据 */
const dataBox = { window: {} };
vm.createContext(dataBox);
vm.runInContext(fs.readFileSync(path.join(root, "js/data.js"), "utf8"), dataBox);
const X = dataBox.window.XINGYU;

/* 2. 最小 DOM 桩：记录各 id 被写入的 innerHTML */
const store = {};
const el = id => ({
  id,
  set innerHTML(v) { store[id] = v; },
  get innerHTML() { return store[id] || ""; }
});
const ctx = {
  window: { XINGYU: X },
  document: {
    querySelector: sel => (sel.startsWith("#") ? el(sel.slice(1)) : null),
    querySelectorAll: () => []
  },
  console
};
vm.createContext(ctx);

/* 3. XYUtil：与 js/main.js 暴露的接口保持一致 */
vm.runInContext(`
window.XYUtil = {
  $: function(sel){ return document.querySelector(sel); },
  esc: function(s){ return String(s==null?"":s); },
  getStudent: function(id){
    for(var i=0;i<window.XINGYU.students.length;i++){
      if(window.XINGYU.students[i].id===id) return window.XINGYU.students[i];
    }
    return null;
  },
  money: function(n){ return "¥"+n; },
  catInfo: function(id){ return window.XINGYU.categoryStyle[id] || {cls:"blue",label:id}; },
  workCardHTML: function(w){
    var st = window.XYUtil.getStudent(w.studentId);
    var cat = window.XYUtil.catInfo(w.category);
    return '<article class="work-card"><div class="work-cover"><img src="'+w.cover+'"></div>'+
      '<div class="work-info"><h3>'+w.title+'</h3>'+
      '<div class="work-meta"><span>'+st.nick+' · '+st.age+'岁 · '+st.city+'</span>'+
      '<span>'+cat.label+'</span></div>'+
      '<div class="work-bottom"><span class="work-price">'+window.XYUtil.money(w.price)+'</span></div>'+
      '</div></article>';
  }
};
`, ctx);

/* 4. 执行真实的 js/home.js */
vm.runInContext(fs.readFileSync(path.join(root, "js/home.js"), "utf8"), ctx);

const results = [];
const chk = (name, pass, extra) => results.push([name, !!pass, extra]);
const pillars = store.pillars || "";
const flows = store.flowSteps || "";
const works = store.hotWorks || "";
const stories = store.storyPreview || "";

/* 项目理念 */
chk("理念卡渲染 3 张", (pillars.match(/class="pillar-card"/g) || []).length === 3);
chk("理念卡无 undefined", !pillars.includes("undefined"));
chk("理念卡含「天赋发现」", pillars.includes("天赋发现"));
chk("理念卡图标 ✦✿☁ 齐全", ["✦", "✿", "☁"].every(i => pillars.includes(i)));

/* 公益闭环 */
chk("闭环渲染 6 步", (flows.match(/class="flow-step"/g) || []).length === 6);
chk("闭环含「公益捐赠」", flows.includes("公益捐赠"));
chk("闭环无 undefined", !flows.includes("undefined"));

/* 热门作品 */
chk("热门作品渲染 6 张", (works.match(/class="work-card"/g) || []).length === 6);
chk("作品卡无 undefined", !works.includes("undefined"));
chk("6 个新标题全部命中", ["金山蓝海 · 日月同辉", "一叶知秋 · 银杏", "清荷 · 莲心", "双生郁金香", "春信 · 花枝", "归航 · 海与星"].every(t => works.includes(t)));
chk("作品卡显示「姓名 · 年龄 · 太原」", /彤彤 · 12岁 · 太原/.test(works) && /小宇 · 11岁 · 太原/.test(works));
chk("作品卡引用 6 张 jsls 图", (works.match(/jsls-0[1-6]/g) || []).length === 6);
chk("作品卡分类标签为掐丝珐琅", works.includes("掐丝珐琅"));

/* 星星故事 */
chk("故事卡渲染 3 张", (stories.match(/story-preview-card/g) || []).length === 3);
chk("故事卡无方向文字", !stories.includes("掐丝珐琅 · "));
chk("故事卡无标签排", !stories.includes("story-tags"));
chk("故事卡为 朵朵/小宇/彤彤", ["朵朵", "小宇", "彤彤"].every(n => stories.includes(n)));
chk("故事卡格式「姓名 + 年龄岁 · 太原」", /<b>朵朵<\/b><span>9岁 · 太原<\/span>/.test(stories));
chk("故事卡无 undefined", !stories.includes("undefined"));

/* 输出 */
const pad = s => s + " ".repeat(Math.max(0, 34 - [...s].reduce((n, ch) => n + (ch.charCodeAt(0) > 255 ? 2 : 1), 0)));
results.forEach(([name, pass, extra]) => {
  console.log((pass ? "[PASS] " : "[FAIL] ") + pad(name) + (pass ? "" : (extra || "")));
});
const failed = results.filter(r => !r[1]).length;
console.log("\n渲染层断言：" + (results.length - failed) + "/" + results.length + " 通过" + (failed ? "，FAILED " + failed : ""));
process.exit(failed ? 1 : 0);
