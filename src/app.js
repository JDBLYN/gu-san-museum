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
    rebuild();
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
}

// 造伞：把当前参数交给 umbrella.js 生成一把新伞
function rebuild() {
  if (umbrella) scene.remove(umbrella);

  umbrella = createUmbrella({
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
  scene.add(umbrella);
}

// —— 动画循环：伞缓慢自转，每一帧画一次 ——
function animate() {
  requestAnimationFrame(animate);
  if (umbrella) umbrella.rotation.y += 0.004; // 缓慢自转
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
