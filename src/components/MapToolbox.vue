<template>
  <div class="toolbox-panel" ref="panelRef">
    <h3 class="drag-handle">🛠️ 工具箱</h3>
    
    <div class="tool-group">
      <label>📐 模型高度微调 ({{ heightVal }}米)</label>
      <div class="btn-row">
        <button @click="changeHeight(-5)">⬇️ 下降</button>
        <button @click="changeHeight(5)">⬆️ 上升</button>
        <button @click="resetAll">0️⃣ 复位</button>
      </div>
      <input 
        type="range" 
        min="-500" 
        max="500" 
        v-model.number="heightVal" 
        @input="onHeightChange"
      />
    </div>

    <div class="divider"></div>

    <div class="tool-group">
      <label>🧭 水平位置微调</label>
      <div class="position-controls">
        <div class="pos-row">
          <span>东西 ({{ lonVal }}米)</span>
          <div class="pos-btns">
            <button @click="changeLon(-10)">⬅️</button>
            <button @click="changeLon(10)">➡️</button>
          </div>
        </div>
        <input 
          type="range" 
          min="-500" 
          max="500" 
          v-model.number="lonVal" 
          @input="onPositionChange"
        />
        <div class="pos-row">
          <span>南北 ({{ latVal }}米)</span>
          <div class="pos-btns">
            <button @click="changeLat(-10)">⬇️</button>
            <button @click="changeLat(10)">⬆️</button>
          </div>
        </div>
        <input 
          type="range" 
          min="-500" 
          max="1500"
          v-model.number="latVal" 
          @input="onPositionChange"
        />
      </div>
    </div>

    <div class="divider"></div>

    <div class="tool-group">
      <label>👻 模型透明度 ({{ opacityVal }}%)</label>
      <input 
        type="range" 
        min="0" 
        max="100" 
        v-model.number="opacityVal" 
        @input="onOpacityChange"
      />
    </div>

    <div class="divider"></div>

    <div class="tool-group">
      <label>👁️ 视图控制</label>
      <div class="btn-grid">
        <button @click="$emit('flyHome')">🏠 视角复位</button>
        <button @click="$emit('toggleTerrain')">⛰️ 地形开关</button>
        
        <button 
          @click="$emit('toggleEDL')" 
          :class="{ active: props.edlEnabled }"
        >
          {{ props.edlEnabled ? '👁️ 关闭立体光照' : '👁️ 开启立体光照' }}
        </button>

        <button @click="$emit('debugInfo')">📊 调试信息</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue';
import * as Cesium from 'cesium';
import { useTilesetControl } from '@/composables/useTilesetControl.js';
import { useDraggable } from '@/composables/useDraggable.js';

// 接收父组件传来的 viewer 和 tileset
const props = defineProps(['tileset', 'viewer', 'edlEnabled']); 
const emit = defineEmits(['flyHome', 'toggleTerrain', 'toggleEDL', 'debugInfo']);

const panelRef = ref(null);
const { initDraggable, destroyDraggable } = useDraggable(panelRef, '.drag-handle');

onMounted(() => initDraggable());
onUnmounted(() => destroyDraggable());

const { updateTilesetHeight, updateTilesetPosition } = useTilesetControl();

// --- 状态变量 ---
const heightVal = ref(0);
const lonVal = ref(0);  // 经度偏移（米）
const latVal = ref(0);  // 纬度偏移（米）
const opacityVal = ref(100); // 默认不透明

// --- 高度控制 ---
const changeHeight = (delta) => {
  heightVal.value += delta;
  onHeightChange();
};
const resetAll = () => {
  heightVal.value = 0;
  lonVal.value = 0;
  latVal.value = 0;
  onHeightChange();
  onPositionChange();
};
const onHeightChange = () => {
  if (props.tileset) {
    updateTilesetHeight(props.tileset, heightVal.value);
  }
};

// --- 位置控制 ---
const changeLon = (delta) => {
  lonVal.value += delta;
  onPositionChange();
};
const changeLat = (delta) => {
  latVal.value += delta;
  onPositionChange();
};
const onPositionChange = () => {
  if (props.tileset) {
    updateTilesetPosition(props.tileset, lonVal.value, latVal.value);
  }
};

// --- 🔥 新功能：透明度控制 ---
const onOpacityChange = () => {
  if (!props.tileset) return;
  
  const alpha = opacityVal.value / 100.0;
  
  // 当透明度为100%时，清除样式恢复原始颜色
  if (alpha >= 1.0) {
    props.tileset.style = undefined;
    return;
  }
  
  // 使用 ${COLOR} 内置变量保留原始颜色，只修改透明度
  // 注意：在JS模板字符串中，Cesium样式变量的 $ 需要转义
  props.tileset.style = new Cesium.Cesium3DTileStyle({
    color: `rgba(\${COLOR}.red * 255, \${COLOR}.green * 255, \${COLOR}.blue * 255, ${alpha})`
  });
};

// 日照开关逻辑已由 EDL 立体光照替代，相关功能在父组件中实现
</script>

<style scoped>
.toolbox-panel {
  position: absolute;
  top: 80px; /* 稍微往下挪一点，避开右上角可能的其他按钮 */
  right: 20px;
  width: 260px;
  background: rgba(15, 23, 42, 0.85); /* 深蓝灰色背景，更有科技感 */
  backdrop-filter: blur(12px);
  padding: 16px;
  border-radius: 12px;
  color: #e2e8f0;
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  z-index: 100;
  font-family: system-ui, -apple-system, sans-serif;
  user-select: none;
}

h3 {
  margin: 0 0 12px 0;
  font-size: 15px;
  font-weight: 600;
  color: #fff;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: move;
  user-select: none;
}

h3:active {
  cursor: grabbing;
}

.tool-group {
  margin-bottom: 12px;
}

label {
  display: block;
  font-size: 12px;
  color: #94a3b8;
  margin-bottom: 6px;
  font-weight: 500;
}

.btn-row {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
}

.btn-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

button {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #f1f5f9;
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}

button:hover {
  background: rgba(56, 189, 248, 0.2);
  border-color: rgba(56, 189, 248, 0.5);
  color: #38bdf8;
}

button.active {
  background: #38bdf8;
  color: #0f172a;
  font-weight: bold;
  border-color: #38bdf8;
}

/* 自定义滑块样式 */
input[type=range] {
  width: 100%;
  height: 4px;
  background: #334155;
  border-radius: 2px;
  outline: none;
  -webkit-appearance: none;
}

input[type=range]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  background: #38bdf8;
  border-radius: 50%;
  cursor: pointer;
  transition: transform 0.1s;
}

input[type=range]::-webkit-slider-thumb:hover {
  transform: scale(1.2);
}

.divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.1);
  margin: 12px 0;
}

.position-controls {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.pos-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  color: #94a3b8;
}

.pos-btns {
  display: flex;
  gap: 4px;
}

.pos-btns button {
  padding: 4px 8px;
  font-size: 11px;
}
</style>
