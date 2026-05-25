<template>
  <div class="status-bar">
    <div v-if="info.hasData" class="info-group">
      <span class="item">
        <span class="label">经度:</span> {{ info.longitude }}°
      </span>
      <span class="item">
        <span class="label">纬度:</span> {{ info.latitude }}°
      </span>
      <span class="item">
        <span class="label">海拔:</span> {{ info.height }} 米
      </span>
      <span class="item divider">|</span>
      <span class="item">
        <span class="label">视高:</span> {{ info.cameraHeight }} 米
      </span>
    </div>
    <div v-else class="info-group">
      Waiting for input...
    </div>
    
    <div class="system-info">
      System Ready
    </div>
  </div>
</template>

<script setup>
defineProps({
  info: {
    type: Object,
    required: true
  }
});
</script>

<style scoped>
.status-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 30px;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  color: #e0e0e0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 20px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  z-index: 90;
  box-sizing: border-box;
}

.info-group {
  display: flex;
  gap: 20px;
}

.item {
  display: inline-flex;
  align-items: center;
}

.label {
  color: #aaa;
  margin-right: 4px;
}

.divider {
  color: #555;
}

.system-info {
  color: #4ade80;
}
</style>
