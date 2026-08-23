// 伞的生成器 —— 本项目最核心的文件。
// 全项目只有这一个函数“造伞”：所有伞都靠 createUmbrella(params) 生成，
// 伞与伞的差别只由 params（参数）决定，这里不许写任何“这把伞特殊”的分支。

import * as THREE from 'three';

// 小工具：在空间两点 a、b 之间放一根细圆柱（用来做伞骨、伞柄）。
function cylinderBetween(a, b, radius, material, segments = 8) {
  const direction = new THREE.Vector3().subVectors(b, a);
  const length = direction.length();

  const geometry = new THREE.CylinderGeometry(radius, radius, length, segments);
  const mesh = new THREE.Mesh(geometry, material);

  // 把圆柱的中点放到 a、b 的中点
  mesh.position.copy(a).add(b).multiplyScalar(0.5);

  // 让圆柱原本“朝上”的方向，转到 a→b 的方向
  const up = new THREE.Vector3(0, 1, 0);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(up, direction.normalize());
  mesh.setRotationFromQuaternion(quaternion);

  return mesh;
}

// 极坐标 UV：把伞面锥体上的每个顶点，重新安排它在贴图上的位置。
// 效果：贴图（一张正圆）的圆心正好落在伞顶，伞边对应圆的边缘，图案不会被扭曲。
function applyPolarUV(geometry, height) {
  const position = geometry.attributes.position;
  const uv = geometry.attributes.uv;

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);

    // 这个顶点绕中轴转了多少角度
    const theta = Math.atan2(z, x);
    // 离伞顶有多远：伞顶 = 0，伞边 = 1
    const s = (height - y) / height;
    // 换算成贴图里离圆心的距离：圆心 0 → 圆的边缘 0.5
    const r = s * 0.5;

    // 贴图坐标：圆心在 (0.5, 0.5)，向外按角度铺开
    uv.setXY(i, 0.5 + r * Math.cos(theta), 0.5 + r * Math.sin(theta));
  }
  uv.needsUpdate = true;
}

// 造伞面（锥面）。用 MeshPhysicalMaterial，因为它支持 transmission（透光）。
function buildCanopy(params, material) {
  const { canopyRadius, canopyHeight, ribCount } = params;
  // openEnded=true：只要锥面，不要底面
  const geometry = new THREE.ConeGeometry(canopyRadius, canopyHeight, ribCount, 1, true);
  applyPolarUV(geometry, canopyHeight);
  return new THREE.Mesh(geometry, material);
}

// 造伞骨：一圈细竹骨，从伞顶发散到伞边。
function buildRibs(params, material) {
  const group = new THREE.Group();
  const { canopyRadius, canopyHeight, ribCount, ribRadius } = params;

  const apex = new THREE.Vector3(0, canopyHeight, 0); // 伞顶
  for (let i = 0; i < ribCount; i++) {
    const theta = (i / ribCount) * Math.PI * 2;
    const rim = new THREE.Vector3(
      canopyRadius * Math.cos(theta),
      0,
      canopyRadius * Math.sin(theta)
    );
    group.add(cylinderBetween(apex, rim, ribRadius, material, 6));
  }
  return group;
}

// 造伞柄：一根木柄，从伞顶向下伸；顶上有一个小伞帽。
function buildHandle(params, material) {
  const group = new THREE.Group();
  const { canopyHeight, handleLength, handleRadius } = params;

  const apex = new THREE.Vector3(0, canopyHeight, 0);
  const bottom = new THREE.Vector3(0, -handleLength, 0);
  const capTop = new THREE.Vector3(0, canopyHeight + 0.09, 0);

  group.add(cylinderBetween(apex, bottom, handleRadius, material, 16));       // 主杆
  group.add(cylinderBetween(apex, capTop, handleRadius * 1.8, material, 16)); // 伞帽
  return group;
}

// 伞面材质：要透光。
function buildCanopyMaterial(cfg) {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(cfg.color),
    roughness: cfg.roughness,
    transmission: cfg.transmission, // 透光程度：0 完全不透，1 完全透明
    thickness: cfg.thickness,       // 纸的“厚度感”
    side: THREE.DoubleSide,         // 里外都能看到
    map: cfg.map || null,           // 伞面纹样贴图（在 app.js 里已加载好）
  });
}

// 伞骨、伞柄材质：普通材质即可。
function buildPlainMaterial(cfg) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(cfg.color),
    roughness: cfg.roughness ?? 0.7,
    map: cfg.map || null,
  });
}

// 对外唯一入口：造一把伞。
export function createUmbrella(params) {
  const group = new THREE.Group();

  const canopyMaterial = buildCanopyMaterial(params.materials.canopy);
  const ribMaterial = buildPlainMaterial(params.materials.rib);
  const handleMaterial = buildPlainMaterial(params.materials.handle);

  group.add(buildCanopy(params.geometry, canopyMaterial));
  group.add(buildRibs(params.geometry, ribMaterial));
  group.add(buildHandle(params.geometry, handleMaterial));

  return group;
}
