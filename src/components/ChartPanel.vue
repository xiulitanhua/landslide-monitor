<template>
  <div v-if="collapsed" class="chart-tab" @click="collapsed = false">📉</div>
  <div class="chart-container glass-panel" ref="panelRef" v-show="!collapsed">
    <div class="header drag-handle">
      <span>📉 地形剖面图</span>
      <div class="header-info">
        <span v-if="profileInfo">{{ profileInfo }}</span>
      </div>
      <button @click="collapsed = true" class="min-btn" title="最小化">—</button>
      <button @click="$emit('close')" class="close-btn">×</button>
    </div>
    <div ref="chartRef" class="chart-box"></div>
  </div>
</template>

<script setup>
import { ref, watch, computed, onMounted, onUnmounted, nextTick } from 'vue';
import * as echarts from 'echarts';
import { useDraggable } from '../composables/useDraggable';

const props = defineProps(['chartData']);
const emit = defineEmits(['close', 'highlight']);

const chartRef = ref(null);
const panelRef = ref(null);
const collapsed = ref(false);
let myChart = null;

// 🔥 拖动功能
const { initDraggable, destroyDraggable } = useDraggable(panelRef, '.drag-handle');

// 计算剖面信息
const profileInfo = computed(() => {
  if (!props.chartData || props.chartData.length < 2) return '';
  const heights = props.chartData.map(d => parseFloat(d[1]));
  const distances = props.chartData.map(d => parseFloat(d[0]));
  const minH = Math.min(...heights).toFixed(1);
  const maxH = Math.max(...heights).toFixed(1);
  const totalDist = distances[distances.length - 1].toFixed(1);
  return `长度: ${totalDist}m | 高程: ${minH}~${maxH}m`;
});

const initChart = () => {
  if (!chartRef.value || !props.chartData || props.chartData.length === 0) return;
  
  console.log("📊 初始化图表，数据点数:", props.chartData.length);
  
  if (myChart) myChart.dispose();
  myChart = echarts.init(chartRef.value);
  
  // 计算Y轴范围（留一点余量）
  const heights = props.chartData.map(d => parseFloat(d[1]));
  const minH = Math.min(...heights);
  const maxH = Math.max(...heights);
  const padding = (maxH - minH) * 0.1 || 10;  // 防止 padding 为 0
  
  myChart.setOption({
    tooltip: { 
      trigger: 'axis',
      backgroundColor: 'rgba(30,30,45,0.9)',
      borderColor: '#00c6ff',
      textStyle: { color: '#fff' },
      formatter: function (params) {
        const data = params[0];
        return `<b>距起点:</b> ${data.value[0]} m<br/><b>高程:</b> ${data.value[1]} m`;
      },
      axisPointer: {
        type: 'cross',
        animation: false
      }
    },
    axisPointer: {
      link: [{ xAxisIndex: 'all' }],
      triggerOn: 'mousemove'
    },
    grid: { top: 40, bottom: 40, left: 60, right: 30 },
    xAxis: { 
      type: 'category', 
      name: '距离 (m)', 
      nameLocation: 'middle',
      nameGap: 25,
      boundaryGap: false,
      axisLine: { lineStyle: { color: '#666' } },
      axisLabel: { color: '#aaa' }
    },
    yAxis: { 
      type: 'value', 
      name: '高程 (m)', 
      scale: true, // 关键：让Y轴自适应，起伏更明显
      min: Math.floor(minH - padding),
      max: Math.ceil(maxH + padding),
      axisLine: { lineStyle: { color: '#666' } },
      axisLabel: { color: '#aaa' },
      splitLine: { lineStyle: { color: '#333' } }
    },
    series: [{
      data: props.chartData, 
      type: 'line', 
      smooth: true,
      symbol: 'none', // 隐藏数据点，只显示线
      emphasis: {
        focus: 'series',
        itemStyle: { color: '#ff9e44', borderWidth: 3 }
      },
      areaStyle: { 
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(255, 158, 68, 0.6)' },
          { offset: 0.5, color: 'rgba(255, 100, 50, 0.3)' },
          { offset: 1, color: 'rgba(255, 70, 131, 0.05)' }
        ])
      }, 
      lineStyle: { color: '#ff9e44', width: 3 }
    }]
  });
  
  // 🔥 图表联动：监听 showTip 和 hideTip 事件
  let lastIndex = -1;
  
  // 方法1：监听全局鼠标移动，通过 convertFromPixel 计算索引
  myChart.getZr().on('mousemove', function(params) {
    const pointInPixel = [params.offsetX, params.offsetY];
    if (myChart.containPixel('grid', pointInPixel)) {
      // 获取 X 轴的数据索引
      const xIndex = myChart.convertFromPixel({ seriesIndex: 0 }, pointInPixel)[0];
      const dataIndex = Math.round(xIndex);
      if (dataIndex >= 0 && dataIndex < props.chartData.length && dataIndex !== lastIndex) {
        lastIndex = dataIndex;
        console.log("📊 ECharts hover index:", dataIndex);
        emit('highlight', dataIndex);
      }
    }
  });
  
  // 鼠标离开图表区域
  myChart.getZr().on('globalout', function() {
    lastIndex = -1;
    emit('highlight', -1);
  });
};

