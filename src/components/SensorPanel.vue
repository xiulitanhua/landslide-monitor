<template>
  <div class="sensor-panel glass-panel" ref="panelRef">
    <div class="panel-header drag-handle">
      <span>📊 IoT 实时监测</span>
      <div class="header-actions">
        <button @click="toggleMonitoring" :class="{active: isMonitoring}">
          {{ isMonitoring ? '⏸️ 暂停' : '▶️ 启动' }}
        </button>
        <button @click="$emit('close')" class="close-btn">×</button>
      </div>
    </div>
    
    <div class="panel-body">
      <!-- 🔥 添加传感器按钮组 -->
      <div class="add-sensor-section">
        <div class="section-label">➕ 点击添加监测点</div>
        <div class="add-btns">
          <button @click="$emit('addSensor', 'GNSS')" class="add-btn gnss" title="GNSS位移计">📡</button>
          <button @click="$emit('addSensor', 'CRACK')" class="add-btn crack" title="裂缝计">📏</button>
          <button @click="$emit('addSensor', 'RAIN')" class="add-btn rain" title="雨量计">🌧️</button>
          <button @click="$emit('addSensor', 'INCLINE')" class="add-btn incline" title="倾斜仪">📐</button>
        </div>
      </div>
      
      <!-- 状态统计 -->
      <div class="stats-bar">
        <div class="stat-item">
          <span class="stat-value">{{ stats.total }}</span>
          <span class="stat-label">总数</span>
        </div>
        <div class="stat-item normal">
          <span class="stat-value">{{ stats.normal }}</span>
          <span class="stat-label">正常</span>
        </div>
        <div class="stat-item warning">
          <span class="stat-value">{{ stats.warning }}</span>
          <span class="stat-label">警告</span>
        </div>
        <div class="stat-item danger">
          <span class="stat-value">{{ stats.danger }}</span>
          <span class="stat-label">危险</span>
        </div>
      </div>
      
      <!-- 传感器列表 / 空状态 -->
      <div class="sensor-list" v-if="sensors.length">
        <div 
          class="sensor-item" 
          v-for="sensor in sensors" 
          :key="sensor.id"
          :class="[sensor.status, { selected: selectedSensor?.id === sensor.id }]"
          @click="selectSensor(sensor)"
        >
          <div class="sensor-icon">{{ sensor.config.icon }}</div>
          <div class="sensor-info">
            <div class="sensor-name-row">
              <span class="sensor-name">{{ sensor.name }}</span>
              <span class="status-tag" :class="sensor.status">
                {{ sensor.status === 'danger' ? '危险' : sensor.status === 'warning' ? '预警' : '正常' }}
              </span>
            </div>
            <div class="sensor-id">{{ sensor.id }}</div>
          </div>
          <div class="sensor-value" :class="sensor.status">
            <span class="value">{{ sensor.value }}</span>
            <span class="unit">{{ sensor.config.unit }}</span>
          </div>
          <button class="delete-btn" @click.stop="$emit('removeSensor', sensor.id)" title="删除">🗑️</button>
        </div>
      </div>
      <div v-else class="sensor-empty">
        尚未添加监测点，请在上方选择类型后点击地形放置传感器。
      </div>
      
      <!-- 测试按钮 -->
      <div class="test-actions">
        <button
          @click="$emit('simulateAlert', (selectedSensor || sensors[0])?.id, 'safe')"
          class="test-btn normal"
          :disabled="!sensors.length"
        >
          ✅ 模拟安全
        </button>
        <button
          @click="$emit('simulateAlert', (selectedSensor || sensors[0])?.id, 'warning')"
          class="test-btn warning"
          :disabled="!sensors.length"
        >
          ⚠️ 模拟警告
        </button>
        <button
          @click="$emit('simulateAlert', (selectedSensor || sensors[0])?.id, 'danger')"
          class="test-btn danger"
          :disabled="!sensors.length"
        >
          🚨 模拟危险
        </button>
      </div>
    </div>
    
    <!-- 详情图表面板 -->
    <div class="chart-section" v-if="selectedSensor">
      <div class="chart-header">
        <span>{{ selectedSensor.config.icon }} {{ selectedSensor.name }} - 实时曲线</span>
        <button @click="$emit('flyTo', selectedSensor.id)" class="fly-btn">🎯 定位</button>
      </div>
      <div ref="chartRef" class="chart-container"></div>
      <div class="threshold-info">
        <span>警告阈值: <b style="color: orange">{{ selectedSensor.config.warningThreshold }}</b> {{ selectedSensor.config.unit }}</span>
        <span>危险阈值: <b style="color: red">{{ selectedSensor.config.dangerThreshold }}</b> {{ selectedSensor.config.unit }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed, onMounted, onUnmounted, nextTick } from 'vue';
