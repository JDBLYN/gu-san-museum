// 页面逻辑：读数据 → 左侧目录 → 中间 3D 展台。
// 这一版把伞放进中间，加上：缓慢自转、鼠标拖动旋转、滚轮缩放，
// 右下角放两个控制：开合、纹样。
//
// 规则：这里不许硬编码任何一句文化文字，伞名都从 data/umbrellas.json 读。

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createStage } from './scene.js';
import { createUmbrella } from './umbrella.js';

const canvas = document.getElementById('stage');
const { renderer, scene, camera } = createStage(canvas);

// 拖动旋转 + 滚轮缩放（OrbitControls 是三件套自带的现成控件）
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.1, 0); // 围绕伞的中心转
controls.enableDamping = true;  // 带一点惯性，手感顺
controls.dampingFactor = 0.08;

let data = null;           // umbrellas.json 的内容
let currentItem = null;    // 当前选中的那把伞的数据
let umbrella = null;       // 当前造出来的伞
let openAmount = 1;        // 当前开合量（0 合拢，1 全开）
let currentPattern = null; // 当前纹样文件名（null = 无贴图 / 纯色）

// —— 动效参数 ——
const ROTATION_SPEED = 0.0015; // 自转速度：弧度/帧，越小越慢（60 帧/秒下约 70 秒一圈）
const FADE_MS = 200;           // 切纹样淡入淡出：前后各 200 毫秒，共 400 毫秒
let fade = null;               // 正在进行的淡入淡出（null = 没有）

// 伞面纹样清单：文件名严格按 CLAUDE.md 的清单，不许引用清单外文件。
// 名字是给下拉框看的界面标签（沿用调参台 lab.html 的叫法）。
const PATTERNS = [
  { name: '无贴图', file: null },
  { name: '牡丹·朱红', file: 'peony-crimson.png' },
  { name: '西湖·墨', file: 'westlake-ink.png' },
  { name: '梅花·墨', file: 'plum-ink.png' },
  { name: '莲花·卷草', file: 'lotus-scroll.png' },
  { name: '仙鹤·云', file: 'crane-cloud.png' },
  { name: '蝙蝠·福', file: 'bat-fortune.png' },
  { name: '雨竹', file: 'rain-bamboo.png' },
  { name: '云雷', file: 'cloud-thunder.png' },
];

// 预加载伞骨（竹）、手柄（木）两张材质贴图，只加载一次
const textureLoader = new THREE.TextureLoader();
const ribTexture = textureLoader.load('assets/textures/bamboo-rib.png');
const handleTexture = textureLoader.load('assets/textures/wood-handle.png');
ribTexture.colorSpace = THREE.SRGBColorSpace;   // 颜色按 sRGB 处理，颜色才准
handleTexture.colorSpace = THREE.SRGBColorSpace;

// 预加载 8 张伞面纹样，切换时零等待
const patternTextures = {};
for (const pt of PATTERNS) {
  if (pt.file) {
    const tex = textureLoader.load('assets/patterns/' + pt.file);
    tex.colorSpace = THREE.SRGBColorSpace;
    patternTextures[pt.file] = tex;
  }
}

// —— 开始：加载数据 ——
async function start() {
  const response = await fetch('data/umbrellas.json');
  data = await response.json();
  buildCatalog(data.umbrellas);
  buildPatternOptions();
  setupTabs();
  await selectUmbrella(data.umbrellas[0].id);
}

// 左侧目录：从 umbrellas.json 循环渲染，一把伞一个按钮
function buildCatalog(list) {
  const catalog = document.getElementById('catalog');
  list.forEach((item) => {
    const button = document.createElement('button');
    button.textContent = item.name;  // 伞名来自数据文件
    button.dataset.id = item.id;
    button.addEventListener('click', () => selectUmbrella(item.id));
    catalog.appendChild(button);
  });
}

// 纹样下拉框：填选项 + 绑定切换
function buildPatternOptions() {
  const select = document.getElementById('pattern-select');
  PATTERNS.forEach((pt) => {
    const opt = document.createElement('option');
    opt.value = pt.file == null ? '' : pt.file;
    opt.textContent = pt.name;
    select.appendChild(opt);
  });
  select.addEventListener('change', () => {
    currentPattern = select.value === '' ? null : select.value;
    applyPattern(); // 切纹样走淡入淡出，不直接重建
  });
}

