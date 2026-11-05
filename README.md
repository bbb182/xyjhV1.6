# 星语计划 · 特殊少年原创作品展示与公益售卖平台

一个温暖、治愈、有艺术感的公益文创官网：**作品展示 + 公益商城 + 星星故事 + 公益公开 + 加入我们**，PC 与手机自适应，数据与页面分离，方便日后随时增改内容。

## 页面清单

| 页面 | 文件 | 说明 |
| --- | --- | --- |
| 首页 | `index.html` | 首屏、项目理念、公益闭环、热门作品、星星故事、数据展示、支持 CTA |
| 作品展示 | `works.html` | 线上艺术馆：分类、搜索、排序、加载更多 |
| 作品详情 | `detail.html?id=w01` | 大图细节、创作故事、艺术特点、作者档案、同类推荐 |
| 公益商城 | `mall.html` | 商品列表、搜索筛选、排序、购物车、去结算 |
| 星星故事 | `stories.html` | 学生卡片 + 成长时间轴，匿名展示与隐私说明 |
| 项目介绍 | `about.html` | 背景、理念、服务内容、项目模式、合作伙伴 |
| 公益公开 | `public.html` | 数据卡片、收入/支出图表、资金流向图、**资金流水明细、月度趋势、披露报告** |
| 爱心证书 | `certificate.html?no=XY...` | 输入订单号查询爱心证书（30% 捐赠额、受助编号、善款去向），可打印 |
| 加入我们 | `join.html` | 志愿者/企业/学校/公益组织角色卡 + 报名表单 |
| 管理后台 | `admin.html` | 学生、作品、订单、销售、**申请审核**、资金、披露（订单/资金/申请读数据库） |

## 日常维护：改内容只动一个文件

所有作品、学生、公益数据都集中在 **`js/data.js`**，页面会自动渲染，不需要改 HTML：

### 新增一件作品
在 `js/data.js` 的 `works` 数组末尾加一个对象：

```js
{
  id: "w14",                    // 唯一编号
  title: "作品名称",
  studentId: "s1",              // 对应 students 里的 id
  category: "paint",            // paint 绘画 / hand 手工 / culture 文创 / intangible 非遗 / music 音乐
  date: "2026.08",
  price: 168,
  stock: 20,
  sales: 0,
  likes: 0,
  badge: "新品",                 // 不想要可留 null
  cover: "images/works/w14.svg",// 把作品图放进 images/works/
  story: { why: "为什么创作", how: "创作过程", meaning: "作品意义" },
  features: ["特点 1", "特点 2"]
}
```

### 新增一位学生 / 一段成长记录
在 `students` 数组添加对象（昵称建议匿名，如「小星星」），`milestones` 数组里的每一条会自动变成时间轴节点。

### 修改公益数据
编辑 `transparency` 对象里的收入/支出比例、金额与月度披露表即可。

## 项目结构

```
星语计划网页/
├─ index.html / works.html / detail.html / mall.html
├─ stories.html / about.html / public.html / join.html / admin.html / certificate.html
├─ server.js               # 本地服务器：静态站点 + REST API（含自动导入）
├─ css/style.css           # 设计系统 + 全部页面样式 + 响应式
├─ js/
│  ├─ data.js              # ★ 文案与内容配置（日常维护改这里）
│  ├─ api.js               # 数据接入层：从 /api/bootstrap 取库数据，失败回退 data.js
│  ├─ main.js              # 页头页脚、购物车、动画、公共工具
│  └─ home/works/detail/mall/stories/about/public/join/admin/certificate.js
├─ db/
│  ├─ schema.sql           # 表结构（10 张表）
│  ├─ db.js                # 连接与初始化（node:sqlite）
│  ├─ seed.js              # 从 js/data.js 导入初始数据
│  └─ repo.js              # 查询层：输出与 data.js 同构的对象
├─ docs/数据库设计.md       # 表结构、接口、数据流、扩展建议
├─ images/                 # 作品图、头像、Logo
├─ qa/
│  ├─ check.mjs            # 页面质检（file:// 离线，9 页 × 2 尺寸）
│  ├─ interact.mjs         # 交互功能验证
│  ├─ verify-data.js       # 数据层断言（35 项）
│  ├─ verify-render.js     # 渲染层断言（19 项）
│  ├─ verify-db.js         # 数据库与接口断言（53 项）
│  └─ verify-db-web.mjs    # 浏览器端端到端验收（22 项）
└─ README.md
```