import * as echarts from 'echarts';
import { useDraggable } from '../composables/useDraggable';

const props = defineProps({
  sensors: { type: Array, default: () => [] },
  selectedSensor: { type: Object, default: null },
  isMonitoring: { type: Boolean, default: false }
});

const emit = defineEmits(['close', 'selectSensor', 'toggleMonitoring', 'flyTo', 'simulateAlert', 'addSensor', 'removeSensor']);

const chartRef = ref(null);
const panelRef = ref(null);
let myChart = null;

// 🔥 拖动功能
const { initDraggable, destroyDraggable } = useDraggable(panelRef, '.drag-handle');

// 统计数据
const stats = computed(() => ({
  total: props.sensors.length,
  normal: props.sensors.filter(s => s.status === 'normal').length,
  warning: props.sensors.filter(s => s.status === 'warning').length,
  danger: props.sensors.filter(s => s.status === 'danger').length
}));

// 选择传感器
const selectSensor = (sensor) => {
  emit('selectSensor', sensor);
};

// 切换监测状态
const toggleMonitoring = () => {
  emit('toggleMonitoring');
};

// 初始化图表
const initChart = () => {
  if (!chartRef.value || !props.selectedSensor) return;
  
  if (myChart) myChart.dispose();
  myChart = echarts.init(chartRef.value);
  
  updateChart();
};

// 更新图表数据
const updateChart = () => {
  if (!myChart || !props.selectedSensor) return;
  
  const sensor = props.selectedSensor;
  const history = sensor.history || [];
  
  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(20,20,35,0.9)',
      borderColor: '#00c6ff',
      textStyle: { color: '#fff' },
      formatter: (params) => {
        const data = params[0];
        return `<b>${data.name}</b><br/>数值: ${data.value} ${sensor.config.unit}`;
      }
    },
    grid: { top: 30, bottom: 30, left: 50, right: 20 },
    xAxis: {
      type: 'category',
      data: history.map(h => h.time),
      axisLine: { lineStyle: { color: '#444' } },
      axisLabel: { color: '#888', fontSize: 10 },
      splitLine: { show: false }
    },
    yAxis: {
      type: 'value',
      name: sensor.config.unit,
      nameTextStyle: { color: '#888' },
      axisLine: { lineStyle: { color: '#444' } },
      axisLabel: { color: '#888' },
      splitLine: { lineStyle: { color: '#333' } }
    },
    series: [{
      type: 'line',
      data: history.map(h => h.value),
      smooth: true,
      symbol: 'none',
      lineStyle: {
        color: sensor.status === 'danger' ? '#ff4d4d' : 
               sensor.status === 'warning' ? '#ffaa00' : '#00c6ff',
        width: 2
      },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: sensor.status === 'danger' ? 'rgba(255,77,77,0.4)' : 
                             sensor.status === 'warning' ? 'rgba(255,170,0,0.4)' : 'rgba(0,198,255,0.4)' },
          { offset: 1, color: 'rgba(0,0,0,0)' }
        ])
      },
      markLine: {
        silent: true,
        symbol: 'none',
        data: [
          {
            yAxis: sensor.config.warningThreshold,
            lineStyle: { color: 'orange', type: 'dashed' },
            label: { show: false }
          },
          {
            yAxis: sensor.config.dangerThreshold,
            lineStyle: { color: 'red', type: 'dashed' },
            label: { show: false }
          }
        ]
      }
    }]
  };
  
  myChart.setOption(option);
};

