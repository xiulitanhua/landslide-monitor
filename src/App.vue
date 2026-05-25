<template>
  <div class="main-container">
    <div id="cesiumContainer"></div>

    <div class="control-panel glass-panel" ref="controlPanelRef">
      <h3 class="drag-handle">⛰️ 滑坡监测数字孪生</h3>
      <div class="divider"></div>
      
      <!-- 分析工具 -->
      <div class="section-title">📊 分析工具</div>
      <div class="btn-group">
        <button @click="handleProfile" :class="{active: isMeasuring}">
          📈 剖面分析
        </button>
        <button @click="handleSlope" :class="{active: slopeEnabled, 'slope-active': slopeEnabled}">
          📊 高程分析
        </button>
        <button @click="handleRealSlope" :class="{active: realSlopeEnabled, 'slope-active': realSlopeEnabled}">
          📐 坡度分析
        </button>
      </div>
      
      <!-- 🔥 测量工具 -->
      <div class="section-title">📏 测量工具</div>
      <div class="btn-group measure-group">
        <button @click="handleMeasureDistance" :class="{active: measureMode === 'distance'}">
          📏 距离
        </button>
        <button @click="handleMeasureArea" :class="{active: measureMode === 'area'}">
          📐 面积
        </button>
        <button @click="handleMeasureHeight" :class="{active: measureMode === 'height'}">
          📊 高差
        </button>
      </div>
      
      <!-- 🔥 标注工具 -->
      <div class="section-title">📍 标注工具</div>
      <button @click="showMarkerPanel = !showMarkerPanel" :class="{active: showMarkerPanel}">
        📍 打开标注面板 {{ markers.length > 0 ? `(${markers.length})` : '' }}
      </button>
      
      <!-- 🔥 图层控制 -->
      <div class="section-title">🗂️ 图层控制</div>
      <button @click="toggleCrack" :class="{active: crackVisible}">
        🔴 裂缝图层 {{ crackVisible ? '(显示)' : '(隐藏)' }}
      </button>
      
      <!-- 🔥 传感器监测 -->
      <div class="section-title">📊 IoT 监测</div>
      <button @click="handleOpenSensor" :class="{active: showSensorPanel}">
        📊 传感器监测 {{ sensors.length > 0 ? `(${sensors.length})` : '' }}
      </button>

      <!-- ☁️ 天气特效 -->
      <div class="section-title">☁️ 气象模拟</div>
      <div class="weather-group">
        <button @click="toggleRain" :class="{active: isRaining}">
          🌧️ {{ isRaining ? '关闭降雨监测' : '开启降雨监测' }}
        </button>
        <div v-if="isRaining" class="slider-container" style="margin-top: 10px; padding: 0 5px;">
          <label style="color: #cbd5e1; font-size: 0.85rem; display: block; margin-bottom: 5px;">
            🌧️ 降雨强度: {{ (rainIntensity * 100).toFixed(0) }} %
          </label>
          <input type="range" style="width: 100%; cursor: pointer;" min="0" max="1" step="0.05" :value="rainIntensity" @input="updateRainIntensity" />
        </div>
      </div>

      <button @click="handleClear" class="clear-btn full-width">
        🧹 清除全部
      </button>
      
      <div class="status-text">{{ statusText }}</div>
      
      <!-- 🔥 高程图例 -->
      <div v-if="slopeEnabled" class="slope-legend">
        <div class="legend-title">📊 高程图例</div>
        <div class="legend-item" v-for="item in slopeLegend" :key="item.label">
          <span class="legend-color" :style="{background: item.color}"></span>
          <span class="legend-label">{{ item.label }}</span>
        </div>
      </div>
      
      <!-- 🔥 坡度图例 -->
      <div v-if="realSlopeEnabled" class="slope-legend">
        <div class="legend-title">📐 坡度图例</div>
        <div class="legend-item">
          <span class="legend-color" style="background: red"></span>
          <span class="legend-label">陡坡 (>53°)</span>
        </div>
        <div class="legend-item">
          <span class="legend-color" style="background: orange"></span>
          <span class="legend-label">中坡 (36-53°)</span>
        </div>
        <div class="legend-item">
          <span class="legend-color" style="background: white; border: 1px solid #666"></span>
          <span class="legend-label">缓坡 (<36°)</span>
        </div>
      </div>
    </div>

    <!-- 🔥 新增：右侧工具箱 -->
    <MapToolbox 
      :tileset="currentTileset"
      :viewer="viewerRef"
      :edlEnabled="edlEnabled"
      @flyHome="handleFlyHome"
      @toggleTerrain="handleToggleTerrain"
      @toggleEDL="toggleEDL"
      @debugInfo="handleDebugInfo"
    />

    <ChartPanel 
      v-if="profileData.length > 0" 
      :chartData="profileData" 
      @close="handleCloseChart" 
      @highlight="handleChartHighlight"
    />

    <!-- 🔥 标注管理面板 -->
    <MarkerPanel
      v-if="showMarkerPanel"
      :markers="markers"
      :markerMode="markerMode"
      @close="showMarkerPanel = false"
      @addMarker="handleAddMarker"
      @addDangerZone="handleAddDangerZone"
      @removeMarker="handleRemoveMarker"
      @flyTo="handleFlyToMarker"
      @clearAll="handleClearAllMarkers"
      @exportMarkers="handleExportMarkers"
    />

    <!-- 🔥 传感器监测面板 -->
    <SensorPanel
      v-if="showSensorPanel"
      :sensors="sensors"
      :selectedSensor="selectedSensor"
      :isMonitoring="isMonitoring"
      @close="handleCloseSensor"
      @selectSensor="handleSelectSensor"
      @toggleMonitoring="handleToggleMonitoring"
      @flyTo="handleFlyToSensor"
      @simulateAlert="handleSimulateAlert"
      @addSensor="handleAddSensorByClick"
      @removeSensor="handleRemoveSensor"
    />

    <!-- 区域预警面板 -->
    <ZonePanel
      v-if="zoneStats.length"
      :zones="zoneStats"
      @flyTo="handleFlyToMarker"
    />

    <!-- 🔥 底部状态栏：显示鼠标位置经纬度和高度 -->
    <StatusBar :info="mouseInfo" />
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref, computed, watch } from 'vue';
import * as Cesium from 'cesium';
import { useCesiumViewer } from './composables/useCesiumViewer';
import { useAnalysisTools } from './composables/useAnalysisTools';
import { useMousePosition } from './composables/useMousePosition';
import { useSlopeAnalysis } from './composables/useSlopeAnalysis';
import { useMeasureTools } from './composables/useMeasureTools';
import { useMarkerTools } from './composables/useMarkerTools';
import { useSensorMonitor } from './composables/useSensorMonitor';
import { useDraggable } from './composables/useDraggable'; // 🔥 拖动功能
import { useWeatherTools } from './composables/useWeatherTools';
// ☁️ 天气系统
import ChartPanel from './components/ChartPanel.vue';
import MapToolbox from './components/MapToolbox.vue';
import MarkerPanel from './components/MarkerPanel.vue';
import SensorPanel from './components/SensorPanel.vue';
import StatusBar from './components/StatusBar.vue';
import ZonePanel from './components/ZonePanel.vue';
// 🔥 控制面板拖动
const controlPanelRef = ref(null);
let controlPanelDraggable = null;

