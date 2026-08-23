// 伞的生成器 —— 本项目最核心的文件。
// 全项目只有这一个函数造伞：createUmbrella(params)。
// 所有伞的差异都靠参数表达，这里不许写任何“这把伞特殊”的分支。
//
// 按真实油纸伞的开合骨架建模，部件 7 样：
//   中棒、伞骨（长骨）、撑骨（短骨）、上巢、下巢、伞面、手柄。
//
// 开合原理：下巢沿中棒上移 → 撑骨（定长）把伞骨推开 → 伞面跟着张开。
// 撑骨、伞骨、中棒三者围成一个三角形，用余弦定理由“下巢位置”反推“伞骨张角”，
// 所以整个过程几何自洽：撑骨长度恒定、伞骨不穿伞面。
//
// 坐标系：Y 轴朝上，伞顶在上、手柄在下。

import * as THREE from 'three';

// 撑骨接在伞骨的中点（离上巢的比例）
const STRUT_ATTACH_RATIO = 0.5;

// —— 默认参数：每一把伞都可以用同名参数覆盖 ——
const DEFAULTS = {
  // 伞面
  radius: 1.0,            // 伞面张开后的半径（伞骨末端到中轴的水平距离）
  apexHeight: 0.55,       // 伞顶（上巢）的高度
  rimHeight: 0.0,         // 伞边（伞骨末端）的高度
  canopyRise: 0.12,       // 伞面弧垂：中间比“平直圆锥”高出多少
  ribCount: 24,           // 伞骨根数（也是伞面的段数）

  // 中棒与手柄
  shaftRadius: 0.03,      // 中棒半径
  handleBottom: -1.0,     // 中棒/手柄的最底端
  handleLength: 0.8,      // 手柄那一段的长度
  handleRadius: 0.055,    // 手柄半径（比中棒粗）

  // 伞骨与撑骨
  ribRadius: 0.013,       // 伞骨粗细
  strutRadius: 0.010,     // 撑骨粗细

  // 上巢 / 下巢
  hubRadius: 0.085,       // 巢（圆台）的半径
  hubHeight: 0.09,        // 巢（圆台）的高度
  lowerNestOpen: 0.30,    // 完全张开时，下巢的高度（合拢位置由连杆几何自动算出）

  // 开合程度：0 = 合拢，1 = 完全张开
  openAmount: 1.0,

  // 伞面材质（透光的核心；本步骤先不做贴图）
  transmission: 0.6,      // 透光率 0-1：越大越透，逆光时能透出光线
  roughness: 0.4,         // 伞面粗糙度：越小越光滑（油纸略带光泽）
  canopyColor: '#e2b86a', // 伞面颜色：桐油纸暖黄

  // 其余部件的纯色
  colors: {
    shaft: '#8a6a3c',     // 中棒：木色
    rib: '#a47c3e',       // 伞骨：竹色
    strut: '#a47c3e',     // 撑骨：竹色
    hub: '#6b5230',       // 上/下巢：深竹色
    handle: '#6b4a26',    // 手柄：深木色
  },

  // 贴图（Texture 对象，由外面加载好传进来；null 表示用纯色）
  textures: {
    rib: null,    // 伞骨：竹纹理
    handle: null, // 手柄：木纹理
  },
};

// 小工具：线性插值
function lerp(a, b, t) {
  return a + (b - a) * t;
}

// 小工具：在两点 a、b 之间放一根圆柱（用来做中棒、伞骨、撑骨、手柄、巢）
function cylinderBetween(a, b, radius, material, segments = 8) {
  const direction = new THREE.Vector3().subVectors(b, a);
  const length = direction.length();

  const geometry = new THREE.CylinderGeometry(radius, radius, length, segments);
  const mesh = new THREE.Mesh(geometry, material);

  mesh.position.copy(a).add(b).multiplyScalar(0.5);

  const up = new THREE.Vector3(0, 1, 0);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(up, direction.normalize());
  mesh.setRotationFromQuaternion(quaternion);
  mesh.castShadow = true; // 伞骨、中棒等不透明部件投出阴影

  return mesh;
}

