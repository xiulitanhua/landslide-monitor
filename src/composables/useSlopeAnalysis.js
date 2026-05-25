/**
 * 🔥 高程分析 - 基于 Cesium CustomShader
 * 
 * 按点云海拔高度分为三级：低、中、高
 */

import * as Cesium from 'cesium';
import { ref, computed } from 'vue';

export function useSlopeAnalysis() {
  const isEnabled = ref(false);
  const currentHeightRange = ref({ min: 1000, max: 2300 }); // 固定海拔范围
  let slopeShader = null;

  // 🛠️ 三级高程 Shader
  const createSlopeShader = (tilesetCenterRadius, minHeight, maxHeight) => {
    console.log("🎨 创建高程Shader, 参数:", tilesetCenterRadius, minHeight, maxHeight);
    
    return new Cesium.CustomShader({
      uniforms: {
        u_centerRadius: {
          type: Cesium.UniformType.FLOAT,
          value: tilesetCenterRadius
        },
        u_minHeight: { type: Cesium.UniformType.FLOAT, value: minHeight },
        u_maxHeight: { type: Cesium.UniformType.FLOAT, value: maxHeight }
      },
      lightingModel: Cesium.LightingModel.UNLIT,
      fragmentShaderText: `
        void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
          // 获取世界坐标
          vec4 positionWC_vec4 = czm_inverseView * vec4(fsInput.attributes.positionEC, 1.0);
          float currentRadius = length(positionWC_vec4.xyz);
          
          // 计算相对高度
          float relHeight = currentRadius - u_centerRadius;
          
          // 归一化高度 (0.0 ~ 1.0)
          float range = u_maxHeight - u_minHeight;
          float t = (relHeight - u_minHeight) / range;
          t = clamp(t, 0.0, 1.0);
          
          // 🎨 三级高程分类
          // 低海拔 (0-33%): 绿色
          // 中海拔 (33-66%): 黄色
          // 高海拔 (66-100%): 红色
          
          vec3 finalColor;
          
          if (t < 0.33) {
            // 低海拔 - 绿色
            finalColor = vec3(0.2, 0.7, 0.3);  // #33b34d
          } else if (t < 0.66) {
            // 中海拔 - 黄色
            finalColor = vec3(1.0, 0.85, 0.2); // #ffd933
          } else {
            // 高海拔 - 红色
            finalColor = vec3(0.9, 0.2, 0.15); // #e63326
          }
          
          // 混合原始颜色，保留部分纹理细节
          vec3 baseColor = material.diffuse;
          material.diffuse = mix(baseColor, finalColor, 0.8);
        }
      `
    });
  };

  /**
   * 切换坡度/高度分析
   */
  const toggleSlopeAnalysis = (enable, tileset) => {
    if (!tileset) {
      console.warn("⚠️ 模型未加载，无法分析");
      return false;
    }
    
    isEnabled.value = enable;
    
    if (enable) {
      // 🔥 关键步骤：获取模型中心的精确地心半径
      const center = tileset.boundingSphere.center;
      const boundingRadius = tileset.boundingSphere.radius;
      const centerMagnitude = Cesium.Cartesian3.magnitude(center);
      
      // 转换为经纬度查看位置
      const cartographic = Cesium.Cartographic.fromCartesian(center);
      const lon = Cesium.Math.toDegrees(cartographic.longitude);
      const lat = Cesium.Math.toDegrees(cartographic.latitude);
      const height = cartographic.height;
      
      console.log("📍 模型中心经纬度:", lon.toFixed(5), lat.toFixed(5));
      console.log("📍 模型中心海拔 (Cartographic):", height.toFixed(2), "米");
      console.log("📐 模型中心地心距离:", centerMagnitude.toFixed(2), "米");
      console.log("📐 模型包围球半径:", boundingRadius.toFixed(2), "米");
      
      // 🔥 使用固定的海拔范围：1000m ~ 2300m
      const minAltitude = 1000;  // 最低海拔
      const maxAltitude = 2300;  // 最高海拔
      
      // 相对于模型中心点的高度
      const minH = minAltitude - height;
      const maxH = maxAltitude - height;
      
      console.log("📊 固定海拔范围:", minAltitude, "~", maxAltitude, "米");
      console.log("📊 相对高度范围:", minH.toFixed(2), "~", maxH.toFixed(2), "米");
      
      // 保存海拔范围用于图例显示
      currentHeightRange.value = { min: minAltitude, max: maxAltitude };
      
      // 每次都重新创建 shader，确保参数正确
      slopeShader = createSlopeShader(centerMagnitude, minH, maxH);
      
      tileset.customShader = slopeShader;
      console.log("🔥 坡度/高度分析已开启");
    } else {
      tileset.customShader = undefined;
      console.log("🧊 坡度/高度分析已关闭");
    }
    return true;
  };

  /**
   * 获取图例信息（三级高程，基于实际海拔）
   */
  const slopeLegend = computed(() => {
    const min = currentHeightRange.value.min;
    const max = currentHeightRange.value.max;
    const range = max - min;
    const low = min;
    const mid1 = Math.round(min + range / 3);
    const mid2 = Math.round(min + range * 2 / 3);
    const high = Math.round(max);
    
    return [
      { label: `高海拔 (${mid2}~${high}m)`, color: '#e63326' },
      { label: `中海拔 (${mid1}~${mid2}m)`, color: '#ffd933' },
      { label: `低海拔 (${Math.round(low)}~${mid1}m)`, color: '#33b34d' }
    ];
  });

  return {
    isEnabled,
    currentHeightRange,
    toggleSlopeAnalysis,
    slopeLegend
  };
}
