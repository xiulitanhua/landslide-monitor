/**
 * 应用主控制器 —— 从 App.vue 提取的业务逻辑
 * 管理面板状态、工具初始化、事件处理等
 */
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import * as Cesium from 'cesium';
import { useCesiumViewer } from './useCesiumViewer';
import { useAnalysisTools } from './useAnalysisTools';
import { useMousePosition } from './useMousePosition';
import { useSlopeAnalysis } from './useSlopeAnalysis';
import { useMeasureTools } from './useMeasureTools';
import { useMarkerTools } from './useMarkerTools';
import { useSensorMonitor } from './useSensorMonitor';
import { useDraggable } from './useDraggable';
import { useWeatherTools } from './useWeatherTools';

export function useAppController() {
  // ===== 控制面板 =====
  const controlPanelRef = ref(null);
  const controlCollapsed = ref(false);
  let controlPanelDraggable = null;

  // ===== 通用状态 =====
  const statusText = ref('初始化中...');
  const profileData = ref([]);
  const slopeEnabled = ref(false);
  const realSlopeEnabled = ref(false);
  const edlEnabled = ref(true);
  const isMeasuring = ref(false);
  const viewerRef = ref(null);
  const currentTileset = ref(null);

  // ===== 工具实例 =====
  let tools = null;
  let measureTools = null;
  const measureMode = ref('');

  // ===== 标注相关 =====
  const showMarkerPanel = ref(false);
  let markerTools = null;
  const markers = ref([]);
  const markerMode = ref('');

  // ===== 裂缝图层 =====
  const crackTileset = ref(null);
  const crackVisible = ref(false);

  // ===== 传感器 =====
  const showSensorPanel = ref(false);
  let sensorMonitor = null;
  const sensors = ref([]);
  const selectedSensor = ref(null);
  const isMonitoring = ref(false);

  // ===== 天气 =====
  const { isRaining, rainIntensity, toggleRain, updateRainIntensity } = useWeatherTools(viewerRef);

  // ===== 初始化 Viewer / 鼠标 / 分析工具 =====
  const { initViewer } = useCesiumViewer();
  const { mouseInfo, initMouseHandler } = useMousePosition();
  const { toggleSlopeAnalysis, slopeLegend } = useSlopeAnalysis();

  // ===== 射线法判定点是否在多边形内 =====
  const isPointInPolygon = (lon, lat, vertices) => {
    let inside = false;
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
      const xi = vertices[i].lon, yi = vertices[i].lat;
      const xj = vertices[j].lon, yj = vertices[j].lat;
      const intersect =
        ((yi > lat) !== (yj > lat)) &&
        (lon < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-12) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  };

  // ===== 多区域预警统计 =====
  const zoneStats = computed(() => {
    const allMarkers = markers.value || [];
    const allSensors = sensors.value || [];
    const zones = allMarkers.filter(m => m.type === 'dangerZone');

    return zones.map(z => {
      const vertices = z.verticesLonLat || [];
      let total = 0, normal = 0, warning = 0, danger = 0;

      if (vertices.length >= 3) {
        allSensors.forEach(s => {
          if (!s.position) return;
          const { lon, lat } = s.position;
          if (isPointInPolygon(lon, lat, vertices)) {
            total++;
            if (s.status === 'danger') danger++;
            else if (s.status === 'warning') warning++;
            else normal++;
          }
        });
      }

      let status = 'normal';
      if (danger > 0) status = 'danger';
      else if (warning > 0) status = 'warning';

      const derivedLevel = danger > 0 ? '1' : warning > 0 ? '2' : '3';

      return { id: z.id, name: z.name, level: derivedLevel, status, totalSensors: total, normal, warning, danger };
    });
  });

  // ===== 区域颜色随传感器状态联动 =====
  watch(zoneStats, (zones) => {
    const allMarkers = markers.value || [];
    zones.forEach((z) => {
      const marker = allMarkers.find((m) => m.id === z.id && m.type === 'dangerZone');
      if (!marker || !marker.entity || !marker.entity.polygon) return;

      const levelColor = z.level === '1'
        ? Cesium.Color.RED
        : z.level === '2'
          ? Cesium.Color.ORANGE
          : Cesium.Color.fromCssColorString('#22c55e');

      marker.entity.polygon.material = levelColor.withAlpha(0.4);
      marker.entity.polygon.outlineColor = levelColor;
      marker.level = z.level;

      if (marker.labelEntity && marker.labelEntity.label) {
        const areaText = marker.area ? `${(marker.area / 1_000_000).toFixed(2)} km²` : '';
        marker.labelEntity.label.text = `⚠️ ${marker.name} (L${z.level})\n${areaText}`;
        marker.labelEntity.label.fillColor = levelColor;
      }
    });
  }, { deep: true, immediate: true });

  // ===== 生命周期 =====
  onMounted(async () => {
    controlPanelDraggable = useDraggable(controlPanelRef, '.drag-handle');
    controlPanelDraggable.initDraggable();

    viewerRef.value = initViewer('cesiumContainer');

    if (viewerRef.value) {
      initMouseHandler(viewerRef.value);
      viewerRef.value.scene.globe.depthTestAgainstTerrain = false;
    }

    tools = useAnalysisTools(viewerRef.value);
    measureTools = useMeasureTools(viewerRef.value);

    const markerToolsInstance = useMarkerTools(viewerRef.value);
    markerTools = markerToolsInstance;
    markers.value = markerToolsInstance.markers;

    try {
      statusText.value = '加载点云模型...';
      const isProd = import.meta.env.PROD;
      const BASE = isProd
        ? 'https://3dtileslandslide-1334746675.cos.ap-chengdu.myqcloud.com'
        : import.meta.env.BASE_URL;
      const tileset = await Cesium.Cesium3DTileset.fromUrl(`${BASE}/2026%202%207%2017%2012/tileset.json`, {
        maximumScreenSpaceError: 16,
      });
      viewerRef.value.scene.primitives.add(tileset);
      await tileset.readyPromise;

      if (tileset.pointCloudShading) {
        tileset.pointCloudShading.eyeDomeLighting = edlEnabled.value;
        tileset.pointCloudShading.eyeDomeLightingStrength = 1.0;
        tileset.pointCloudShading.eyeDomeLightingRadius = 1.0;
      }

      currentTileset.value = tileset;
      viewerRef.value.zoomTo(tileset, new Cesium.HeadingPitchRange(0, -0.5, 0));

      // 加载裂缝点云图层
      try {
        const crack = await Cesium.Cesium3DTileset.fromUrl(`${BASE}/liefeng3/tileset.json`, {
          maximumScreenSpaceError: 1,
        });
        viewerRef.value.scene.primitives.add(crack);
        await crack.readyPromise;

        if (crack.pointCloudShading) {
          crack.pointCloudShading.eyeDomeLighting = edlEnabled.value;
          crack.pointCloudShading.eyeDomeLightingStrength = 1.2;
          crack.pointCloudShading.eyeDomeLightingRadius = 1.0;
        }

        const heightOffset = 15;
        const cartographic = Cesium.Cartographic.fromCartesian(crack.boundingSphere.center);
        const surface = Cesium.Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude, 0.0);
        const offset = Cesium.Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude, heightOffset);
        const translation = Cesium.Cartesian3.subtract(offset, surface, new Cesium.Cartesian3());
        crack.modelMatrix = Cesium.Matrix4.fromTranslation(translation);

        crack.style = new Cesium.Cesium3DTileStyle({
          color: "color('#6B238E', 1.0)",
          pointSize: 2
        });

        crackTileset.value = crack;
        crack.show = false;
      } catch (crackError) {
        console.warn('裂缝图层加载失败:', crackError);
      }

      statusText.value = '系统就绪';
    } catch (e) {
      statusText.value = '模型加载失败，请检查 public 目录';
    }
  });

  onUnmounted(() => {
    if (controlPanelDraggable) {
      controlPanelDraggable.destroyDraggable();
    }
  });

  // ===== 图层切换 =====
  const toggleCrack = () => {
    if (!crackTileset.value) {
      statusText.value = '裂缝图层尚未加载';
      return;
    }
    crackVisible.value = !crackVisible.value;
    crackTileset.value.show = crackVisible.value;
    statusText.value = crackVisible.value ? '裂缝图层已显示' : '裂缝图层已隐藏';
  };

  const toggleEDL = () => {
    edlEnabled.value = !edlEnabled.value;
    if (currentTileset.value && currentTileset.value.pointCloudShading) {
      currentTileset.value.pointCloudShading.eyeDomeLighting = edlEnabled.value;
    }
    if (crackTileset.value && crackTileset.value.pointCloudShading) {
      crackTileset.value.pointCloudShading.eyeDomeLighting = edlEnabled.value;
    }
    statusText.value = edlEnabled.value
      ? 'Eye-Dome Lighting 已开启，点云立体感增强'
      : 'Eye-Dome Lighting 已关闭';
  };

  // ===== 分析工具 =====
  const handleSlope = () => {
    if (!currentTileset.value) {
      statusText.value = '模型尚未加载';
      return;
    }
    if (realSlopeEnabled.value) {
      realSlopeEnabled.value = false;
      currentTileset.value.style = undefined;
    }
    slopeEnabled.value = !slopeEnabled.value;
    const success = toggleSlopeAnalysis(slopeEnabled.value, currentTileset.value);
    if (success) {
      statusText.value = slopeEnabled.value ? '高程分析已开启 (GPU渲染)' : '高程分析已关闭';
    }
  };

  const handleRealSlope = () => {
    if (!currentTileset.value) {
      statusText.value = '模型尚未加载';
      return;
    }
    if (slopeEnabled.value) {
      toggleSlopeAnalysis(false, currentTileset.value);
      slopeEnabled.value = false;
    }
    realSlopeEnabled.value = !realSlopeEnabled.value;
    tools.toggleSlopeAnalysis(currentTileset.value, realSlopeEnabled.value);
    statusText.value = realSlopeEnabled.value ? '坡度分析已开启 (基于法线)' : '坡度分析已关闭';
  };

  const handleProfile = () => {
    isMeasuring.value = true;
    tools.measureProfile((data) => {
      profileData.value = data;
      isMeasuring.value = false;
    }, (msg) => {
      statusText.value = msg;
    });
  };

  const handleChartHighlight = (index) => {
    if (tools && tools.highlightPointOnMap) {
      tools.highlightPointOnMap(index);
    }
  };

  const handleCloseChart = () => {
    profileData.value = [];
    if (tools && tools.highlightPointOnMap) {
      tools.highlightPointOnMap(-1);
    }
  };

  // ===== 测量工具 =====
  const handleMeasureDistance = () => {
    if (measureTools) {
      measureMode.value = 'distance';
      measureTools.measureDistance((msg) => {
        statusText.value = msg;
        if (msg.startsWith('✅')) measureMode.value = '';
      });
    }
  };

  const handleMeasureArea = () => {
    if (measureTools) {
      measureMode.value = 'area';
      measureTools.measureArea((msg) => {
        statusText.value = msg;
        if (msg.startsWith('✅')) measureMode.value = '';
      });
    }
  };

  const handleMeasureHeight = () => {
    if (measureTools) {
      measureMode.value = 'height';
      measureTools.measureHeight((msg) => {
        statusText.value = msg;
        if (msg.startsWith('✅')) measureMode.value = '';
      });
    }
  };

  const handleClear = () => {
    tools.clearAnalysis(currentTileset.value);
    profileData.value = [];
    if (measureTools) {
      measureTools.clearMeasure();
      measureMode.value = '';
    }
    if (slopeEnabled.value) {
      toggleSlopeAnalysis(false, currentTileset.value);
    }
    slopeEnabled.value = false;
    realSlopeEnabled.value = false;
    isMeasuring.value = false;
    statusText.value = '已清除';
  };

  // ===== 标注工具 =====
  const handleAddMarker = (type) => {
    if (markerTools) {
      markerMode.value = type;
      markerTools.addMarker(type, (msg) => {
        statusText.value = msg;
        if (msg.startsWith('✅') || msg === '已取消标注') {
          markerMode.value = '';
        }
      });
    }
  };

  const handleAddDangerZone = () => {
    if (markerTools) {
      markerMode.value = 'dangerZone';
      markerTools.addDangerZone((msg) => {
        statusText.value = msg;
        if (msg.startsWith('✅') || msg === '已取消标注') {
          markerMode.value = '';
        }
      });
    }
  };

  const handleRemoveMarker = (id) => {
    if (markerTools) {
      markerTools.removeMarker(id);
      statusText.value = '已删除标注';
    }
  };

  const handleFlyToMarker = (id) => {
    if (markerTools) markerTools.flyToMarker(id);
  };

  const handleClearAllMarkers = () => {
    if (markerTools) {
      markerTools.clearAllMarkers();
      statusText.value = '已清除所有标注';
    }
  };

  const handleExportMarkers = () => {
    if (markerTools) {
      markerTools.exportMarkers();
      statusText.value = '标注已导出';
    }
  };

  // ===== 传感器 =====
  const handleOpenSensor = () => {
    showSensorPanel.value = !showSensorPanel.value;
    if (showSensorPanel.value && !sensorMonitor) {
      sensorMonitor = useSensorMonitor(viewerRef.value);
      sensorMonitor.initSensors();
      sensors.value = sensorMonitor.sensors;
      sensorMonitor.onAlert((sensor, status) => {
        const emoji = status === 'danger' ? '🚨' : '⚠️';
        statusText.value = `${emoji} ${sensor.name} ${status === 'danger' ? '危险告警' : '预警'}！当前值: ${sensor.value}${sensor.config.unit}`;
      });
      statusText.value = '传感器监测系统已加载';
    }
  };

  const handleCloseSensor = () => {
    showSensorPanel.value = false;
  };

  const handleSelectSensor = (sensor) => {
    selectedSensor.value = sensor;
    if (sensorMonitor) sensorMonitor.selectSensor(sensor.id);
  };

  const handleToggleMonitoring = () => {
    if (!sensorMonitor) return;
    if (isMonitoring.value) {
      sensorMonitor.stopMonitoring();
      statusText.value = '监测已暂停';
    } else {
      sensorMonitor.startMonitoring();
      statusText.value = '实时监测中...';
    }
    isMonitoring.value = !isMonitoring.value;
  };

  const handleFlyToSensor = (id) => {
    if (sensorMonitor) sensorMonitor.flyToSensor(id);
  };

  const handleSimulateAlert = (id, level) => {
    if (sensorMonitor) {
      sensorMonitor.simulateAlert(id, level);
      const msg = level === 'danger' ? '危险' : level === 'warning' ? '警告' : '安全';
      statusText.value = `已触发${msg}级模拟`;
    }
  };

  const handleAddSensorByClick = (type) => {
    if (sensorMonitor) {
      sensorMonitor.addSensorByClick(type, (msg) => {
        statusText.value = msg;
      });
    }
  };

  const handleRemoveSensor = (id) => {
    if (sensorMonitor) {
      sensorMonitor.removeSensor(id);
      statusText.value = '已删除监测点';
    }
  };

  // ===== 工具箱事件 =====
  const handleFlyHome = () => {
    if (currentTileset.value && viewerRef.value) {
      viewerRef.value.flyTo(currentTileset.value);
    }
  };

  const handleToggleTerrain = () => {
    if (viewerRef.value) {
      viewerRef.value.scene.globe.depthTestAgainstTerrain = !viewerRef.value.scene.globe.depthTestAgainstTerrain;
    }
  };

  const handleDebugInfo = () => {
    if (currentTileset.value) {
      const center = currentTileset.value.boundingSphere.center;
      const cartographic = Cesium.Cartographic.fromCartesian(center);
      alert(`模型中心坐标:\n经度: ${Cesium.Math.toDegrees(cartographic.longitude).toFixed(6)}\n纬度: ${Cesium.Math.toDegrees(cartographic.latitude).toFixed(6)}\n高度: ${cartographic.height.toFixed(2)}米`);
    } else {
      alert('模型尚未加载');
    }
  };

  // ===== 返回所有模板需要的状态和方法 =====
  return {
    // 控制面板
    controlPanelRef,
    controlCollapsed,

    // 状态
    statusText,
    profileData,
    slopeEnabled,
    realSlopeEnabled,
    edlEnabled,
    isMeasuring,
    viewerRef,
    currentTileset,
    measureMode,

    // 标注
    showMarkerPanel,
    markers,
    markerMode,

    // 裂缝图层
    crackVisible,

    // 传感器
    showSensorPanel,
    sensors,
    selectedSensor,
    isMonitoring,

    // 天气
    isRaining,
    rainIntensity,
    toggleRain,
    updateRainIntensity,

    // 鼠标信息
    mouseInfo,

    // 图例
    slopeLegend,

    // 区域预警
    zoneStats,

    // 图层
    toggleCrack,
    toggleEDL,

    // 分析
    handleSlope,
    handleRealSlope,
    handleProfile,
    handleChartHighlight,
    handleCloseChart,

    // 测量
    handleMeasureDistance,
    handleMeasureArea,
    handleMeasureHeight,

    // 清除
    handleClear,

    // 标注操作
    handleAddMarker,
    handleAddDangerZone,
    handleRemoveMarker,
    handleFlyToMarker,
    handleClearAllMarkers,
    handleExportMarkers,

    // 传感器操作
    handleOpenSensor,
    handleCloseSensor,
    handleSelectSensor,
    handleToggleMonitoring,
    handleFlyToSensor,
    handleSimulateAlert,
    handleAddSensorByClick,
    handleRemoveSensor,

    // 工具箱
    handleFlyHome,
    handleToggleTerrain,
    handleDebugInfo,
  };
}
