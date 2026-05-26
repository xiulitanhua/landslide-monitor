/**
 * 几何计算工具 —— 多边形面积、中心点等
 */
import * as Cesium from 'cesium';

/**
 * 在局部 ENU 平面上使用鞋带公式计算多边形面积和几何中心
 * 适合小范围（如滑坡监测区域）的精确计算
 *
 * @param {Cesium.Cartesian3[]} positions - 多边形顶点（笛卡尔坐标）
 * @returns {{ area: number, center: Cesium.Cartesian3 }} 面积（平方米）和几何中心
 */
export function computeAreaAndCenter(positions) {
  if (positions.length < 3) {
    return { area: 0, center: positions[0] || Cesium.Cartesian3.ZERO };
  }

  const origin = positions[0];
  const enuMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(origin);
  const enuInverse = Cesium.Matrix4.inverse(enuMatrix, new Cesium.Matrix4());

  const localPts = positions.map((p) => {
    const lp = Cesium.Matrix4.multiplyByPoint(enuInverse, p, new Cesium.Cartesian3());
    return { x: lp.x, y: lp.y };
  });

  let area = 0;
  let cx = 0;
  let cy = 0;
  const n = localPts.length;
  for (let i = 0; i < n; i++) {
    const { x: x1, y: y1 } = localPts[i];
    const { x: x2, y: y2 } = localPts[(i + 1) % n];
    const cross = x1 * y2 - x2 * y1;
    area += cross;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
  }

  area = Math.abs(area) / 2;
  const factor = area !== 0 ? 1 / (6 * area) : 0;
  const centroidLocal = new Cesium.Cartesian3(cx * factor, cy * factor, 0);
  const centroidWorld = Cesium.Matrix4.multiplyByPoint(enuMatrix, centroidLocal, new Cesium.Cartesian3());

  return { area, center: centroidWorld };
}