// 材质：伞面用物理材质（支持透光），其余部件用标准材质。
function makeMaterials(p) {
  return {
    shaft: new THREE.MeshStandardMaterial({ color: p.colors.shaft }),
    rib: new THREE.MeshStandardMaterial({ color: p.colors.rib, map: p.textures.rib }),
    strut: new THREE.MeshStandardMaterial({ color: p.colors.strut }),
    hub: new THREE.MeshStandardMaterial({ color: p.colors.hub }),
    // 伞面：MeshPhysicalMaterial，transmission 让逆光能透过来。
    // DoubleSide 双面渲染，里外都能看到。
    canopy: new THREE.MeshPhysicalMaterial({
      color: p.canopyColor,
      roughness: p.roughness,
      transmission: p.transmission,
      thickness: 0.2, // 纸的厚度：给透射一点折射深度
      ior: 1.3,       // 折射率：油纸约 1.3（玻璃是 1.5）
      side: THREE.DoubleSide,
      // 不用 transparent：transparent 是“透明度/alpha”，
      // transmission 是“透光”，两者机制不同，不要混用。
    }),
    handle: new THREE.MeshStandardMaterial({ color: p.colors.handle, map: p.textures.handle }),
  };
}

// —— 连杆几何：一把伞的固定尺寸，只需算一次 ——
function linkageGeometry(p) {
  // 完全张开时，伞骨与竖直方向的夹角（由伞面形状决定）
  const alphaOpen = Math.atan2(p.radius, p.apexHeight - p.rimHeight);
  // 伞骨长度（上巢到伞骨末端的距离）
  const ribLength = Math.hypot(p.radius, p.apexHeight - p.rimHeight);
  // 撑骨接点离上巢的距离（接在伞骨中点）
  const attach = ribLength * STRUT_ATTACH_RATIO;

  // 撑骨长度：完全张开时，下巢到伞骨中点的距离（固定不变）
  const midX = attach * Math.sin(alphaOpen);
  const midY = p.apexHeight - attach * Math.cos(alphaOpen);
  const strutLength = Math.hypot(midX, midY - p.lowerNestOpen);

  // 完全合拢时（伞骨竖直朝下）下巢的高度
  const lowerNestClosed = p.apexHeight - attach - strutLength;

  return { alphaOpen, ribLength, attach, strutLength, lowerNestClosed };
}

// —— 由 openAmount 求出当前的下巢高度和伞骨张角 ——
function openState(p, geo, openAmount) {
  // 下巢高度：在合拢位与张开位之间线性移动
  const nestY = lerp(geo.lowerNestClosed, p.lowerNestOpen, openAmount);
  // 上巢到下巢的垂直距离
  const h = p.apexHeight - nestY;
  // 余弦定理：撑骨(strutLength)、伞骨上半段(attach)、中棒段(h) 围成三角形，
  // 已知三边，反求伞骨张角 alpha。
  const cosAlpha =
    (geo.attach * geo.attach + h * h - geo.strutLength * geo.strutLength) /
    (2 * geo.attach * h);
  const alpha = Math.acos(Math.min(1, Math.max(-1, cosAlpha)));
  return { nestY, alpha, openAmount };
}

// 第 i 根伞骨的方向（与竖直方向成 alpha 角）
function ribDirection(p, alpha, i) {
  const theta = (i / p.ribCount) * Math.PI * 2;
  const s = Math.sin(alpha);
  const c = Math.cos(alpha);
  return new THREE.Vector3(s * Math.cos(theta), -c, s * Math.sin(theta));
}

// 中棒：从伞顶贯穿到手柄的细圆柱（不随开合变化）
function buildShaft(p, material) {
  const top = new THREE.Vector3(0, p.apexHeight + p.hubHeight / 2, 0);
  const bottom = new THREE.Vector3(0, p.handleBottom, 0);
  return cylinderBetween(top, bottom, p.shaftRadius, material, 16);
}

// 伞骨：从伞顶向外下方张开，张角由 openAmount 决定
function buildRibs(p, geo, state, material) {
  const group = new THREE.Group();
  const apex = new THREE.Vector3(0, p.apexHeight, 0);
  for (let i = 0; i < p.ribCount; i++) {
    const end = apex.clone().addScaledVector(ribDirection(p, state.alpha, i), geo.ribLength);
    group.add(cylinderBetween(apex, end, p.ribRadius, material, 6));
  }
  return group;
}