const statusText = ref("初始化中...");
const profileData = ref([]);
const slopeEnabled = ref(false);
const realSlopeEnabled = ref(false);
const edlEnabled = ref(true);
const isMeasuring = ref(false);
let viewerRef = ref(null);
const currentTileset = ref(null);
let tools = null;
let measureTools = null;
const measureMode = ref('');

// 🔥 标注相关状态
const showMarkerPanel = ref(false);
let markerTools = null;
const markers = ref([]);
const markerMode = ref('');

// 🔥 裂缝图层
const crackTileset = ref(null);
const crackVisible = ref(false); // 默认隐藏

// 🔥 传感器监测状态
const showSensorPanel = ref(false);
let sensorMonitor = null;
const sensors = ref([]);
const selectedSensor = ref(null);
const isMonitoring = ref(false);

// ☁️ 天气系统状态
const { isRaining, rainIntensity, toggleRain, updateRainIntensity } = useWeatherTools(viewerRef);

const { initViewer } = useCesiumViewer();
const { mouseInfo, initMouseHandler } = useMousePosition();
const { toggleSlopeAnalysis, slopeLegend } = useSlopeAnalysis();

// ===== 多区域预警：基于危险区 + 传感器状态 =====
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

    // 传感器驱动风险等级：危险>预警>正常
    const derivedLevel = danger > 0 ? '1' : warning > 0 ? '2' : '3';

    return {
      id: z.id,
      name: z.name,
      level: derivedLevel,
      status,
      totalSensors: total,
      normal,
      warning,
      danger
    };
  });
});

