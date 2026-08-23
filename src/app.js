// 页面逻辑：读数据 → 造伞 → 切换 → 旋转。

import * as THREE from 'three';
import { createStage } from './scene.js';
import { createUmbrella } from './umbrella.js';

const canvas = document.getElementById('stage');
const { renderer, scene, camera } = createStage(canvas);

let data = null;          // umbrellas.json 的内容
let umbrellaGroup = null; // 当前这把伞
let spinning = true;      // 是否自动转

// —— 开始：加载数据 ——
async function start() {
  const response = await fetch('data/umbrellas.json');
  data = await response.json();
  buildCatalog(data.umbrellas);
  await selectUmbrella(data.umbrellas[0].id);
}

// 左侧目录
function buildCatalog(list) {
  const catalog = document.getElementById('catalog');
  list.forEach((item) => {
    const button = document.createElement('button');
    button.textContent = item.name;
    button.addEventListener('click', () => selectUmbrella(item.id));
    catalog.appendChild(button);
  });
}

// 选中一把伞
async function selectUmbrella(id) {
  const item = data.umbrellas.find((u) => u.id === id);

  // 高亮目录里当前这一项
  document.querySelectorAll('#catalog button').forEach((b, i) => {
    b.classList.toggle('active', data.umbrellas[i].id === id);
  });

  // 先把它的贴图加载好
  const textures = await loadTextures(item.textures);

  // 组装参数，交给生成器造伞
  const params = {
    geometry: item.geometry,
    materials: {
      canopy: { ...item.materials.canopy, map: textures.pattern },
      rib: { ...item.materials.rib },
      handle: { ...item.materials.handle, map: textures.handle },
    },
  };

  if (umbrellaGroup) scene.remove(umbrellaGroup);
  umbrellaGroup = createUmbrella(params);
  scene.add(umbrellaGroup);

  renderCulture(item.culture);
}

// 加载一把伞用到的贴图（伞面纹样 + 木柄）
function loadTextures(textures) {
  const loader = new THREE.TextureLoader();
  const load = (url) =>
    new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject));

  return Promise.all([load(textures.pattern), load(textures.handle)]).then(
    ([pattern, handle]) => {
      // 颜色贴图按 sRGB 处理，颜色才准
      pattern.colorSpace = THREE.SRGBColorSpace;
      handle.colorSpace = THREE.SRGBColorSpace;
      return { pattern, handle };
    }
  );
}

// 下方文化解说
function renderCulture(culture) {
  const partsBox = document.getElementById('parts');
  partsBox.innerHTML = '';
  culture.parts.forEach((part) => {
    const box = document.createElement('div');
    box.className = 'part';

    const title = document.createElement('h3');
    title.textContent = part.name;
    const text = document.createElement('p');
    text.textContent = part.text;

    box.appendChild(title);
    box.appendChild(text);
    partsBox.appendChild(box);
  });

  document.getElementById('why').textContent = culture.why;
}

// —— 旋转：默认慢慢自转，按住左右拖动可以手动转 ——
let dragging = false;
let lastX = 0;
canvas.addEventListener('pointerdown', (e) => {
  dragging = true;
  spinning = false;
  lastX = e.clientX;
});
window.addEventListener('pointermove', (e) => {
  if (!dragging || !umbrellaGroup) return;
  umbrellaGroup.rotation.y += (e.clientX - lastX) * 0.01;
  lastX = e.clientX;
});
window.addEventListener('pointerup', () => {
  dragging = false;
  spinning = true;
});

// 动画循环：每一帧画一次
function animate() {
  requestAnimationFrame(animate);
  if (spinning && umbrellaGroup) umbrellaGroup.rotation.y += 0.004;
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
