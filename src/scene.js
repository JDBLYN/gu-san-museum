// 场景：相机、灯光、地面。伞本体在 umbrella.js 里。
// 本文件只管“舞台”——伞放进来之后看到的背景、光线、影子。
//
// 本项目的视觉核心：
//   主光放在伞的斜后上方做逆光，相机在斜前下方抬头看伞，
//   光线从伞面背后透过来，伞骨在伞面上投出清晰剪影。

import * as THREE from 'three';

// 中性灰背景（干净、不抢伞的颜色）
const BACKGROUND = 0x909090;

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
  // 渲染器（把 3D 画到 canvas 上）
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap; // 柔和阴影
  renderer.toneMapping = THREE.ACESFilmicToneMapping; // 颜色更自然
  renderer.toneMappingExposure = 1.1;

  // 场景
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BACKGROUND);

  // 相机：站在伞的斜前下方，抬头看伞
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, -0.4, 3.6);
  camera.lookAt(0, 0.1, 0);

  // 主光：逆光，是本项目“透光剪影”的关键
  const keyLight = buildKeyLight();
  scene.add(keyLight);
  scene.add(keyLight.target); // 主光的目标（伞中心）也要加入场景，影子才对

  // 环境光：很弱，只让暗部不至于全黑（这样伞骨才能显成深色剪影）
  scene.add(new THREE.AmbientLight(0xffffff, 0.2));

  scene.add(buildBackdrop()); // 逆光板：让透光有“亮”可透
  scene.add(buildFloor());

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

// 逆光板：一块自己发光的暖色板，放在伞后方。
// 这是“透光剪影”的关键：transmission 要透出“亮”的东西才看得见——
// 纯灰背景是暗的，透不出光，剪影就出不来。
// 有了这块亮板，伞面才能透出暖光、显出伞骨的深色剪影。
function buildBackdrop() {
  const geometry = new THREE.PlaneGeometry(4.5, 4.5);
  const material = new THREE.MeshBasicMaterial({ color: 0xfff0d8, side: THREE.DoubleSide });
  const panel = new THREE.Mesh(geometry, material);
  panel.position.set(0, 0.3, -2.5); // 伞后方，正对相机
  return panel;
}

// 地面：一块承接阴影的灰色平面
function buildFloor() {
  const geometry = new THREE.PlaneGeometry(10, 10);
  const material = new THREE.MeshStandardMaterial({ color: 0xb0b0b0, roughness: 0.95 });
  const floor = new THREE.Mesh(geometry, material);
  floor.rotation.x = -Math.PI / 2; // 放平
  floor.position.y = -1.8;          // 在伞下方当“展台”
  floor.receiveShadow = true;        // 接住阴影
  return floor;
}