// 根据区域预警状态动态更新三维危险区多边形的颜色
watch(
  zoneStats,
  (zones) => {
    const allMarkers = markers.value || [];
    zones.forEach((z) => {
      const marker = allMarkers.find((m) => m.id === z.id && m.type === 'dangerZone');
      if (!marker || !marker.entity || !marker.entity.polygon) return;

      // 颜色由传感器驱动等级确定：L1 红，L2 橙，L3 绿（安全）
      const levelColor = z.level === '1'
        ? Cesium.Color.RED
        : z.level === '2'
          ? Cesium.Color.ORANGE
          : Cesium.Color.fromCssColorString('#22c55e');

      marker.entity.polygon.material = levelColor.withAlpha(0.4);
      marker.entity.polygon.outlineColor = levelColor;

      // 同步风险等级到标注数据，便于导出/展示
      marker.level = z.level;

      // 动态更新标签文本（包含等级与面积）
      if (marker.labelEntity && marker.labelEntity.label) {
        const areaText = marker.area ? `${(marker.area / 1_000_000).toFixed(2)} km²` : '';
        marker.labelEntity.label.text = `⚠️ ${marker.name} (L${z.level})\n${areaText}`;
        marker.labelEntity.label.fillColor = levelColor;
      }
    });
  },
  { deep: true, immediate: true }
);

