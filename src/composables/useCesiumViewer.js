// src/composables/useCesiumViewer.js
import * as Cesium from 'cesium';
import TiandituTerrainProvider from '@/utils/TiandituTerrainProvider.js';

// 天地图 Token
const TDT_TOKEN = '49032972d154bbae1619d6f49347f2ae'; 

// Cesium Ion Access Token
Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI4ZWNkNWQzYy0xODk2LTQxYzUtOTBiZS0xZDA0NjAxMWIwN2QiLCJpZCI6MjgyMDk4LCJpYXQiOjE3NjY1OTM5NzZ9.40ehJzZ01ks9ndrAs-dEabGIm_tar4imTZu0T_apLgI'; 

// 🔥 严格限制天地图并发请求，防止 429 Too Many Requests
// 天地图免费版限流严格，必须降至最低并发
Cesium.RequestScheduler.maximumRequestsPerServer = 1;
Cesium.RequestScheduler.maximumRequests = 8;

// 🔥 拦截请求，对天地图 429 自动重试（指数退避）
const _origLoadWithXhr = Cesium.Resource._Implementations.loadWithXhr;
Cesium.Resource._Implementations.loadWithXhr = function (
    url, responseType, method, data, headers, deferred, overrideMimeType,
    preferImageBitmap, timeout
) {
    if (typeof url === 'string' && url.includes('tianditu.gov.cn')) {
        let attempt = 0;
        const maxRetries = 3;
        const tryLoad = () => {
            const retryDeferred = {
                resolve: (...args) => { deferred.resolve(...args); },
                reject: (error) => {
                    const code = error?.statusCode ?? error;
                    if (code === 429 && attempt < maxRetries) {
                        attempt++;
                        const delay = Math.pow(2, attempt) * 1000;
                        console.warn(`🔄 天地图 429 重试(${attempt}/${maxRetries}) ${delay}ms 后...`);
                        setTimeout(tryLoad, delay);
                    } else {
                        deferred.reject(error);
                    }
                }
            };
            _origLoadWithXhr(url, responseType, method, data, headers, retryDeferred, overrideMimeType, preferImageBitmap, timeout);
        };
        tryLoad();
        return;
    }
    _origLoadWithXhr(url, responseType, method, data, headers, deferred, overrideMimeType, preferImageBitmap, timeout);
};

export function useCesiumViewer() {
  const initViewer = (containerId) => {
    console.log("🚀 开始初始化 Cesium Viewer...");

    const container = document.getElementById(containerId);
    if (!container) {
      console.error("❌ 找不到容器元素:", containerId);
      return null;
    }

    // 1. 创建卫星底图 (使用 img_w 墨卡托投影，兼容性更好)
    console.log("📷 正在创建卫星底图 Provider...");
    const satellite = new Cesium.UrlTemplateImageryProvider({
      url: `https://t{s}.tianditu.gov.cn/DataServer?T=img_w&x={x}&y={y}&l={z}&tk=${TDT_TOKEN}`,
      subdomains: ['0', '1'], // 🔥 仅2个子域名，总并发 ≤ 2
      maximumLevel: 18,
      minimumLevel: 1,
    });

    // 2. 创建注记 (使用 cia_w 对应上面的底图)
    const annotation = new Cesium.UrlTemplateImageryProvider({
      url: `https://t{s}.tianditu.gov.cn/DataServer?T=cia_w&x={x}&y={y}&l={z}&tk=${TDT_TOKEN}`,
      subdomains: ['0', '1'], // 🔥 仅2个子域名
      maximumLevel: 18,  // 🔥 限制最大层级
      minimumLevel: 1,   // 🔥 限制最小层级
    });

    // 3. 初始化地球
    console.log("🌍 正在实例化 Viewer...");
    const viewer = new Cesium.Viewer(containerId, {
      // 🔥 新版 Cesium 可能废弃了 imageryProvider 参数，需要手动添加
      // 先创建一个空白底图的 Viewer
      baseLayerPicker: false, 
      geocoder: false, homeButton: false, sceneModePicker: false, 
      navigationHelpButton: false, animation: false, timeline: false, 
      fullscreenButton: false, infoBox: false, selectionIndicator: false,
    });

    // 🔥🔥🔥 关键修复：移除默认图层，手动添加卫星底图 🔥🔥🔥
    console.log("🗑️ 移除默认图层...");
    viewer.imageryLayers.removeAll();
    
    console.log("🖼️ 添加卫星底图到图层...");
    viewer.imageryLayers.addImageryProvider(satellite);
    
    // 4. 叠加注记 (文字层)
    console.log("🏷️ 添加注记图层...");
    viewer.imageryLayers.addImageryProvider(annotation);
    
    // 5. 隐藏版权信息
    viewer.cesiumWidget.creditContainer.style.display = "none";
    viewer.scene.globe.depthTestAgainstTerrain = true;
    
    // 6. 显示帧率 (FPS)
    viewer.scene.debugShowFramesPerSecond = true;

    // 7. 加载 Cesium Ion 全球三维地形
    console.log("⛰️ 正在加载三维地形...");
    Cesium.createWorldTerrainAsync({
      requestWaterMask: true,    // 水面效果
      requestVertexNormals: true // 光照效果
    }).then((terrain) => {
      viewer.terrainProvider = terrain;
      console.log("✅ Cesium 全球地形加载成功！");
    }).catch((error) => {
      console.warn("⚠️ 地形加载失败", error);
    });

    console.log("🎉 Cesium 初始化完成！");
    return viewer;
  };

  return { initViewer };
}