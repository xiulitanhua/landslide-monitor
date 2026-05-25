import * as Cesium from 'cesium';
import { ref } from 'vue';

export function useTilesetControl() {
  
  // 用于记录当前的偏移量
  const currentHeightOffset = ref(0);
  const currentLonOffset = ref(0);  // 经度偏移（米）
  const currentLatOffset = ref(0);  // 纬度偏移（米）

  /**
   * 调整 3DTileset 的高度
   * @param {Cesium.Cesium3DTileset} tileset - 模型对象
   * @param {number} height - 要调整的高度值 (单位：米，正数向上，负数向下)
   */
  const updateTilesetHeight = (tileset, height) => {
    if (!tileset) {
      console.warn("⚠️ 模型尚未加载，无法调整高度");
      return;
    }

    currentHeightOffset.value = height;
    applyTilesetTransform(tileset);
  };

  /**
   * 调整 3DTileset 的水平位置
   * @param {Cesium.Cesium3DTileset} tileset - 模型对象
   * @param {number} lonOffset - 经度方向偏移 (单位：米，正数向东)
   * @param {number} latOffset - 纬度方向偏移 (单位：米，正数向北)
   */
  const updateTilesetPosition = (tileset, lonOffset, latOffset) => {
    if (!tileset) {
      console.warn("⚠️ 模型尚未加载，无法调整位置");
      return;
    }

    currentLonOffset.value = lonOffset;
    currentLatOffset.value = latOffset;
    applyTilesetTransform(tileset);
  };

  /**
   * 综合应用所有偏移量
   */
  const applyTilesetTransform = (tileset) => {
    if (!tileset) return;

    const cartographic = Cesium.Cartographic.fromCartesian(tileset.boundingSphere.center);
    
    // 计算经纬度偏移（米转弧度）
    // 1度纬度 ≈ 111000米, 1度经度 ≈ 111000 * cos(纬度) 米
    const lat = cartographic.latitude;
    const metersPerDegreeLat = 111000;
    const metersPerDegreeLon = 111000 * Math.cos(lat);
    
    const lonOffsetRad = (currentLonOffset.value / metersPerDegreeLon) * (Math.PI / 180);
    const latOffsetRad = (currentLatOffset.value / metersPerDegreeLat) * (Math.PI / 180);
    
    // 新位置
    const newLon = cartographic.longitude + lonOffsetRad;
    const newLat = cartographic.latitude + latOffsetRad;
    const newHeight = currentHeightOffset.value;
    
    // 计算原点到新位置的平移向量
    const surface = Cesium.Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude, 0.0);
    const target = Cesium.Cartesian3.fromRadians(newLon, newLat, newHeight);
    const translation = Cesium.Cartesian3.subtract(target, surface, new Cesium.Cartesian3());
    
    // 应用平移矩阵
    tileset.modelMatrix = Cesium.Matrix4.fromTranslation(translation);
    
    console.log(`🚀 模型位置已调整: 东移${currentLonOffset.value}米, 北移${currentLatOffset.value}米, 高度${currentHeightOffset.value}米`);
  };

  return {
    currentHeightOffset,
    currentLonOffset,
    currentLatOffset,
    updateTilesetHeight,
    updateTilesetPosition,
    applyTilesetTransform
  };
}