onMounted(async () => {
  // 🔥 初始化控制面板拖动
  controlPanelDraggable = useDraggable(controlPanelRef, '.drag-handle');
  controlPanelDraggable.initDraggable();
  
  viewerRef.value = initViewer('cesiumContainer');
  
  // 🔥 初始化鼠标位置监听
  if (viewerRef.value) {
    initMouseHandler(viewerRef.value);
      // 地形遮挡默认关闭
      viewerRef.value.scene.globe.depthTestAgainstTerrain = false;
  }
  
  tools = useAnalysisTools(viewerRef.value); // 初始化分析工具
  measureTools = useMeasureTools(viewerRef.value); // 初始化测量工具
  
  // 🔥 初始化标注工具
  const markerToolsInstance = useMarkerTools(viewerRef.value);
  markerTools = markerToolsInstance;
  markers.value = markerToolsInstance.markers;

    try {
      statusText.value = "加载点云模型...";
      // 📌 确保你的点云数据在 public/2026 2 7 17 12/tileset.json
      const tileset = await Cesium.Cesium3DTileset.fromUrl(`${import.meta.env.BASE_URL}2026%202%207%2017%2012/tileset.json`, {
          maximumScreenSpaceError: 16,
      });
      viewerRef.value.scene.primitives.add(tileset);
      await tileset.readyPromise;

    // 🔥 视觉增强：为主点云开启 Eye-Dome Lighting（EDL）
    if (tileset.pointCloudShading) {
      tileset.pointCloudShading.eyeDomeLighting = edlEnabled.value;
      tileset.pointCloudShading.eyeDomeLightingStrength = 1.0; // 边缘对比强度
      tileset.pointCloudShading.eyeDomeLightingRadius = 1.0;   // 采样半径
    }
    
    // � 检测点云属性（包括是否有法线）
    console.log("========== 点云属性检测 ==========");
    tileset.tileLoad.addEventListener((tile) => {
      if (tile.content && tile.content.pointsLength > 0) {
        const content = tile.content;
        console.log("📊 Tile 加载:", tile.uri);
        console.log("   点数量:", content.pointsLength);
        
        // 检查是否有法线
        const hasNormals = content.hasNormals !== undefined ? content.hasNormals : 
                          (content._parsedContent?.normals !== undefined);
        console.log("   ✅ 是否有法线 (hasNormals):", hasNormals);

      }
    });
    
    // �🔥 关键：保存到响应式变量，传给工具箱组件
    currentTileset.value = tileset;
    
    viewerRef.value.zoomTo(tileset, new Cesium.HeadingPitchRange(0, -0.5, 0));
    
    // 🔥 加载裂缝点云图层（与原数据重叠）
    try {
      const crack = await Cesium.Cesium3DTileset.fromUrl(`${import.meta.env.BASE_URL}liefeng3/tileset.json`, {
        maximumScreenSpaceError: 1,  // 提高清晰度
      });
      viewerRef.value.scene.primitives.add(crack);
      await crack.readyPromise;

      // 🔥 为裂缝点云同样开启 EDL，让轮廓更清晰
      if (crack.pointCloudShading) {
        crack.pointCloudShading.eyeDomeLighting = edlEnabled.value;
        crack.pointCloudShading.eyeDomeLightingStrength = 1.2;
        crack.pointCloudShading.eyeDomeLightingRadius = 1.0;
      }
      
      // 调整高度 - 向上抬高0.5米，避免Z-fighting闪烁
      const heightOffset = 15;
      const cartographic = Cesium.Cartographic.fromCartesian(crack.boundingSphere.center);
      const surface = Cesium.Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude, 0.0);
      const offset = Cesium.Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude, heightOffset);
      const translation = Cesium.Cartesian3.subtract(offset, surface, new Cesium.Cartesian3());
      crack.modelMatrix = Cesium.Matrix4.fromTranslation(translation);
      
      // 🔥 设置裂缝样式：深紫色，醒目警示效果
      crack.style = new Cesium.Cesium3DTileStyle({
        color: "color('#6B238E', 1.0)",  // 深紫色，完全不透明
        pointSize: 2  // 点大小2像素
      });
      
      crackTileset.value = crack;
      crack.show = false; // 默认隐藏
      console.log("✅ 裂缝图层加载成功 (默认隐藏)");
    } catch (crackError) {
      console.warn("⚠️ 裂缝图层加载失败:", crackError);
    }
    
    statusText.value = "✅ 系统就绪";
  } catch (e) {
    statusText.value = "⚠️ 模型加载失败，请检查 public 目录";
  }
});

// 🔥 切换裂缝图层显示/隐藏
const toggleCrack = () => {
  if (!crackTileset.value) {
    statusText.value = "⚠️ 裂缝图层尚未加载";
    return;
  }
  crackVisible.value = !crackVisible.value;
  crackTileset.value.show = crackVisible.value;
  statusText.value = crackVisible.value ? "🔴 裂缝图层已显示" : "⚪ 裂缝图层已隐藏";
};

// 🔥 切换 Eye-Dome Lighting 视觉增强
const toggleEDL = () => {
  edlEnabled.value = !edlEnabled.value;
  
  if (currentTileset.value && currentTileset.value.pointCloudShading) {
    currentTileset.value.pointCloudShading.eyeDomeLighting = edlEnabled.value;
  }
  if (crackTileset.value && crackTileset.value.pointCloudShading) {
    crackTileset.value.pointCloudShading.eyeDomeLighting = edlEnabled.value;
  }
  
  statusText.value = edlEnabled.value
    ? "👁️ Eye-Dome Lighting 已开启，点云立体感增强"
    : "👁️ Eye-Dome Lighting 已关闭";
};

