<template>
  <div class="marker-panel glass-panel" ref="panelRef">
    <div class="panel-header drag-handle">
      <span>📍 标注管理</span>
      <button @click="$emit('close')" class="close-btn">×</button>
    </div>
    
    <div class="panel-body">
      <!-- 标注按钮组 -->
      <div class="marker-tools">
        <button @click="$emit('addMarker', 'monitor')" :class="{active: markerMode === 'monitor'}">
          📍 监测点
        </button>
        <button @click="$emit('addMarker', 'danger')" :class="{active: markerMode === 'danger'}">
          ⚠️ 危险点
        </button>
        <button @click="$emit('addMarker', 'warning')" :class="{active: markerMode === 'warning'}">
          🔶 警示点
        </button>
        <button @click="$emit('addDangerZone')" :class="{active: markerMode === 'dangerZone'}">
          🔺 危险区
        </button>
      </div>
      
      <!-- 标注列表 -->
      <div class="marker-list" v-if="markers.length > 0">
        <div class="list-header">
          <span>已添加 {{ markers.length }} 个标注</span>
          <button @click="$emit('exportMarkers')" class="export-btn" title="导出标注">📤</button>
        </div>
        
        <div class="marker-item" v-for="marker in markers" :key="marker.id">
          <div class="marker-info" @click="$emit('flyTo', marker.id)">
            <span class="marker-icon">{{ getIcon(marker.type) }}</span>
            <div class="marker-detail">
              <div class="marker-name">{{ marker.name }}</div>
              <div class="marker-coords">{{ marker.lat }}°N, {{ marker.lon }}°E</div>
            </div>
          </div>
          <button @click="$emit('removeMarker', marker.id)" class="delete-btn" title="删除">🗑️</button>
        </div>
      </div>
      
      <div class="empty-tip" v-else>
        暂无标注，点击上方按钮添加
      </div>
      
      <!-- 底部操作 -->
      <div class="panel-footer" v-if="markers.length > 0">
        <button @click="$emit('clearAll')" class="clear-all-btn">清除全部标注</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useDraggable } from '../composables/useDraggable';

defineProps({
  markers: { type: Array, default: () => [] },
  markerMode: { type: String, default: '' }
});

defineEmits(['close', 'addMarker', 'addDangerZone', 'removeMarker', 'flyTo', 'clearAll', 'exportMarkers']);

const panelRef = ref(null);
const { initDraggable, destroyDraggable } = useDraggable(panelRef, '.drag-handle');

onMounted(() => initDraggable());
onUnmounted(() => destroyDraggable());

const getIcon = (type) => {
  const icons = {
    monitor: '📍',
    danger: '⚠️',
    warning: '🔶',
    info: '📌',
    dangerZone: '🔺'
  };
  return icons[type] || '📍';
};
</script>

<style scoped>
.marker-panel {
  position: absolute;
  top: 20px;
  left: 300px;
  width: 280px;
  max-height: 500px;
  display: flex;
  flex-direction: column;
  z-index: 100;
}

.panel-header {
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: bold;
  cursor: move;
  user-select: none;
}

.panel-header:active {
  cursor: grabbing;
}

.close-btn {
  background: none;
  border: none;
  color: #f66;
  cursor: pointer;
  font-size: 20px;
  padding: 0;
  line-height: 1;
}

.panel-body {
  padding: 12px;
  overflow-y: auto;
  flex: 1;
}

.marker-tools {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 12px;
}

.marker-tools button {
  padding: 8px;
  font-size: 12px;
  background: #0078d7;
  border: none;
  color: white;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.marker-tools button:hover {
  background: #1a8cef;
}

.marker-tools button.active {
  background: #e6a23c;
}

.marker-list {
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-top: 10px;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: #aaa;
  margin-bottom: 8px;
}

.export-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  padding: 2px 6px;
}

.marker-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px;
  margin: 4px 0;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  transition: background 0.2s;
}

.marker-item:hover {
  background: rgba(255, 255, 255, 0.1);
}

.marker-info {
  display: flex;
  align-items: center;
  cursor: pointer;
  flex: 1;
}

.marker-icon {
  font-size: 18px;
  margin-right: 10px;
}

.marker-detail {
  flex: 1;
}

.marker-name {
  font-size: 13px;
  color: #fff;
}

.marker-coords {
  font-size: 10px;
  color: #888;
  margin-top: 2px;
}

.delete-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.delete-btn:hover {
  opacity: 1;
}

.empty-tip {
  text-align: center;
  color: #666;
  font-size: 12px;
  padding: 20px;
}

.panel-footer {
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  margin-top: 10px;
}

.clear-all-btn {
  width: 100%;
  padding: 8px;
  background: #c53;
  border: none;
  color: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.clear-all-btn:hover {
  background: #d64;
}
</style>