// 🔥 组件挂载后初始化图表
onMounted(() => {
  initDraggable();
  nextTick(() => {
    if (props.chartData && props.chartData.length) {
      initChart();
    }
  });
});

// 🔥 监听数据变化，添加 immediate 确保首次也触发
watch(() => props.chartData, (val) => { 
  if (val && val.length) {
    nextTick(() => initChart());
  }
}, { deep: true });

onUnmounted(() => {
  destroyDraggable();
  if (myChart) {
    myChart.dispose();
    myChart = null;
  }
});
</script>

<style scoped>
.chart-container {
  position: absolute; 
  bottom: 20px; 
  left: 50%; 
  transform: translateX(-50%);
  width: 700px; 
  height: 320px;
  background: rgba(20, 20, 35, 0.95); 
  border-radius: 12px;
  border: 1px solid rgba(0, 198, 255, 0.3);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  display: flex; 
  flex-direction: column; 
  color: #fff; 
  z-index: 999;
}
.header { 
  padding: 12px 16px; 
  border-bottom: 1px solid rgba(0, 198, 255, 0.2); 
  display: flex; 
  justify-content: space-between;
  align-items: center;
  font-weight: bold;
  cursor: move;
  user-select: none;
}
.header:active {
  cursor: grabbing;
}
.header-info {
  font-size: 12px;
  color: #8af;
  font-weight: normal;
}
.chart-box { 
  flex: 1; 
  width: 100%; 
}
.close-btn { 
  background: none; 
  border: none; 
  color: #f66; 
  cursor: pointer; 
  font-size: 22px;
  line-height: 1;
  transition: color 0.2s;
}
.close-btn:hover {
  color: #ff3333;
}

.min-btn {
  background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15);
  color: #94a3b8; width: 24px; height: 24px; border-radius: 4px;
  cursor: pointer; font-size: 14px; line-height: 1; padding: 0;
  display: inline-flex; align-items: center; justify-content: center; margin-right: 4px;
}
.min-btn:hover { background: rgba(56,189,248,0.25); color: #38bdf8; }
.chart-tab {
  position: absolute; right: 0; z-index: 100; bottom: 100px;
  width: 36px; height: 72px; background: rgba(15,23,42,0.9);
  backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.15);
  border-right: none; border-radius: 8px 0 0 8px;
  display: flex; align-items: center; justify-content: center;
  font-size: 20px; cursor: pointer; color: #38bdf8;
  box-shadow: -4px 0 16px rgba(0,0,0,0.3); writing-mode: vertical-rl;
}
.chart-tab:hover { background: rgba(56,189,248,0.2); width: 40px; }
.chart-container { transition: opacity 0.2s, transform 0.2s; }
</style>