const handleSlope = () => {
  if (!currentTileset.value) {
    statusText.value = "⚠️ 模型尚未加载";
    return;
  }
  
  // 如果真实坡度分析开启，先关闭
  if (realSlopeEnabled.value) {
    realSlopeEnabled.value = false;
    currentTileset.value.style = undefined;
  }
  
  slopeEnabled.value = !slopeEnabled.value;
  
  // 🔥 使用 GPU CustomShader 进行高程分析（点云无法线，无法做真实坡度）
  const success = toggleSlopeAnalysis(slopeEnabled.value, currentTileset.value);
  
  if (success) {
    statusText.value = slopeEnabled.value 
      ? "📊 高程分析已开启 (GPU渲染)" 
      : "✅ 高程分析已关闭";
  }
};

// 🔥 新增：真实坡度分析（基于法线）
const handleRealSlope = () => {
  if (!currentTileset.value) {
    statusText.value = "⚠️ 模型尚未加载";
    return;
  }
  
  // 如果高程分析开启，先关闭
  if (slopeEnabled.value) {
    toggleSlopeAnalysis(false, currentTileset.value);
    slopeEnabled.value = false;
  }
  
  realSlopeEnabled.value = !realSlopeEnabled.value;
  
  // 使用 useAnalysisTools 中的坡度分析（基于 NormalZ）
  tools.toggleSlopeAnalysis(currentTileset.value, realSlopeEnabled.value);
  
  statusText.value = realSlopeEnabled.value 
    ? "📐 坡度分析已开启 (基于法线)" 
    : "✅ 坡度分析已关闭";
};

const handleProfile = () => {
  isMeasuring.value = true;
  // 🔥 传入状态回调，实时更新提示信息
  tools.measureProfile((data) => {
    profileData.value = data;
    isMeasuring.value = false;
  }, (msg) => {
    statusText.value = msg;
  });
};

// 🔥 图表-地图联动：鼠标悬停高亮
const handleChartHighlight = (index) => {
  console.log("📍 图表高亮事件, index:", index);
  if (tools && tools.highlightPointOnMap) {
    tools.highlightPointOnMap(index);
  }
};

// 🔥 关闭图表并清理高亮点
const handleCloseChart = () => {
  profileData.value = [];
  if (tools && tools.highlightPointOnMap) {
    tools.highlightPointOnMap(-1);
  }
};

// ===== 🔥 测量工具处理函数 =====
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
  
  // 🔥 清除测量结果
  if (measureTools) {
    measureTools.clearMeasure();
    measureMode.value = '';
  }
  
  // 🔥 同时关闭高程分析
  if (slopeEnabled.value) {
    toggleSlopeAnalysis(false, currentTileset.value);
  }
  slopeEnabled.value = false;
  
  // 🔥 同时关闭坡度分析
  realSlopeEnabled.value = false;
  
  isMeasuring.value = false;
  statusText.value = "已清除";
};

// ===== 🔥 标注工具处理函数 =====
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
    statusText.value = "已删除标注";
  }
};

const handleFlyToMarker = (id) => {
  if (markerTools) {
    markerTools.flyToMarker(id);
  }
};

const handleClearAllMarkers = () => {
  if (markerTools) {
    markerTools.clearAllMarkers();
    statusText.value = "已清除所有标注";
  }
};

const handleExportMarkers = () => {
  if (markerTools) {
    markerTools.exportMarkers();
    statusText.value = "标注已导出";
  }
};

// ===== 🔥 传感器监测处理函数 =====
const handleOpenSensor = () => {
  showSensorPanel.value = !showSensorPanel.value;
  
  if (showSensorPanel.value && !sensorMonitor) {
    // 首次打开，初始化传感器
    sensorMonitor = useSensorMonitor(viewerRef.value);
    sensorMonitor.initSensors();
    sensors.value = sensorMonitor.sensors;
    
    // 监听告警事件
    sensorMonitor.onAlert((sensor, status) => {
      const emoji = status === 'danger' ? '🚨' : '⚠️';
      statusText.value = `${emoji} ${sensor.name} ${status === 'danger' ? '危险告警' : '预警'}！当前值: ${sensor.value}${sensor.config.unit}`;
    });
    
    statusText.value = "传感器监测系统已加载";
  }
};

