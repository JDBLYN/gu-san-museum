// 场景：相机、灯光、地面。伞本体不在这里，在 umbrella.js 里。

import * as THREE from 'three';

export function createStage(canvas) {
  // 渲染器（把 3D 画到 canvas 上）
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;                    // 开阴影
  renderer.toneMapping = THREE.ACESFilmicToneMapping;   // 颜色更自然
  renderer.toneMappingExposure = 1.1;

  // 场景：安静的深色背景，让暖黄的伞成为主角
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x171a21);

  // 相机：站在斜前方看伞
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 1.5, 4.2);
  camera.lookAt(0, -0.2, 0);

  scene.add(buildLights());
  scene.add(buildFloor());

  return { renderer, scene, camera };
}

function buildLights() {
  const group = new THREE.Group();

  // 环境光：让背光面不至于全黑
  group.add(new THREE.AmbientLight(0x8a93a5, 0.45));

  // 逆光（本项目的视觉核心）：从伞后方偏上照过来，
  // 让伞面透亮、伞骨在伞面上显出剪影。
  const back = new THREE.DirectionalLight(0xffe2b0, 2.4);
  back.position.set(-2.2, 2.6, -3.2);
  back.castShadow = true;
  back.shadow.mapSize.set(1024, 1024);
  group.add(back);

  // 前侧补光：让正对镜头这一面看得清
  const fill = new THREE.DirectionalLight(0xc4d2e6, 0.7);
  fill.position.set(2, 1, 3);
  group.add(fill);

  return group;
}

function buildFloor() {
  const geometry = new THREE.CircleGeometry(2.4, 64);
  const material = new THREE.MeshStandardMaterial({ color: 0x232833, roughness: 0.9 });
  const floor = new THREE.Mesh(geometry, material);
  floor.rotation.x = -Math.PI / 2; // 放平
  floor.position.y = -1.8;          // 在伞下方当“展台”
  floor.receiveShadow = true;
  return floor;
}
