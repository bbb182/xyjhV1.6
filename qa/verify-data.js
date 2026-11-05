/* ============================================================
   星语计划 · 数据层验收脚本
   运行：node qa/verify-data.js
   校验 js/data.js 是否符合《星语计划——非遗掐丝 星梦成真》项目计划书
   ============================================================ */
const fs = require("fs");
const vm = require("vm");
const path = require("path");
const root = path.join(__dirname, "..");

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, "js/data.js"), "utf8"), sandbox);
const X = sandbox.window.XINGYU;

const results = [];
const chk = (name, pass, extra) => results.push([name, !!pass, extra]);
const byId = id => X.students.find(s => s.id === id);

/* 1. 理念卡字段（修复 undefined 的根因） */
chk("pillars 数量 = 3", X.pillars.length === 3);
chk("pillars 全部含 name 字段", X.pillars.every(p => typeof p.name === "string" && p.name));
chk("pillars 不再使用 title 字段", X.pillars.every(p => p.title === undefined));
chk("pillars 图标非空", X.pillars.every(p => p.icon && p.icon.trim()));

/* 2. 公益闭环 6 步 */
const flowNames = X.flow.map(f => f.name);
chk("flow 步数 = 6", X.flow.length === 6, flowNames.join(" → "));
chk("flow 含「公益捐赠」", flowNames.includes("公益捐赠"));
chk("flow 不含「工艺捐赠」", !flowNames.includes("工艺捐赠"));
chk("flow 编号 01-06 连续", X.flow.map(f => f.no).join(",") === "01,02,03,04,05,06");

/* 3. 首页 6 件作品 */
const hot = X.works.slice(0, 6);
chk("首页作品数 = 6", hot.length === 6);
chk("作品标题全部为新标题", hot.every(w => /金山蓝海|一叶知秋|清荷|双生郁金香|春信|归航/.test(w.title)));
chk("作品封面全部为 jsls 图", hot.every(w => /^images\/works\/jsls-0[1-6]-/.test(w.cover)));
chk("作品封面文件存在", hot.every(w => fs.existsSync(path.join(root, w.cover))));
chk("作品分类已改为掐丝珐琅体系", hot.every(w => ["intangible", "collection"].includes(w.category)));
chk("作品作者存在", hot.every(w => byId(w.studentId)));
chk("作品作者年龄 9-12", hot.every(w => { const s = byId(w.studentId); return s && s.age >= 9 && s.age <= 12; }));
chk("作品作者城市 = 太原", hot.every(w => { const s = byId(w.studentId); return s && s.city === "太原"; }));
chk("作品文案含真实工序", hot.every(w => /取丝|弯折|粘贴|填色|点蓝/.test(w.story.how)));
chk("作品 features 含爱心证书", hot.every(w => w.features.join(" ").includes("爱心证书")));
chk("作品 features 含 30% 捐赠", hot.every(w => w.features.join(" ").includes("30%")));

/* 4. 计划书三档定价 */
const inTier = p => (p >= 30 && p <= 80) || (p > 80 && p <= 200) || p > 200;
chk("价格落在计划书三档", hot.every(w => inTier(w.price)), hot.map(w => w.price).join(","));

/* 5. 首页故事三卡 */
const picks = ["s6", "s2", "s1"].map(byId);
chk("故事卡三人存在", picks.every(Boolean));
chk("故事卡年龄 9-12", picks.every(s => s && s.age >= 9 && s.age <= 12));
chk("故事卡城市 = 太原", picks.every(s => s && s.city === "太原"));
chk("故事卡姓名为 朵朵/小宇/彤彤", picks.map(s => s && s.nick).join(",") === "朵朵,小宇,彤彤", picks.map(s => s && s.nick).join(" / "));

/* 6. 页脚联系方式 */
const c = X.site.contact;
chk("电话 = 15333616763", c.phone === "15333616763", c.phone);
chk("邮箱 = 1917788499@qq.com", c.email === "1917788499@qq.com", c.email);
chk("地址 = 山西省太原市小店区", c.address === "山西省太原市小店区", c.address);
chk("已删除微信字段", c.wechat === undefined);

/* 7. 全站禁用词 */
const banned = ["同情", "怜悯", "公益售卖", "工艺捐赠", "知性合一", "1286", "3652", "128万", "杭州", "苏州", "上海"];
const blob = JSON.stringify({ w: X.works, s: X.students, f: X.flow, p: X.pillars, t: X.transparency, r: X.roles, pt: X.partners });
const hit = banned.filter(b => blob.includes(b));
chk("禁用词 0 命中", hit.length === 0, hit.join(","));

/* 8. 计划书事实口径 */
chk("统计数字 = 549/32/20", X.stats.map(s => s.value).join(",") === "549,32,20");
chk("透明数据含 30% 捐赠比例", X.transparency.expense.items.some(i => i.pct === 30) || JSON.stringify(X.transparency).includes("30%"));
chk("透明数据含中国残疾人福利基金会", JSON.stringify(X.transparency).includes("中国残疾人福利基金会"));
chk("合作校含小店区特教中心小学校", JSON.stringify(X.partners).includes("小店区特殊教育中心小学校"));
chk("团队含 5 名核心成员", X.team.length === 5, X.team.map(t => t.name).join("/"));
chk("顾问含毕志勇与柴琼", JSON.stringify(X.advisors).includes("毕志勇") && JSON.stringify(X.advisors).includes("柴琼"));

/* 输出 */
const pad = s => s + " ".repeat(Math.max(0, 34 - [...s].reduce((n, ch) => n + (ch.charCodeAt(0) > 255 ? 2 : 1), 0)));
results.forEach(([name, pass, extra]) => {
  console.log((pass ? "[PASS] " : "[FAIL] ") + pad(name) + (pass ? "" : (extra || "")));
});
const failed = results.filter(r => !r[1]).length;
console.log("\n数据层断言：" + (results.length - failed) + "/" + results.length + " 通过" + (failed ? "，FAILED " + failed : ""));
process.exit(failed ? 1 : 0);