const handleCloseSensor = () => {
  showSensorPanel.value = false;
  // 关闭面板时停止监测（可选）
  // if (sensorMonitor) sensorMonitor.stopMonitoring();
};

const handleSelectSensor = (sensor) => {
  selectedSensor.value = sensor;
  if (sensorMonitor) {
    sensorMonitor.selectSensor(sensor.id);
  }
};

const handleToggleMonitoring = () => {
  if (!sensorMonitor) return;
  
  if (isMonitoring.value) {
    sensorMonitor.stopMonitoring();
    statusText.value = "⏸️ 监测已暂停";
  } else {
    sensorMonitor.startMonitoring();
    statusText.value = "▶️ 实时监测中...";
  }
  isMonitoring.value = !isMonitoring.value;
};

const handleFlyToSensor = (id) => {
  if (sensorMonitor) {
    sensorMonitor.flyToSensor(id);
  }
};

const handleSimulateAlert = (id, level) => {
  if (sensorMonitor) {
    sensorMonitor.simulateAlert(id, level);
    const msg = level === 'danger' ? '危险' : level === 'warning' ? '警告' : '安全';
    statusText.value = `⚡ 已触发${msg}级模拟`;
  }
};

// 🔥 手动点击添加传感器
const handleAddSensorByClick = (type) => {
  if (sensorMonitor) {
    sensorMonitor.addSensorByClick(type, (msg) => {
      statusText.value = msg;
    });
  }
};

// 🔥 删除传感器
const handleRemoveSensor = (id) => {
  if (sensorMonitor) {
    sensorMonitor.removeSensor(id);
    statusText.value = "🗑️ 已删除监测点";
  }
};

// 🔥 工具箱事件处理函数
const handleFlyHome = () => {
  if (currentTileset.value && viewerRef.value) {
    viewerRef.value.flyTo(currentTileset.value);
  }
};

const handleToggleTerrain = () => {
  if (viewerRef.value) {
    viewerRef.value.scene.globe.depthTestAgainstTerrain = !viewerRef.value.scene.globe.depthTestAgainstTerrain;
    console.log("地形遮挡已切换:", viewerRef.value.scene.globe.depthTestAgainstTerrain);
  }
};

const handleDebugInfo = () => {
  if (currentTileset.value) {
    const center = currentTileset.value.boundingSphere.center;
    const cartographic = Cesium.Cartographic.fromCartesian(center);
    alert(`模型中心坐标:\n经度: ${Cesium.Math.toDegrees(cartographic.longitude).toFixed(6)}\n纬度: ${Cesium.Math.toDegrees(cartographic.latitude).toFixed(6)}\n高度: ${cartographic.height.toFixed(2)}米`);
  } else {
    alert("模型尚未加载");
  }
};

// 🔥 清理资源
onUnmounted(() => {
  if (controlPanelDraggable) {
    controlPanelDraggable.destroyDraggable();
  }
});
</script>

