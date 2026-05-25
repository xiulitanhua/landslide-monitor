import * as Cesium from 'cesium';
import { ref, onUnmounted } from 'vue';

export function useMousePosition() {
  // 定义响应式数据
  const mouseInfo = ref({
    longitude: 0,
    latitude: 0,
    height: 0,
    cameraHeight: 0, // 视点高度（相机距离地面的高度）
    hasData: false   // 当前鼠标是否在地球上
  });

  let handler = null;

  /**
   * 初始化监听器
   * @param {Cesium.Viewer} viewer 
   */
  const initMouseHandler = (viewer) => {
    if (!viewer) return;

    handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    handler.setInputAction((movement) => {
      // 1. 获取屏幕坐标对应的地球三维坐标 (包含地形和模型)
      // pickPosition 是最准确的，因为它能拾取 3DTiles 模型的高度
      const cartesian = viewer.scene.pickPosition(movement.endPosition);

      if (cartesian) {
        // 2. 将笛卡尔坐标(X,Y,Z)转为制图坐标(经,纬,高)
        const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
        
        // 3. 转换弧度为度数
        const longitude = Cesium.Math.toDegrees(cartographic.longitude);
        const latitude = Cesium.Math.toDegrees(cartographic.latitude);
        const height = cartographic.height;

        // 4. 获取相机高度 (可选，很多GIS应用都需要)
        const cameraHeight = viewer.camera.positionCartographic.height;

        // 5. 更新数据 (保留一定小数位)
        mouseInfo.value = {
          longitude: longitude.toFixed(6), // 经度保留6位
          latitude: latitude.toFixed(6),   // 纬度保留6位
          height: height.toFixed(2),       // 高度保留2位
          cameraHeight: cameraHeight.toFixed(0),
          hasData: true
        };
      } else {
        // 鼠标指向天空/宇宙时
        mouseInfo.value.hasData = false;
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
  };

  // 组件销毁时自动清理事件，防止内存泄漏
  onUnmounted(() => {
    if (handler) {
      handler.destroy();
      handler = null;
    }
  });

  return {
    mouseInfo,
    initMouseHandler
  };
}