// 撑骨：连接下巢与伞骨中点（定长，推动伞骨开合）
function buildStruts(p, geo, state, material) {
  const group = new THREE.Group();
  const apex = new THREE.Vector3(0, p.apexHeight, 0);
  const nest = new THREE.Vector3(0, state.nestY, 0);
  for (let i = 0; i < p.ribCount; i++) {
    const mid = apex.clone().addScaledVector(ribDirection(p, state.alpha, i), geo.attach);
    group.add(cylinderBetween(nest, mid, p.strutRadius, material, 6));
  }
  return group;
}

// 上巢：固定在中棒顶端的圆台（不随开合变化）
function buildUpperHub(p, material) {
  const top = new THREE.Vector3(0, p.apexHeight + p.hubHeight / 2, 0);
  const bottom = new THREE.Vector3(0, p.apexHeight - p.hubHeight / 2, 0);
  return cylinderBetween(bottom, top, p.hubRadius, material, 16);
}

// 下巢：可沿中棒滑动的圆台，位置由 openAmount 决定
function buildLowerHub(p, state, material) {
  const top = new THREE.Vector3(0, state.nestY + p.hubHeight / 2, 0);
  const bottom = new THREE.Vector3(0, state.nestY - p.hubHeight / 2, 0);
  return cylinderBetween(bottom, top, p.hubRadius, material, 16);
}

// 伞面：ribCount 段构成的穹顶，边缘落在伞骨末端，中间有弧垂。
// 随开合张开：伞骨张角变小则伞面收拢，弧垂也同步收为 0。
function buildCanopy(p, geo, state, material) {
  const radial = 8; // 径向细分（让弧垂曲线圆滑）
  const positions = [];
  const indices = [];

  for (let ri = 0; ri <= radial; ri++) {
    const t = ri / radial;
    // 这一圈的弧垂：随 openAmount 线性收放
    const bulge = p.canopyRise * 4 * t * (1 - t) * state.openAmount;
    // 这一圈的水平半径与高度（伞骨张角 alpha 决定）
    const rr = t * geo.ribLength * Math.sin(state.alpha);
    const y = p.apexHeight - t * geo.ribLength * Math.cos(state.alpha) + bulge;
    for (let si = 0; si <= p.ribCount; si++) {
      const theta = (si / p.ribCount) * Math.PI * 2;
      positions.push(rr * Math.cos(theta), y, rr * Math.sin(theta));
    }
  }

  const ringSize = p.ribCount + 1;
  for (let ri = 0; ri < radial; ri++) {
    for (let si = 0; si < p.ribCount; si++) {
      const a = ri * ringSize + si;
      const b = a + 1;
      const c = (ri + 1) * ringSize + si;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true; // 伞面接收阴影
  return mesh;
}

// 手柄：中棒底端，比中棒粗（不随开合变化）
function buildHandle(p, material) {
  const bottom = new THREE.Vector3(0, p.handleBottom, 0);
  const top = new THREE.Vector3(0, p.handleBottom + p.handleLength, 0);
  return cylinderBetween(bottom, top, p.handleRadius, material, 16);
}

// 对外唯一入口：造一把伞。
export function createUmbrella(params = {}) {
  const p = {
    ...DEFAULTS,
    ...params,
    colors: { ...DEFAULTS.colors, ...(params.colors || {}) },
    textures: { ...DEFAULTS.textures, ...(params.textures || {}) },
  };
  const group = new THREE.Group();
  const materials = makeMaterials(p);

  const geo = linkageGeometry(p);
  const state = openState(p, geo, p.openAmount);

  group.add(buildShaft(p, materials.shaft));
  group.add(buildRibs(p, geo, state, materials.rib));
  group.add(buildStruts(p, geo, state, materials.strut));
  group.add(buildUpperHub(p, materials.hub));
  group.add(buildLowerHub(p, state, materials.hub));
  group.add(buildCanopy(p, geo, state, materials.canopy));
  group.add(buildHandle(p, materials.handle));

  return group;
}