<style>
.main-container {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: radial-gradient(circle at 20% 20%, #1e293b 0, #020617 60%, #000 100%);
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

#cesiumContainer {
  width: 100%;
  height: 100%;
}

/* 统一玻璃拟态风格，与右侧工具箱保持一致 */
.glass-panel {
  background: rgba(15, 23, 42, 0.9);
  backdrop-filter: blur(14px);
  border: 1px solid rgba(148, 163, 184, 0.35);
  color: #e5e7eb;
  border-radius: 14px;
  box-shadow: 0 18px 45px rgba(15, 23, 42, 0.75);
}

/* 左侧主控制面板 */
.control-panel {
  position: absolute;
  top: 80px;
  left: 24px;
  width: 280px;
  max-height: calc(100vh - 120px);
  padding: 18px 18px 14px;
  z-index: 100;
  display: flex;
  flex-direction: column;
  gap: 6px;
  box-sizing: border-box;
}

/* 标题区域（拖动手柄） */
.drag-handle {
  margin: 0 0 6px 0;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: #f9fafb;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: move;
  user-select: none;
}

.drag-handle::before {
  content: "";
  display: inline-block;
  width: 3px;
  height: 18px;
  border-radius: 999px;
  background: linear-gradient(180deg, #38bdf8, #a855f7);
}

.drag-handle:active {
  cursor: grabbing;
}

.divider {
  height: 1px;
  margin: 4px 0 8px;
  background: radial-gradient(circle at left, rgba(56, 189, 248, 0.6), transparent 55%);
  opacity: 0.6;
}

/* 分段标题 */
.section-title {
  font-size: 12px;
  color: #a5b4fc;
  margin: 8px 0 6px 0;
  padding-bottom: 4px;
  border-bottom: 1px solid rgba(129, 140, 248, 0.45);
  text-shadow: 0 0 6px rgba(129, 140, 248, 0.35);
}

.btn-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.btn-group.measure-group {
  flex-direction: row;
  flex-wrap: wrap;
}

.btn-group.measure-group button {
  flex: 1;
  min-width: 72px;
  font-size: 13px;
  padding: 6px 8px;
}

button {
  padding: 8px 10px;
  cursor: pointer;
  background: radial-gradient(circle at 0 0, #38bdf8 0, #0f172a 60%);
  border: 1px solid rgba(56, 189, 248, 0.5);
  color: #e5f4ff;
  border-radius: 999px;
  font-size: 13px;
  line-height: 1.2;
  transition: background 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease,
    border-color 0.18s ease, color 0.18s ease;
  box-shadow: 0 4px 18px rgba(15, 23, 42, 0.8);
  text-align: left;
}

button:hover {
  background: radial-gradient(circle at 0 0, #7dd3fc 0, #0b1120 65%);
  transform: translateY(-1px);
  box-shadow: 0 10px 26px rgba(15, 23, 42, 0.95);
}

button.active {
  background: linear-gradient(135deg, #f59e0b, #f97316);
  border-color: rgba(251, 191, 36, 0.9);
  color: #111827;
  box-shadow: 0 10px 30px rgba(245, 158, 11, 0.65);
}

button.slope-active {
  background: linear-gradient(120deg, #ef4444, #facc15, #22c55e) !important;
  border-color: rgba(248, 250, 252, 0.7);
  color: #0f172a;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%,
  100% {
    transform: scale(1);
    box-shadow: 0 0 8px rgba(248, 250, 252, 0.75);
  }
  50% {
    transform: scale(1.03);
    box-shadow: 0 0 20px rgba(248, 250, 252, 1);
  }
}

button.clear-btn {
  background: radial-gradient(circle at 100% 0, #f97373 0, #1f2933 55%);
  border-color: rgba(248, 113, 113, 0.85);
}

button.clear-btn:hover {
  background: radial-gradient(circle at 100% 0, #fecaca 0, #111827 70%);
}

button.full-width {
  margin-top: 10px;
}

.status-text {
  font-size: 12px;
  color: #9ca3af;
  text-align: left;
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px dashed rgba(148, 163, 184, 0.5);
}

/* 坡度/高程图例样式 */
.slope-legend {
  margin-top: 10px;
  padding: 8px 10px;
  background: radial-gradient(circle at top, rgba(15, 23, 42, 0.85), rgba(15, 23, 42, 0.95));
  border-radius: 9px;
  border: 1px solid rgba(148, 163, 184, 0.45);
}

.legend-title {
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 6px;
  color: #e5e7eb;
}

.legend-item {
  display: flex;
  align-items: center;
  margin: 3px 0;
  font-size: 11px;
}

.legend-color {
  width: 18px;
  height: 12px;
  border-radius: 3px;
  margin-right: 8px;
  border: 1px solid rgba(248, 250, 252, 0.65);
}

.legend-label {
  color: #cbd5f5;
}

/* 移动端适配：让面板更易点、更居中 */
@media (max-width: 768px) {
  .control-panel {
    width: 92vw;
    left: 4vw;
    top: 16px;
    padding: 14px 14px 10px;
    max-height: calc(100vh - 40px);
    font-size: 15px;
  }

  .drag-handle {
    font-size: 18px;
    padding: 4px 0;
    word-break: break-all;
    line-height: 1.2;
  }
}
</style>