// 监听选中传感器变化
watch(() => props.selectedSensor, (newVal) => {
  if (newVal) {
    nextTick(() => initChart());
  }
}, { immediate: true });

// 监听传感器数据更新
watch(() => props.selectedSensor?.history?.length, () => {
  updateChart();
}, { deep: true });

// 监听传感器数值变化
watch(() => props.selectedSensor?.value, () => {
  updateChart();
});

onMounted(() => {
  initDraggable();
});

onUnmounted(() => {
  destroyDraggable();
  if (myChart) {
    myChart.dispose();
    myChart = null;
  }
});
</script>

<style scoped>
.sensor-panel {
  position: absolute;
  top: 80px;
  right: 320px; /* 让出右侧工具箱位置，避免重叠 */
  width: 340px;
  max-height: calc(100vh - 120px);
  display: flex;
  flex-direction: column;
  z-index: 100;
  box-shadow: 0 18px 45px rgba(15, 23, 42, 0.85);
  border-radius: 14px;
  overflow: hidden;
}

.panel-header {
  padding: 10px 14px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.45);
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  cursor: move;
  user-select: none;
  background: radial-gradient(circle at 0 0, rgba(56, 189, 248, 0.35), transparent 55%);
  font-size: 14px;
}

.panel-header:active {
  cursor: grabbing;
}

.header-actions {
  display: flex;
  gap: 6px;
  align-items: center;
}

.header-actions button {
  padding: 4px 12px;
  font-size: 11px;
  background: radial-gradient(circle at 0 0, #38bdf8 0, #0f172a 60%);
  border: 1px solid rgba(56, 189, 248, 0.6);
  color: #e5f4ff;
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.18s ease;
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.85);
}