// 开合滑块：拖动时重建伞
document.getElementById('open-slider').addEventListener('input', (e) => {
  openAmount = parseFloat(e.target.value);
  rebuild();
});

// 选中一把伞：高亮目录项 + 让两个控制同步 + 造伞
function selectUmbrella(id) {
  document.querySelectorAll('#catalog button').forEach((b) => {
    b.classList.toggle('active', b.dataset.id === id);
  });

  currentItem = data.umbrellas.find((u) => u.id === id);

  // 从数据里读出这把伞的初始开合量、纹样
  openAmount = currentItem.geometry.openAmount ?? 1;
  currentPattern = currentItem.material.canopyTexture || null;

  // 让两个控制跟数据同步
  document.getElementById('open-slider').value = openAmount;
  document.getElementById('pattern-select').value = currentPattern || '';

  rebuild();
  renderCulture(currentItem);
}

// 用当前参数造一把新伞（只造，不放进场景，由 rebuild / applyPattern 决定怎么放）
function buildUmbrella() {
  return createUmbrella({
    // 这些参数都能直接从数据文件里读到
    ribCount: currentItem.geometry.ribCount,
    canopyRise: currentItem.geometry.canopyRise,
    openAmount: openAmount,
    canopyColor: currentItem.material.canopyColor,
    transmission: currentItem.material.transmission,
    roughness: currentItem.material.roughness,
    colors: { rib: currentItem.material.ribColor },
    textures: { rib: ribTexture, handle: handleTexture },
    canopyTexture: currentPattern ? patternTextures[currentPattern] : null,
  });
}

// 释放一把伞占用的几何体和材质，防止反复换伞把内存越堆越大。
// 注意：只释放「这把伞自己的」几何体和材质；伞骨、手柄、纹样这三张贴图是全局共用的，
// 释放材质不会连累贴图，所以贴图不用管。
function disposeGroup(group) {
  group.traverse((obj) => {
    if (obj.isMesh) {
      obj.geometry.dispose();
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((m) => m.dispose());
    }
  });
}

// 立刻换伞（开合滑块、换整把伞时用，不需要过渡）
function rebuild() {
  cancelFade(); // 万一有淡入淡出进行到一半，先结束它
  const next = buildUmbrella();
  if (umbrella) {
    scene.remove(umbrella);
    disposeGroup(umbrella);
  }
  umbrella = next;
  scene.add(umbrella);
}

// 设置一把伞所有材质的透明度（淡入淡出用）。opacity = 1 表示完全不透明。
function setGroupFade(group, opacity) {
  group.traverse((obj) => {
    if (!obj.isMesh) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    mats.forEach((m) => {
      const wantTransparent = opacity < 1;
      if (m.transparent !== wantTransparent) {
        m.transparent = wantTransparent; // 只有变透明才开这个开关
        m.needsUpdate = true;            // 透明开关变化要通知渲染器重编译
      }
      m.opacity = opacity;
    });
  });
}

// 切纹样：旧伞先淡出、新伞再淡入，各 FADE_MS 毫秒（共 400 毫秒）
function applyPattern() {
  cancelFade(); // 上次没淡完就再来一次，先把上次收尾
  const next = buildUmbrella();
  next.rotation.y = umbrella.rotation.y; // 新伞接着旧伞的角度，不「跳一下」
  scene.add(next);
  setGroupFade(next, 0); // 新伞先全透明，等旧伞淡出后再显出来
  fade = { start: performance.now(), oldGroup: umbrella, newGroup: next };
  umbrella = next;
}

// 立刻结束进行中的淡入淡出：旧伞移除，新伞（当前 umbrella）恢复可见
function cancelFade() {
  if (!fade) return;
  scene.remove(fade.oldGroup);
  disposeGroup(fade.oldGroup);
  setGroupFade(fade.newGroup, 1);
  fade = null;
}