## 本地预览

**推荐：用内置服务器启动**（同时开启数据库与接口）

```bash
node server.js          # → http://localhost:8080
```

首次启动会自动把 `js/data.js` 的内容导入 SQLite（`db/xingyu.db`），之后页面数据来自数据库。

**也可以纯静态打开：** 直接双击 `index.html`，或用任意静态服务器
（如 `python -m http.server 8080` ）。此时接口不可用，站点会自动回退到 `js/data.js`，功能完全正常。

## 数据库（SQLite，零依赖）

项目内置一层数据库，用来存放**会持续变化的记录**：学生档案、成长记录、作品、订单、资金流水、报名申请、披露报告、月度账目。
站点文案类配置（导航、理念卡、闭环步骤、团队等）仍集中在 `js/data.js`，改文案不需要动库。

```bash
node db/seed.js           # 从 js/data.js 导入初始数据（幂等，可反复执行）
node db/seed.js --reset   # 清空后重新导入
node server.js            # 启动站点 + REST API
```

| 常用接口 | 说明 |
|---|---|
| `GET /api/health` | 健康检查（库路径、各表行数） |
| `GET /api/bootstrap` | 全站渲染数据（前端 `js/api.js` 使用） |
| `GET /api/works?category=&q=&sort=` | 作品查询 |
| `GET /api/orders` · `POST /api/orders` | 订单列表 / 下单（服务端按库价重算金额并扣库存） |
| `GET/POST /api/applications` | 报名申请 |
| `GET /api/funds` · `GET /api/dashboard` | 资金流水与后台汇总 |

- 技术选型：Node 内置 `node:sqlite`（Node ≥ 22.5），**不需要 npm install**
- 数据流：`js/data.js`（文案）→ `db/seed.js` → SQLite → `db/repo.js` → `/api/bootstrap` → `js/api.js` 覆盖 `window.XINGYU` → 页面脚本
- 离线回退：`file://` 或纯静态托管时自动使用 `js/data.js`
- 表结构、接口清单与扩展建议见 **[docs/数据库设计.md](docs/数据库设计.md)**（第九节有「库表 → 页面 → 展示形式」对照表）


## 自动化质检

安装本机 Chrome 后运行（自动检查 9 个页面 × 桌面/手机两种尺寸的横向溢出、图片加载与 JS 报错，并截图到 `_preview/`）：

```bash
node qa/check.mjs
```

交互功能验证（分类筛选、搜索、购物车、表单、图表等）：

```bash
node qa/interact.mjs
```

数据与数据库验收（前两项不需要浏览器，后两项会起临时端口与临时库）：

```bash
node qa/verify-data.js      # 数据层 35 项
node qa/verify-render.js    # 渲染层 19 项
node qa/verify-db.js        # 数据库 + HTTP 接口 60 项
node qa/verify-db-web.mjs   # 浏览器端到端 42 项（含报名落库、下单扣库存、证书查询、申请审核）
```

## 上线部署建议

- **纯静态托管**（Vercel / Netlify / GitHub Pages / 阿里云 OSS + CDN）仍可直接部署，此时自动回退到 `js/data.js`，无需数据库。
- **需要数据库**时（报名、订单、后台可写）需部署 Node 环境：把 `db/xingyu.db` 放在可写目录并设置 `XY_DB`；或参考 `docs/数据库设计.md` 第八节迁移到 MySQL。
- 域名与备案：正式上线前完成 ICP 备案，并把 `js/data.js` 里的备案号替换为真实备案号。
- **安全**：当前接口未做鉴权，仅适合本地演示/内网演示；公网部署前必须补登录与权限控制，并禁止直接访问 `/db/` 与 `*.db`（服务器已默认拦截）。
- 真实后台：`admin.html` 已改为读取数据库（订单、资金、披露），可继续扩展编辑与审核操作。
- 素材替换：作品图是矢量 SVG 或实拍 PNG，直接改 `cover` 字段即可。

## 设计说明

- 主色：浅蓝 `#5B93C8`、米白 `#FBF8F1`、暖黄 `#F6C453`；辅助：淡紫 `#B9A9E4`、浅绿 `#A7CDB4`。
- 风格关键词：星光、成长、陪伴、希望、艺术、包容；避免悲情化，突出天赋与价值。
- 学生信息全部匿名展示，页面中已含隐私保护说明。