.header-actions button.active {
  background: linear-gradient(135deg, #22c55e, #a3e635);
  border-color: rgba(190, 242, 100, 0.95);
  color: #0f172a;
}

.close-btn {
  background: none !important;
  color: #fecaca !important;
  font-size: 18px !important;
  padding: 0 4px !important;
}

.panel-body {
  padding: 12px 14px 10px;
  overflow-y: auto;
  flex: 1;
}

/* 统计栏 */
.stats-bar {
  display: flex;
  justify-content: space-around;
  padding: 8px 10px;
  background: radial-gradient(circle at top, rgba(15, 23, 42, 0.9), rgba(15, 23, 42, 0.98));
  border-radius: 10px;
  margin-bottom: 10px;
  border: 1px solid rgba(148, 163, 184, 0.4);
}

.stat-item {
  text-align: center;
}

.stat-value {
  display: block;
  font-size: 20px;
  font-weight: bold;
  color: #fff;
}

.stat-item.normal .stat-value { color: #4ade80; }
.stat-item.warning .stat-value { color: #facc15; }
.stat-item.danger .stat-value { color: #fb7185; }

.stat-label {
  font-size: 11px;
  color: #9ca3af;
}

/* 传感器列表 */
.sensor-list {
  max-height: 200px;
  overflow-y: auto;
  margin-top: 4px;
}

.sensor-item {
  display: flex;
  align-items: center;
  padding: 9px 10px;
  margin: 4px 0;
  background: rgba(15, 23, 42, 0.75);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  border-left: 3px solid transparent;
  border: 1px solid rgba(148, 163, 184, 0.4);
}

.sensor-item:hover {
  background: rgba(30, 64, 175, 0.55);
}

.sensor-item.selected {
  background: rgba(30, 64, 175, 0.8);
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.9);
}

.sensor-item.warning {
  border-left-color: #faad14;
}

.sensor-item.danger {
  border-left-color: #ff4d4f;
  animation: pulse-danger 1s infinite;
}

@keyframes pulse-danger {
  0%, 100% { background: rgba(255, 77, 79, 0.1); }
  50% { background: rgba(255, 77, 79, 0.25); }
}

.sensor-icon {
  font-size: 24px;
  margin-right: 10px;
}

.sensor-info {
  flex: 1;
}

.sensor-name-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.sensor-name {
  font-size: 13px;
  color: #fff;
}

.sensor-id {
  font-size: 10px;
  color: #666;
}

.sensor-value {
  text-align: right;
  min-width: 80px;
}

.sensor-value .value {
  display: block;
  font-size: 16px;
  font-weight: bold;
  color: #52c41a;
}

.sensor-value.warning .value { color: #faad14; }
.sensor-value.danger .value { color: #ff4d4f; }

.sensor-value .unit {
  font-size: 10px;
  color: #9ca3af;
}

.status-tag {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 10px;
  border: 1px solid transparent;
  white-space: nowrap;
}

.status-tag.normal {
  color: #22c55e;
  border-color: rgba(34, 197, 94, 0.6);
  background: rgba(22, 163, 74, 0.15);
}

.status-tag.warning {
  color: #facc15;
  border-color: rgba(250, 204, 21, 0.7);
  background: rgba(250, 204, 21, 0.1);
}

.status-tag.danger {
  color: #fb7185;
  border-color: rgba(248, 113, 113, 0.8);
  background: rgba(248, 113, 113, 0.12);
}

.sensor-empty {
  margin-top: 8px;
  font-size: 12px;
  color: #9ca3af;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px dashed rgba(148, 163, 184, 0.6);
  background: rgba(15, 23, 42, 0.8);
}

/* 测试按钮 */
.test-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.test-btn {
  flex: 1;
  padding: 6px;
  font-size: 11px;
  border-radius: 999px;
  cursor: pointer;
  color: white;
  border: 1px solid transparent;
  transition: all 0.18s ease;
  box-shadow: 0 5px 18px rgba(15, 23, 42, 0.85);
}

.test-btn.warning { background: #d48806; }
.test-btn.danger { background: #cf1322; }

.test-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
  box-shadow: none;
}

/* 🔥 添加传感器区域 */
.add-sensor-section {
  margin-bottom: 12px;
  padding: 10px 10px 8px;
  background: radial-gradient(circle at 0 0, rgba(56, 189, 248, 0.22), rgba(15, 23, 42, 0.95));
  border-radius: 10px;
  border: 1px dashed rgba(56, 189, 248, 0.7);
}

.section-label {
  font-size: 12px;
  color: #e0f2fe;
  margin-bottom: 8px;
}

.add-btns {
  display: flex;
  gap: 8px;
}

.add-btn {
  flex: 1;
  padding: 8px;
  font-size: 18px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.add-btn:hover {
  transform: scale(1.1);
  background: rgba(255, 255, 255, 0.2);
}

.add-btn.gnss:hover { background: rgba(0, 255, 255, 0.3); }
.add-btn.crack:hover { background: rgba(255, 255, 0, 0.3); }
.add-btn.rain:hover { background: rgba(0, 191, 255, 0.3); }
.add-btn.incline:hover { background: rgba(255, 165, 0, 0.3); }

/* 🔥 删除按钮 */
.delete-btn {
  padding: 2px 6px;
  font-size: 12px;
  background: transparent;
  border: none;
  cursor: pointer;
  opacity: 0.5;
  transition: all 0.2s;
}

.delete-btn:hover {
  opacity: 1;
  transform: scale(1.2);
}

/* 图表区域 */
.chart-section {
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding: 12px;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 13px;
}

.fly-btn {
  padding: 4px 8px;
  font-size: 11px;
  background: #1890ff;
  border: none;
  color: white;
  border-radius: 4px;
  cursor: pointer;
}

.chart-container {
  height: 150px;
  width: 100%;
}

.threshold-info {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: #888;
  margin-top: 8px;
}
</style>