// 每一帧推进淡入淡出
function updateFade() {
  if (!fade) return;
  const t = performance.now() - fade.start;
  if (t < FADE_MS) {
    // 前半段：旧伞淡出 1 → 0
    setGroupFade(fade.oldGroup, 1 - t / FADE_MS);
    setGroupFade(fade.newGroup, 0);
  } else if (t < FADE_MS * 2) {
    // 后半段：新伞淡入 0 → 1
    setGroupFade(fade.oldGroup, 0);
    setGroupFade(fade.newGroup, (t - FADE_MS) / FADE_MS);
  } else {
    // 结束：新伞完全可见，旧伞移除释放
    setGroupFade(fade.newGroup, 1);
    scene.remove(fade.oldGroup);
    disposeGroup(fade.oldGroup);
    fade = null;
  }
}

// —— 下方文化解说：三个标签页的内容都从数据里读 ——

// 三个标签页的切换
function setupTabs() {
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
      document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
    });
  });
}

// 选中伞后，把它的文化内容填进三个标签页
function renderCulture(item) {
  // 「形制」页：形制特征、典型尺寸、主要用材
  renderFacts('panel-form', item.culture, ['shape', 'size', 'materials']);
  // 「纹样」页：纹样主题、纹样寓意
  renderFacts('panel-pattern', item.culture, ['patternTheme', 'patternMeaning']);
  // 「工艺」页：8 个步骤
  renderCraft('panel-craft', item.craftSteps);
}

// 形制、纹样：按字段顺序渲染，没填文字的字段跳过不显示
function renderFacts(panelId, culture, keys) {
  const panel = document.getElementById(panelId);
  panel.innerHTML = '';
  keys.forEach((key) => {
    const field = culture[key];
    if (!field || !field.text) return; // 空字段不显示
    const box = document.createElement('div');
    box.className = 'fact';

    const title = document.createElement('h3');
    title.textContent = field.name; // 栏目名来自数据

    const text = document.createElement('p');
    text.textContent = field.text;  // 正文来自数据

    box.appendChild(title);
    box.appendChild(text);
    renderNote(box, field); // 标注：分级 · 来源
    panel.appendChild(box);
  });
}

// 标注：每条说明/步骤下方的小字「分级 · 来源」，数据里没填就不显示
function renderNote(container, field) {
  const hasLevel = field.level && field.level.trim();
  const hasSource = field._source;
  if (!hasLevel && !hasSource) return;

  const note = document.createElement('div');
  note.className = 'note';

  if (hasLevel) {
    const lv = document.createElement('span');
    lv.textContent = field.level; // 分级：史实 / 推断 / 传说
    note.appendChild(lv);
  }
  if (hasLevel && hasSource) {
    note.appendChild(document.createTextNode(' · '));
  }
  if (hasSource) {
    const link = document.createElement('a');
    link.href = field._source; // 来源链接
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = '来源';
    note.appendChild(link);
  }
  container.appendChild(note);
}

// 工艺：8 个步骤按顺序排成一行，每步配一张插画
function renderCraft(panelId, steps) {
  const panel = document.getElementById(panelId);
  panel.innerHTML = '';

  const row = document.createElement('div');
  row.className = 'craft-steps';

  steps.forEach((step) => {
    const card = document.createElement('div');
    card.className = 'craft-step';

    const img = document.createElement('img');
    img.src = step.image; // 插画路径来自数据
    img.alt = step.name;

    const name = document.createElement('h3');
    name.textContent = step.name; // 步骤名来自数据

    const desc = document.createElement('p');
    desc.textContent = step.desc; // 步骤说明来自数据

    card.appendChild(img);
    card.appendChild(name);
    card.appendChild(desc);
    renderNote(card, step); // 标注：分级 · 来源
    row.appendChild(card);
  });

  panel.appendChild(row);
}

// —— 动画循环：伞缓慢自转，每一帧画一次 ——
function animate() {
  requestAnimationFrame(animate);
  if (umbrella) umbrella.rotation.y += ROTATION_SPEED; // 缓慢自转
  updateFade(); // 切纹样的淡入淡出
  controls.update();
  renderer.render(scene, camera);
}

// 窗口大小变化时，重新匹配画布尺寸
function resize() {
  const box = canvas.parentElement;
  const width = box.clientWidth;
  const height = box.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}
window.addEventListener('resize', resize);

start();
resize();
animate();
