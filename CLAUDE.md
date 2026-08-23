# 古伞文化馆 · 项目规约


## 项目是什么
一个展示中国传统油纸伞的网页文化馆。形态固定为「图鉴型」：
左侧伞目录 + 中间 3D 展台 + 下方文化解说。单页，无跳转。


作者是零基础，不会写代码。所有代码必须简单、可读、可解释。


## 唯一目标
让一个从没认真看过油纸伞的人，在 3 分钟内理解
「一把油纸伞由什么构成、它为什么好看」。


## 技术栈（锁定，未经我明确同意不得更换或新增）
- 纯 HTML + CSS + 原生 JavaScript（ES Module）
- 3D 用 Three.js，通过 CDN + importmap 引入，版本锁定 0.169.0
- 不使用任何构建工具（不用 Vite / Webpack / 不装 npm 包）
- 不使用任何框架（不用 React / Vue / Tailwind）
- 不引入额外 3D 库（不用 R3F / Babylon）


## 目录约定
gu-san-museum/
├── CLAUDE.md
├── index.html          正式页面
├── lab.html            调参台（开发自用，不上线）
├── data/
│   └── umbrellas.json  全部伞的数据，唯一数据来源
├── src/
│   ├── umbrella.js     伞的生成器（本项目核心资产）
│   ├── scene.js        场景、灯光、相机
│   └── app.js          页面逻辑
├── assets/
│   ├── patterns/       伞面纹样图（已备好 8 张）
│   ├── textures/       竹、木材质图
│   ├── craft/          工艺步骤插画
│   └── misc/           背景、分享图
└── tools/              自用小工具


## 已有素材（不要引用清单以外的文件名）
assets/patterns/：peony-crimson.png、westlake-ink.png、plum-ink.png、
  lotus-scroll.png、crane-cloud.png、bat-fortune.png、
  rain-bamboo.png、cloud-thunder.png
assets/textures/：bamboo-rib.png、wood-handle.png
assets/misc/：hall-bg.png、share-cover.png
assets/craft/：craft-01.png ~ craft-08.png


如果需要一张清单里没有的图，先停下来告诉我要生什么图、
什么尺寸、什么内容，等我生好放进去，不要用占位图或生成 SVG 凑数。


## 核心架构原则（违反即为 bug）
1. 所有伞共用同一个生成器。src/umbrella.js 里只能有一个
   createUmbrella(params) 函数，接收参数返回一个 Three.js Group。
   任何伞的差异都只能靠参数表达，不许为某把伞写特例分支。
2. 新增一把伞只允许改 data/umbrellas.json，不许动 src/ 下任何文件。
   如果做不到，说明抽象错了，要重构生成器，而不是加特例。
3. 代码里不许硬编码任何一句文化文字。所有文字来自 umbrellas.json。
4. 伞面必须支持透光（MeshPhysicalMaterial 的 transmission），
   逆光时伞骨要在伞面上投出剪影。这是本项目的视觉核心，不许简化掉。
5. 伞面贴图用极坐标 UV 映射：贴图是一张正圆平面图，
   映射到锥面后圆心必须在伞顶，图案不许扭曲。


## 内容真实性规则（最高优先级）
1. 任何涉及朝代、年份、地名、人名、非遗名录的表述，
   在 umbrellas.json 里必须有对应的 _source 字段写明来源。
2. 给不出确切来源的，_source 写 null，
   并在该条文字末尾加上【待核实】三个字。
3. 严禁为了内容丰满而编造年份、匠人姓名、非遗编号。宁可留空。


## 视觉方向
颜色从油纸伞题材本身提取：桐油纸的暖黄、竹青、朱砂、墨、雨天青灰。
明确禁止「米白底 + 陶土橙(#D97757 附近)」这种通用 AI 长相。
主视觉是 3D 伞，所以页面本身必须安静，不加多余装饰、
不加渐变卡片、不加 01/02/03 编号装饰。


## 怎么跟我配合
- 我是零基础，解释时不要用没说明的英文术语
- 改动超过两个文件时，先说方案等我确认，不要直接动手
- 每次改完告诉我三件事：改了哪些文件、我打开哪个页面、我该看到什么
- 我说「不对」的时候，只改我指出的那一处，别顺手改别的


## 明确不做（不许自己加）
- 不做登录、收藏、评论、后台、电商、多语言、VR
- 不生成占位图、假数据冒充真实内容
