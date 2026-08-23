// 场景：相机、灯光、背景。伞本体在 umbrella.js 里。
// 本文件只管“舞台”——伞放进来之后看到的背景、光线。
//
// 本项目的视觉核心：
//   主光放在伞的斜后上方做逆光，相机在斜前下方抬头看伞，
//   光线从伞面背后透过来，伞骨在伞面上投出清晰剪影。

import * as THREE from 'three';

// 主光的固定参数
const KEY_DISTANCE = 4;        // 主光离伞中心的距离（固定，只改角度）
const KEY_ANGLE_DEFAULT = 30;  // 默认仰角（度）：斜后上方
const KEY_COLOR = 0xffe3b3;    // 主光颜色：暖黄（桐油纸的暖调）

// 把主光放到“斜后上方”。
// angleDeg 是仰角：0 = 水平后方，90 = 正头顶。
// 主光始终在伞的后方（相机的对面）。
export function placeKeyLight(light, angleDeg) {
  const a = (angleDeg * Math.PI) / 180;
  light.position.set(
    0,
    KEY_DISTANCE * Math.sin(a),  // 越高越往上
    -KEY_DISTANCE * Math.cos(a)  // 负 z = 在伞后方
  );
}

// 对外唯一入口：搭好舞台，返回渲染器、场景、相机、主光。
export function createStage(canvas) {
  // 渲染器：透明背景，让 CSS 里压暗虚化的 hall-bg 从后面透出来
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0); // 全透明，不遮背景
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap; // 柔和阴影
  renderer.toneMapping = THREE.ACESFilmicToneMapping; // 颜色更自然
  renderer.toneMappingExposure = 1.2;

  // 场景（不设 background，保持透明）
  const scene = new THREE.Scene();

  // 相机：站在伞的斜前下方，抬头看伞
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, -0.4, 3.6);
  camera.lookAt(0, 0.1, 0);

  // 主光：逆光，是本项目“透光剪影”的关键
  const keyLight = buildKeyLight();
  scene.add(keyLight);
  scene.add(keyLight.target); // 主光的目标（伞中心）也要加入场景，影子才对

  // 环境光：很弱，只让暗部不至于全黑（这样伞骨才能显成深色剪影）
  scene.add(new THREE.AmbientLight(0xffffff, 0.3));

  scene.add(buildBackdrop()); // 逆光光晕：让透光有“亮”可透

  return { renderer, scene, camera, keyLight };
}

// 主光：一盏逆光，从伞的斜后上方打过来
function buildKeyLight() {
  const light = new THREE.DirectionalLight(KEY_COLOR, 2.5);
  light.castShadow = true;
  light.shadow.mapSize.set(1024, 1024);
  light.shadow.radius = 6;   // 阴影边缘柔化
  light.shadow.bias = -0.0002;
  const box = 4;             // 阴影覆盖的范围
  light.shadow.camera.left = -box;
  light.shadow.camera.right = box;
  light.shadow.camera.top = box;
  light.shadow.camera.bottom = -box;
  light.shadow.camera.near = 0.5;
  light.shadow.camera.far = 20;
  light.shadow.camera.updateProjectionMatrix();

  light.target.position.set(0, 0.1, 0); // 照向伞中心
  placeKeyLight(light, KEY_ANGLE_DEFAULT);
  return light;
}

// 逆光光晕：一张“中心暖亮、边缘透明”的圆斑，放在伞后方。
// 这是“透光剪影”的关键：伞面的 transmission 要透出“亮”的东西才看得见——
// 暗背景透不出光，剪影就出不来。有了这团暖光，伞面才能透出暖光、
// 伞骨才能显出深色剪影。
function buildBackdrop() {
  const geometry = new THREE.PlaneGeometry(4, 4);
  const material = new THREE.MeshBasicMaterial({
    map: makeGlowTexture(),
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const panel = new THREE.Mesh(geometry, material);
  panel.position.set(0, 0.3, -2.5); // 伞后方，正对相机
  return panel;
}

// 生成“中心亮、边缘透明”的暖色圆斑贴图（用代码画的光照效果，不是内容图）
function makeGlowTexture() {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255, 242, 214, 1)');
  g.addColorStop(0.5, 'rgba(255, 236, 200, 0.55)');
  g.addColorStop(1, 'rgba(255, 230, 190, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
