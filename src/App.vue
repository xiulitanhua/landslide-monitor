<template>
  <div class="main-container">
    <div id="cesiumContainer"></div>

    <!-- 最小化标签 -->
    <div v-if="controlCollapsed" class="control-tab" @click="controlCollapsed = false">⛰️</div>

    <div class="control-panel glass-panel" ref="controlPanelRef" v-show="!controlCollapsed">
      <h3 class="drag-handle">
        <span>⛰️ 滑坡监测数字孪生</span>
        <button @click="controlCollapsed = true" class="min-btn" title="最小化">—</button>
      </h3>
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
import { useAppController } from './composables/useAppController';
import ChartPanel from './components/ChartPanel.vue';
import MapToolbox from './components/MapToolbox.vue';
import MarkerPanel from './components/MarkerPanel.vue';
import SensorPanel from './components/SensorPanel.vue';
import StatusBar from './components/StatusBar.vue';
import ZonePanel from './components/ZonePanel.vue';

const {
  controlPanelRef,
  controlCollapsed,
  statusText,
  profileData,
  slopeEnabled,
  realSlopeEnabled,
  edlEnabled,
  isMeasuring,
  viewerRef,
  currentTileset,
  measureMode,
  showMarkerPanel,
  markers,
  markerMode,
  crackVisible,
  showSensorPanel,
  sensors,
  selectedSensor,
  isMonitoring,
  isRaining,
  rainIntensity,
  toggleRain,
  updateRainIntensity,
  mouseInfo,
  slopeLegend,
  zoneStats,
  toggleCrack,
  toggleEDL,
  handleSlope,
  handleRealSlope,
  handleProfile,
  handleChartHighlight,
  handleCloseChart,
  handleMeasureDistance,
  handleMeasureArea,
  handleMeasureHeight,
  handleClear,
  handleAddMarker,
  handleAddDangerZone,
  handleRemoveMarker,
  handleFlyToMarker,
  handleClearAllMarkers,
  handleExportMarkers,
  handleOpenSensor,
  handleCloseSensor,
  handleSelectSensor,
  handleToggleMonitoring,
  handleFlyToSensor,
  handleSimulateAlert,
  handleAddSensorByClick,
  handleRemoveSensor,
  handleFlyHome,
  handleToggleTerrain,
  handleDebugInfo,
} = useAppController();
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

.min-btn {
  margin-left: auto;
  background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15);
  color: #94a3b8; width: 24px; height: 24px; border-radius: 4px;
  cursor: pointer; font-size: 14px; line-height: 1; padding: 0;
  display: inline-flex; align-items: center; justify-content: center;
}
.min-btn:hover { background: rgba(56,189,248,0.25); color: #38bdf8; }

.control-tab {
  position: absolute; left: 0; top: 160px; z-index: 100;
  width: 36px; height: 80px; background: rgba(15,23,42,0.9);
  backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.15);
  border-left: none; border-radius: 0 8px 8px 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 20px; cursor: pointer; color: #38bdf8;
  box-shadow: 4px 0 16px rgba(0,0,0,0.3); writing-mode: vertical-rl;
}
.control-tab:hover { background: rgba(56,189,248,0.2); width: 40px; }
.control-panel { transition: opacity 0.2s, transform 0.2s; }

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