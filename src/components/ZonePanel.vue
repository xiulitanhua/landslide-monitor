<template>
  <template v-if="zones && zones.length">
    <div v-if="collapsed" class="zone-tab" @click="collapsed = false">🗺️</div>
    <div class="zone-panel glass-panel" v-show="!collapsed">
      <div class="panel-header">
        <span>🗺️ 区域预警</span>
        <button @click="collapsed = true" class="min-btn" title="最小化">—</button>
      </div>

    <div class="panel-body">
      <div 
        v-for="zone in zones" 
        :key="zone.id" 
        class="zone-item"
        @click="$emit('flyTo', zone.id)"
      >
        <div class="zone-main">
          <div class="zone-title-row">
            <span class="zone-name">{{ zone.name }}</span>
            <span class="zone-level" :class="'level-' + zone.level">
              L{{ zone.level }}
            </span>
          </div>
          <div class="zone-meta">
            <span class="status-tag" :class="zone.status">
              {{ zone.status === 'danger' ? '危险' : zone.status === 'warning' ? '预警' : '正常' }}
            </span>
            <span class="sensor-count">
              监测点: {{ zone.totalSensors }}
            </span>
          </div>
        </div>
      </div>

      <div v-if="!zones.length" class="empty">
        暂无危险区域，请先在标注面板中绘制“🔺 危险区”
      </div>
    </div>
  </div>
  </template>
</template>

<script setup>
import { ref } from 'vue';
const collapsed = ref(false);
defineProps({
  zones: {
    type: Array,
    default: () => []
  }
});

defineEmits(['flyTo']);
</script>

<style scoped>
.zone-panel {
  position: absolute;
  bottom: 48px;
  left: 24px;
  width: 260px;
  max-height: 260px;
  display: flex;
  flex-direction: column;
  z-index: 95;
  font-size: 12px;
}

.panel-header {
  padding: 8px 12px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.35);
  font-weight: 600;
}

.panel-body {
  padding: 8px 10px;
  overflow-y: auto;
}

.zone-item {
  padding: 6px 8px;
  margin-bottom: 6px;
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.9);
  border: 1px solid rgba(148, 163, 184, 0.4);
  cursor: pointer;
  transition: all 0.18s ease;
}

.zone-item:hover {
  background: rgba(30, 64, 175, 0.7);
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.9);
}

.zone-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 3px;
}

.zone-name {
  font-size: 13px;
}

.zone-level {
  padding: 1px 6px;
  border-radius: 999px;
  border: 1px solid transparent;
  font-size: 11px;
}

.zone-level.level-1 {
  color: #fecaca;
  border-color: rgba(248, 113, 113, 0.8);
  background: rgba(220, 38, 38, 0.25);
}

.zone-level.level-2 {
  color: #fed7aa;
  border-color: rgba(249, 115, 22, 0.8);
  background: rgba(234, 88, 12, 0.2);
}

.zone-level.level-3 {
  color: #fef9c3;
  border-color: rgba(234, 179, 8, 0.9);
  background: rgba(202, 138, 4, 0.18);
}

.zone-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 2px;
}

.status-tag {
  padding: 1px 6px;
  border-radius: 999px;
  font-size: 11px;
  border: 1px solid transparent;
}

.status-tag.normal {
  color: #4ade80;
  border-color: rgba(34, 197, 94, 0.7);
  background: rgba(21, 128, 61, 0.18);
}

.status-tag.warning {
  color: #facc15;
  border-color: rgba(234, 179, 8, 0.8);
  background: rgba(202, 138, 4, 0.18);
}

.status-tag.danger {
  color: #fecaca;
  border-color: rgba(248, 113, 113, 0.9);
  background: rgba(220, 38, 38, 0.32);
}

.sensor-count {
  color: #9ca3af;
}

.empty {
  text-align: center;
  color: #9ca3af;
  font-size: 12px;
  padding: 8px 0;
}

.min-btn {
  margin-left: auto; background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.15); color: #94a3b8;
  width: 24px; height: 24px; border-radius: 4px;
  cursor: pointer; font-size: 14px; line-height: 1; padding: 0;
  display: inline-flex; align-items: center; justify-content: center;
}
.min-btn:hover { background: rgba(56,189,248,0.25); color: #38bdf8; }
.zone-tab {
  position: absolute; right: 0; z-index: 100; bottom: 300px;
  width: 36px; height: 72px; background: rgba(15,23,42,0.9);
  backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.15);
  border-right: none; border-radius: 8px 0 0 8px;
  display: flex; align-items: center; justify-content: center;
  font-size: 20px; cursor: pointer; color: #38bdf8;
  box-shadow: -4px 0 16px rgba(0,0,0,0.3); writing-mode: vertical-rl;
}
.zone-tab:hover { background: rgba(56,189,248,0.2); width: 40px; }
.zone-panel { transition: opacity 0.2s, transform 0.2s; }
</style>
