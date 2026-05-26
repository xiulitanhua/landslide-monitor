/**
 * 🔥 IoT 传感器监测系统
 * 模拟 GNSS位移计、裂缝计、雨量计 数据
 */

import * as Cesium from 'cesium';
import { ref, reactive, onUnmounted } from 'vue';
import { pickPosition } from '@/utils/geometry.js';

export function useSensorMonitor(viewerInstance) {
    const sensors = reactive([]);
    const selectedSensor = ref(null);
    const isMonitoring = ref(false);
    let updateInterval = null;
    let clickHandler = null;
    let alertCallback = null; // 🔥 告警回调
    
    // 传感器类型配置
    const SENSOR_TYPES = {
        GNSS: {
            name: 'GNSS位移计',
            icon: '📡',
            unit: 'mm',
            color: Cesium.Color.CYAN,
            warningThreshold: 15,  // 警告阈值
            dangerThreshold: 25,   // 危险阈值
            baseValue: 5,
            fluctuation: 2
        },
        CRACK: {
            name: '裂缝计',
            icon: '📏',
            unit: 'mm',
            color: Cesium.Color.YELLOW,
            warningThreshold: 10,
            dangerThreshold: 20,
            baseValue: 3,
            fluctuation: 1.5
        },
        RAIN: {
            name: '雨量计',
            icon: '🌧️',
            unit: 'mm/h',
            color: Cesium.Color.DEEPSKYBLUE,
            warningThreshold: 30,
            dangerThreshold: 50,
            baseValue: 0,
            fluctuation: 5
        },
        INCLINE: {
            name: '倾斜仪',
            icon: '📐',
            unit: '°',
            color: Cesium.Color.ORANGE,
            warningThreshold: 3,
            dangerThreshold: 5,
            baseValue: 0.5,
            fluctuation: 0.3
        }
    };
    
    /**
     * 初始化传感器列表（基于模型位置）
     */
    const initSensors = (customSensors = null) => {
        // 默认不添加任何传感器，用户可以手动点击添加
        const defaultSensors = [];
        
        const sensorData = customSensors || defaultSensors;
        
        // 初始化每个传感器的数据
        sensorData.forEach(s => {
            const config = SENSOR_TYPES[s.type];
            const sensor = {
                ...s,
                config,
                value: config.baseValue,
                status: 'normal', // normal | warning | danger
                history: [],
                entity: null
            };
            
            // 生成历史数据（过去30分钟，每分钟一条）
            for (let i = 30; i >= 0; i--) {
                const time = new Date(Date.now() - i * 60 * 1000);
                const value = generateSensorValue(sensor);
                sensor.history.push({
                    time: time.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
                    timestamp: time.getTime(),
                    value: value
                });
            }
            sensor.value = sensor.history[sensor.history.length - 1].value;
            
            sensors.push(sensor);
        });
        
        // 在场景中添加传感器实体
        addSensorsToScene();
        
        // 设置点击事件
        setupClickHandler();
    };
    
    /**
     * 生成模拟传感器数值
     */
    const generateSensorValue = (sensor, trend = 0) => {
        const config = sensor.config;
        // 基础值 + 随机波动 + 趋势
        const randomFactor = (Math.random() - 0.5) * 2 * config.fluctuation;
        let newValue = config.baseValue + randomFactor + trend;
        
        // 雨量特殊处理：可能突然下雨
        if (sensor.type === 'RAIN') {
            if (Math.random() < 0.1) { // 10%概率突然下雨
                newValue = Math.random() * 40;
            }
        }
        
        return Math.max(0, parseFloat(newValue.toFixed(2)));
    };
    
    /**
     * 在Cesium场景中添加传感器图标
     */
    const addSensorsToScene = () => {
        if (!viewerInstance) return;
        
        sensors.forEach(sensor => {
            const config = sensor.config;
            
            // 创建Canvas图标
            const canvas = createSensorIcon(config.icon, config.color);
            
            const entity = viewerInstance.entities.add({
                id: `sensor_${sensor.id}`,
                name: sensor.name,
                position: Cesium.Cartesian3.fromDegrees(
                    sensor.position.lon, 
                    sensor.position.lat, 
                    sensor.position.height + 10
                ),
                billboard: {
                    image: canvas,
                    scale: 1.0,
                    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                    disableDepthTestDistance: Number.POSITIVE_INFINITY,
                    heightReference: Cesium.HeightReference.NONE
                },
                label: {
                    text: `${config.icon} ${sensor.name}\n${sensor.value} ${config.unit}`,
                    font: '12px sans-serif',
                    fillColor: Cesium.Color.WHITE,
                    outlineColor: Cesium.Color.BLACK,
                    outlineWidth: 2,
                    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                    verticalOrigin: Cesium.VerticalOrigin.TOP,
                    pixelOffset: new Cesium.Cartesian2(0, 10),
                    disableDepthTestDistance: Number.POSITIVE_INFINITY,
                    showBackground: true,
                    backgroundColor: Cesium.Color.fromCssColorString('rgba(0,0,0,0.7)')
                },
                properties: {
                    sensorId: sensor.id,
                    sensorType: sensor.type
                }
            });
            
            sensor.entity = entity;
        });
    };
    
    /**
     * 创建传感器图标（Canvas绘制）
     */
    const createSensorIcon = (emoji, color) => {
        const canvas = document.createElement('canvas');
        canvas.width = 48;
        canvas.height = 48;
        const ctx = canvas.getContext('2d');
        
        // 绘制圆形背景
        ctx.beginPath();
        ctx.arc(24, 24, 20, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${Math.floor(color.red * 255)}, ${Math.floor(color.green * 255)}, ${Math.floor(color.blue * 255)}, 0.8)`;
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // 绘制emoji图标
        ctx.font = '20px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(emoji, 24, 24);
        
        return canvas;
    };
    
    /**
     * 设置点击事件处理
     */
    const setupClickHandler = () => {
        if (!viewerInstance) return;
        
        clickHandler = new Cesium.ScreenSpaceEventHandler(viewerInstance.scene.canvas);
        
        clickHandler.setInputAction((click) => {
            const pickedObject = viewerInstance.scene.pick(click.position);
            
            if (Cesium.defined(pickedObject) && pickedObject.id && pickedObject.id.properties) {
                const sensorId = pickedObject.id.properties.sensorId?.getValue();
                if (sensorId) {
                    const sensor = sensors.find(s => s.id === sensorId);
                    if (sensor) {
                        selectedSensor.value = sensor;
                    }
                }
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    };
    
    /**
     * 开始实时监测（定时更新数据）
     */
    const startMonitoring = (interval = 3000) => {
        if (isMonitoring.value) return;
        
        isMonitoring.value = true;
        
        updateInterval = setInterval(() => {
            updateAllSensors();
        }, interval);
        
        console.log('🔥 IoT监测已启动，更新间隔:', interval, 'ms');
    };
    
    /**
     * 停止监测
     */
    const stopMonitoring = () => {
        if (updateInterval) {
            clearInterval(updateInterval);
            updateInterval = null;
        }
        isMonitoring.value = false;
        console.log('⏸️ IoT监测已停止');
    };
    
    /**
     * 更新所有传感器数据
     */
    const updateAllSensors = () => {
        const now = new Date();
        
        sensors.forEach(sensor => {
            // 生成新数据（加入一点趋势，模拟真实变化）
            const trend = (Math.random() - 0.4) * sensor.config.fluctuation * 0.5;
            const newValue = generateSensorValue(sensor, trend);
            
            // 更新当前值
            sensor.value = newValue;
            
            // 更新历史记录（保持最近30条）
            if (sensor.history.length >= 30) {
                sensor.history.shift();
            }
            sensor.history.push({
                time: now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                timestamp: now.getTime(),
                value: newValue
            });
            
            // 更新状态和视觉效果
            updateSensorStatus(sensor);
        });
    };
    
    /**
     * 更新传感器状态（告警逻辑）
     */
    const updateSensorStatus = (sensor) => {
        const config = sensor.config;
        const value = sensor.value;
        
        // 保存旧状态用于检测变化
        const oldStatus = sensor.status;
        
        // 判断状态
        let newStatus = 'normal';
        if (value >= config.dangerThreshold) {
            newStatus = 'danger';
        } else if (value >= config.warningThreshold) {
            newStatus = 'warning';
        }
        
        sensor.status = newStatus;
        
        // 🔥 状态变化时触发告警回调
        if (oldStatus !== newStatus && (newStatus === 'warning' || newStatus === 'danger')) {
            if (alertCallback) {
                alertCallback(sensor, newStatus);
            }
        }
        
        // 更新实体视觉效果
        if (sensor.entity && viewerInstance) {
            const entity = sensor.entity;
            
            // 更新标签文本
            entity.label.text = `${config.icon} ${sensor.name}\n${value} ${config.unit}`;
            
            // 根据状态更新颜色
            if (newStatus === 'danger') {
                entity.billboard.image = createSensorIcon(config.icon, Cesium.Color.RED);
                entity.billboard.scale = 1.3;
                entity.label.fillColor = Cesium.Color.RED;
            } else if (newStatus === 'warning') {
                entity.billboard.image = createSensorIcon(config.icon, Cesium.Color.ORANGE);
                entity.billboard.scale = 1.15;
                entity.label.fillColor = Cesium.Color.ORANGE;
            } else {
                entity.billboard.image = createSensorIcon(config.icon, config.color);
                entity.billboard.scale = 1.0;
                entity.label.fillColor = Cesium.Color.WHITE;
            }
        }
    };
    
    /**
     * 🔥 注册告警回调
     */
    const onAlert = (callback) => {
        alertCallback = callback;
    };
    
    /**
     * 🔥 选中传感器
     */
    const selectSensor = (sensorId) => {
        const sensor = sensors.find(s => s.id === sensorId);
        if (sensor) {
            selectedSensor.value = sensor;
        }
    };
    
    /**
     * 模拟告警事件（用于测试）
     */
    const simulateAlert = (sensorId, level = 'danger') => {
        const sensor = sensors.find(s => s.id === sensorId);
        if (!sensor) return;
        
        const config = sensor.config;
        let targetValue;
        if (level === 'danger') {
            targetValue = config.dangerThreshold * 1.5;
        } else if (level === 'warning') {
            targetValue = config.warningThreshold * 1.1;
        } else { // safe/normal
            // 明确落在安全区间：低于警告阈值
            targetValue = Math.min(config.warningThreshold * 0.6, Math.max(0, config.baseValue));
        }
        
        sensor.value = targetValue;
        sensor.history.push({
            time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            timestamp: Date.now(),
            value: targetValue
        });
        
        updateSensorStatus(sensor);
        selectedSensor.value = sensor;
        
        console.log(`⚠️ 模拟告警: ${sensor.name} 值=${targetValue} ${config.unit}`);
    };
    
    /**
     * 飞行到传感器位置（直接基于用户添加的传感器实体）
     * 目标：无论用户在哪里点击添加传感器，定位都以该实体为中心。
     */
    const flyToSensor = (sensorId) => {
        const sensor = sensors.find(s => s.id === sensorId);
        if (!sensor || !viewerInstance) return;

        console.log('🎯 flyToSensor called:', sensorId, sensor);

        // 1. 若传感器有实体，则以实体为准
        if (sensor.entity) {
            const time = viewerInstance.clock.currentTime;
            const pos = sensor.entity.position?.getValue(time);

            if (pos) {
                const sphere = new Cesium.BoundingSphere(pos, 30); // 以该点为球心
                viewerInstance.camera.flyToBoundingSphere(sphere, {
                    duration: 1.2,
                    offset: new Cesium.HeadingPitchRange(
                        viewerInstance.camera.heading,           // 保持当前朝向
                        Cesium.Math.toRadians(-30),              // 轻微俯视
                        sphere.radius * 6                        // 距离点一定范围
                    )
                });
                return;
            }
        }

        // 2. 兜底：根据记录的经纬高飞行
        if (sensor.position) {
            viewerInstance.camera.flyTo({
                destination: Cesium.Cartesian3.fromDegrees(
                    sensor.position.lon,
                    sensor.position.lat,
                    Math.max(sensor.position.height + 200, 300)
                ),
                orientation: {
                    heading: viewerInstance.camera.heading,
                    pitch: Cesium.Math.toRadians(-45),
                    roll: 0
                },
                duration: 1.2
            });
        }
    };
    
    /**
     * 清理资源
     */
    const cleanup = () => {
        stopMonitoring();
        
        if (clickHandler) {
            clickHandler.destroy();
            clickHandler = null;
        }
        
        if (viewerInstance) {
            sensors.forEach(sensor => {
                if (sensor.entity) {
                    viewerInstance.entities.remove(sensor.entity);
                }
            });
        }
        
        sensors.length = 0;
        selectedSensor.value = null;
    };
    
    /**
     * 获取所有告警传感器
     */
    const getAlertSensors = () => {
        return sensors.filter(s => s.status === 'warning' || s.status === 'danger');
    };
    
    /**
     * 获取传感器统计
     */
    const getSensorStats = () => {
        return {
            total: sensors.length,
            normal: sensors.filter(s => s.status === 'normal').length,
            warning: sensors.filter(s => s.status === 'warning').length,
            danger: sensors.filter(s => s.status === 'danger').length
        };
    };
    
    /**
     * 🔥 手动点击添加传感器
     */
    let addClickHandler = null;

    const restoreClickHandler = () => {
        if (!clickHandler || !viewerInstance) return;
        clickHandler.setInputAction((click) => {
            const pickedObject = viewerInstance.scene.pick(click.position);
            if (Cesium.defined(pickedObject) && pickedObject.id && pickedObject.id.properties) {
                const sensorId = pickedObject.id.properties.sensorId?.getValue();
                if (sensorId) {
                    const sensor = sensors.find(s => s.id === sensorId);
                    if (sensor) {
                        selectedSensor.value = sensor;
                    }
                }
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    };

    const addSensorByClick = (type, callback) => {
        if (!viewerInstance) return;
        
        // 清理之前的 addClickHandler
        if (addClickHandler) {
            addClickHandler.destroy();
            addClickHandler = null;
        }
        
        // 🔥 临时禁用选择用的 clickHandler，防止同时响应同一个点击
        if (clickHandler) {
            clickHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
        }
        
        const config = SENSOR_TYPES[type];
        if (!config) {
            restoreClickHandler();
            callback && callback('⚠️ 未知传感器类型');
            return;
        }
        
        callback && callback(`📍 点击地图放置 ${config.name}，右键取消`);
        
        addClickHandler = new Cesium.ScreenSpaceEventHandler(viewerInstance.scene.canvas);
        
        // 左键点击添加
        addClickHandler.setInputAction((click) => {
            const cartesian = pickPosition(viewerInstance, click.position);
            
            if (!Cesium.defined(cartesian)) {
                callback && callback('⚠️ 请点击有效的点云/模型或地形位置');
                return;
            }

            const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
            const lon = Cesium.Math.toDegrees(cartographic.longitude);
            const lat = Cesium.Math.toDegrees(cartographic.latitude);
            const height = cartographic.height;
            
            // 生成ID
            const typeCount = sensors.filter(s => s.type === type).length + 1;
            const sensorId = `${type}-${String(typeCount).padStart(2, '0')}`;
            
            // 创建新传感器
            const newSensor = {
                id: sensorId,
                type: type,
                name: `${config.name}${typeCount}`,
                position: { lon, lat, height },
                config,
                value: config.baseValue,
                status: 'normal',
                history: [],
                entity: null
            };
            
            // 生成初始历史数据
            for (let i = 10; i >= 0; i--) {
                const time = new Date(Date.now() - i * 60 * 1000);
                newSensor.history.push({
                    time: time.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
                    timestamp: time.getTime(),
                    value: generateSensorValue(newSensor)
                });
            }
            newSensor.value = newSensor.history[newSensor.history.length - 1].value;
            
            // 添加到场景
            const entity = viewerInstance.entities.add({
                id: `sensor_${sensorId}`,
                name: newSensor.name,
                position: Cesium.Cartesian3.fromDegrees(lon, lat, height + 10),
                billboard: {
                    image: createSensorIcon(config.icon, config.color),
                    scale: 1.0,
                    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                    disableDepthTestDistance: Number.POSITIVE_INFINITY
                },
                label: {
                    text: `${config.icon} ${newSensor.name}\n${newSensor.value} ${config.unit}`,
                    font: '12px sans-serif',
                    fillColor: Cesium.Color.WHITE,
                    outlineColor: Cesium.Color.BLACK,
                    outlineWidth: 2,
                    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                    verticalOrigin: Cesium.VerticalOrigin.TOP,
                    pixelOffset: new Cesium.Cartesian2(0, 10),
                    disableDepthTestDistance: Number.POSITIVE_INFINITY,
                    showBackground: true,
                    backgroundColor: Cesium.Color.fromCssColorString('rgba(0,0,0,0.7)')
                },
                properties: {
                    sensorId: sensorId,
                    sensorType: type
                }
            });
            
            newSensor.entity = entity;
            sensors.push(newSensor);
            
            // 清理 addClickHandler
            addClickHandler.destroy();
            addClickHandler = null;
            
            // 🔥 恢复选择用的 clickHandler
            restoreClickHandler();
            
            callback && callback(`✅ 已添加 ${newSensor.name} (${lon.toFixed(6)}, ${lat.toFixed(6)})`);
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
        
        // 右键取消
        addClickHandler.setInputAction(() => {
            if (addClickHandler) {
                addClickHandler.destroy();
                addClickHandler = null;
            }
            // 🔥 恢复选择用的 clickHandler
            restoreClickHandler();
            callback && callback('已取消添加');
        }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
    };
    
    /**
     * 🔥 删除传感器
     */
    const removeSensor = (sensorId) => {
        const index = sensors.findIndex(s => s.id === sensorId);
        if (index === -1) return;
        
        const sensor = sensors[index];
        if (sensor.entity && viewerInstance) {
            viewerInstance.entities.remove(sensor.entity);
        }
        
        sensors.splice(index, 1);
        
        if (selectedSensor.value?.id === sensorId) {
            selectedSensor.value = null;
        }
    };
    
    return {
        sensors,
        selectedSensor,
        isMonitoring,
        SENSOR_TYPES,
        initSensors,
        startMonitoring,
        stopMonitoring,
        flyToSensor,
        simulateAlert,
        selectSensor,
        onAlert,
        addSensorByClick,  // 🔥 手动添加传感器
        removeSensor,      // 🔥 删除传感器
        getAlertSensors,
        getSensorStats,
        cleanup
    };
}
