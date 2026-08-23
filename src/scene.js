// 场景：相机、灯光、地面。伞本体不在这里，在 umbrella.js 里。
// 本文件只管“舞台”——伞放进来之后看到的背景、光线、影子。

import * as THREE from 'three';

// 中性灰背景（调参台专用，干净、不抢伞的颜色）
const BACKGROUND = 0x909090;

// 对外唯一入口：搭好舞台，返回渲染器、场景、相机。
export function createStage(canvas) {
  // 渲染器（把 3D 画到 canvas 上）
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap; // 柔和阴影（边缘模糊）
  renderer.toneMapping = THREE.ACESFilmicToneMapping; // 颜色更自然
  renderer.toneMappingExposure = 1.1;

  // 场景
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BACKGROUND);

  // 相机：站在斜前方看伞
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 1.5, 4.2);
  camera.lookAt(0, -0.2, 0);

  scene.add(buildLights());
  scene.add(buildFloor());

  return { renderer, scene, camera };
}

// 灯光：一盏主光 + 一盏补光 + 一点点环境光
function buildLights() {
  const group = new THREE.Group();

  // 环境光：让背光面不至于全黑
  group.add(new THREE.AmbientLight(0xffffff, 0.45));

  // 主光：从斜上方打过来，投出柔和阴影
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(3, 4, 2);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.radius = 6;   // 阴影边缘柔化
  key.shadow.bias = -0.0002;
  const box = 4;           // 阴影覆盖的范围（比伞大一点）
  key.shadow.camera.left = -box;
  key.shadow.camera.right = box;
  key.shadow.camera.top = box;
  key.shadow.camera.bottom = -box;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 20;
  key.shadow.camera.updateProjectionMatrix();
  group.add(key);

  // 补光：从另一侧补一点，让暗部能看清
  const fill = new THREE.DirectionalLight(0xffffff, 0.5);
  fill.position.set(-2.5, 1, -1.5);
  group.add(fill);

  return group;
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
