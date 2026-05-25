/**
 * 🔥 标注工具 - 添加监测点、危险区域、文字标注
 */

import * as Cesium from 'cesium';
import { ref, reactive } from 'vue';

export function useMarkerTools(viewerInstance) {
    const isMarking = ref(false);
    const markerMode = ref(''); // 'point' | 'danger' | 'monitor' | 'text'
    const markers = reactive([]); // 存储所有标注
    
    let handler = null;
    let markerId = 0;
    
    // 标注类型配置
    const MARKER_TYPES = {
        monitor: {
            name: '监测点',
            icon: '📍',
            color: Cesium.Color.CYAN,
            pointSize: 14
        },
        danger: {
            name: '危险区',
            icon: '⚠️',
            color: Cesium.Color.RED,
            pointSize: 16
        },
        warning: {
            name: '警示点',
            icon: '🔶',
            color: Cesium.Color.ORANGE,
            pointSize: 14
        },
        info: {
            name: '信息点',
            icon: '📌',
            color: Cesium.Color.YELLOW,
            pointSize: 12
        }
    };

    // 危险区等级配置，统一管理颜色和文案
    const DANGER_LEVELS = {
        '1': { label: '高', color: Cesium.Color.RED },
        '2': { label: '中', color: Cesium.Color.ORANGE },
        '3': { label: '低', color: Cesium.Color.fromCssColorString('#22c55e') } // 安全用绿色
    };

    // 计算多边形面积（在局部 ENU 平面上使用鞋带公式），返回平面面积和几何中心
    const computeAreaAndCenter = (positions) => {
        if (positions.length < 3) return { area: 0, center: positions[0] };

        // 以首点为局部坐标原点，建立 ENU 变换
        const origin = positions[0];
        const enuMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(origin);
        const enuInverse = Cesium.Matrix4.inverse(enuMatrix, new Cesium.Matrix4());

        const localPts = positions.map((p) => {
            const lp = Cesium.Matrix4.multiplyByPoint(enuInverse, p, new Cesium.Cartesian3());
            return { x: lp.x, y: lp.y };
        });

        let area = 0;
        let cx = 0;
        let cy = 0;
        const n = localPts.length;
        for (let i = 0; i < n; i++) {
            const { x: x1, y: y1 } = localPts[i];
            const { x: x2, y: y2 } = localPts[(i + 1) % n];
            const cross = x1 * y2 - x2 * y1;
            area += cross;
            cx += (x1 + x2) * cross;
            cy += (y1 + y2) * cross;
        }

        area = Math.abs(area) / 2;
        const factor = area !== 0 ? 1 / (6 * area) : 0;
        const centroidLocal = new Cesium.Cartesian3(cx * factor, cy * factor, 0);
        const centroidWorld = Cesium.Matrix4.multiplyByPoint(enuMatrix, centroidLocal, new Cesium.Cartesian3());

        return { area, center: centroidWorld };
    };

    // 清理临时实体，避免泄漏
    const cleanupTempDangerEntities = (viewer, count, tempPolygon) => {
        if (!viewer) return;
        for (let i = 1; i <= count; i++) {
            const tempEntity = viewer.entities.getById(`dangerZone_temp_${i}`);
            if (tempEntity) viewer.entities.remove(tempEntity);
        }
        if (tempPolygon) viewer.entities.remove(tempPolygon);
    };
    
    /**
     * 📍 添加点标注
     */
    const addMarker = (type, statusCallback) => {
        if (!viewerInstance) return;
        
        const viewer = viewerInstance;
        const config = MARKER_TYPES[type] || MARKER_TYPES.info;
        
        cancelMarking();
        isMarking.value = true;
        markerMode.value = type;
        viewer.scene.canvas.style.cursor = "crosshair";
        
        if (statusCallback) statusCallback(`${config.icon} 点击地图添加【${config.name}】`);
        
        handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        
        handler.setInputAction((click) => {
            const cartesian = viewer.scene.pickPosition(click.position);
            if (!Cesium.defined(cartesian)) return;
            
            const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
            const lon = Cesium.Math.toDegrees(cartographic.longitude);
            const lat = Cesium.Math.toDegrees(cartographic.latitude);
            const height = cartographic.height;
            
            // 生成默认标签名
            const defaultName = `${config.name}${markers.filter(m => m.type === type).length + 1}`;
            
            // 弹出输入框让用户输入标注名称
            const name = prompt(`请输入${config.name}名称:`, defaultName);
            if (name === null) return; // 用户取消
            
            const id = ++markerId;
            
            // 创建标注实体
            const entity = viewer.entities.add({
                id: `marker_${id}`,
                position: cartesian,
                point: {
                    pixelSize: config.pointSize,
                    color: config.color,
                    outlineColor: Cesium.Color.WHITE,
                    outlineWidth: 2,
                    disableDepthTestDistance: Number.POSITIVE_INFINITY,
                    heightReference: Cesium.HeightReference.NONE
                },
                label: {
                    text: `${config.icon} ${name || defaultName}`,
                    font: 'bold 14px sans-serif',
                    fillColor: Cesium.Color.WHITE,
                    outlineColor: Cesium.Color.BLACK,
                    outlineWidth: 2,
                    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                    pixelOffset: new Cesium.Cartesian2(0, -20),
                    disableDepthTestDistance: Number.POSITIVE_INFINITY,
                    showBackground: true,
                    backgroundColor: Cesium.Color.fromCssColorString('rgba(0,0,0,0.6)')
                },
                // 存储自定义属性
                properties: {
                    markerId: id,
                    type: type,
                    name: name || defaultName
                }
            });
            
            // 添加到标注列表
            const markerData = {
                id,
                type,
                name: name || defaultName,
                lon: lon.toFixed(6),
                lat: lat.toFixed(6),
                height: height.toFixed(1),
                entity,
                timestamp: new Date().toLocaleString()
            };
            markers.push(markerData);
            
            if (statusCallback) statusCallback(`✅ 已添加【${name || defaultName}】`);
            
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
        
        // 右键取消
        handler.setInputAction(() => {
            cancelMarking();
            if (statusCallback) statusCallback("已取消标注");
        }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
    };
    
    /**
     * 🔶 添加多边形危险区域
     */
    const addDangerZone = (statusCallback) => {
        if (!viewerInstance) return;
        
        const viewer = viewerInstance;
        const points = [];
        let tempPolygon = null;
        
        cancelMarking();
        isMarking.value = true;
        markerMode.value = 'dangerZone';
        viewer.scene.canvas.style.cursor = "crosshair";
        
        if (statusCallback) statusCallback("⚠️ 左键添加顶点，右键闭合创建危险区域");
        
        handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        
        // 左键添加点
        handler.setInputAction((click) => {
            const cartesian = viewer.scene.pickPosition(click.position);
            if (!Cesium.defined(cartesian)) return;
            
            points.push(cartesian);
            
            // 添加顶点标记
            viewer.entities.add({
                id: `dangerZone_temp_${points.length}`,
                position: cartesian,
                point: {
                    pixelSize: 8,
                    color: Cesium.Color.RED,
                    outlineColor: Cesium.Color.WHITE,
                    outlineWidth: 1,
                    disableDepthTestDistance: Number.POSITIVE_INFINITY
                }
            });
            
            if (statusCallback) statusCallback(`⚠️ 已添加 ${points.length} 个顶点，右键完成`);
            
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
        
        // 鼠标移动预览
        handler.setInputAction((movement) => {
            if (points.length < 2) return;
            
            const cartesian = viewer.scene.pickPosition(movement.endPosition);
            if (!Cesium.defined(cartesian)) return;
            
            if (tempPolygon) viewer.entities.remove(tempPolygon);
            
            tempPolygon = viewer.entities.add({
                polygon: {
                    hierarchy: new Cesium.PolygonHierarchy([...points, cartesian]),
                    material: Cesium.Color.RED.withAlpha(0.3),
                    outline: true,
                    outlineColor: Cesium.Color.RED,
                    outlineWidth: 2,
                    perPositionHeight: true,
                    heightReference: Cesium.HeightReference.NONE
                }
            });
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
        
        // 右键完成
        handler.setInputAction(() => {
            cleanupTempDangerEntities(viewer, points.length, tempPolygon);

            if (points.length < 3) {
                if (statusCallback) statusCallback('⚠️ 至少需要 3 个顶点才能生成危险区');
                cancelMarking();
                return;
            }

            const defaultName = `危险区${markers.filter(m => m.type === 'dangerZone').length + 1}`;
            const name = prompt("请输入危险区域名称:", defaultName);
            if (name === null) {
                cancelMarking();
                return;
            }

            const id = ++markerId;
            // 初始以中等级显示，后续由传感器动态决定风险等级
            const level = '2';
            const levelConfig = DANGER_LEVELS[level];
            const zoneColor = levelConfig.color;

            // 计算面积与中心点（方便 UI 展示和后续统计）
            const { area, center } = computeAreaAndCenter(points);

            // 创建最终多边形
            const entity = viewer.entities.add({
                id: `marker_${id}`,
                polygon: {
                    hierarchy: new Cesium.PolygonHierarchy(points),
                    material: zoneColor.withAlpha(0.35),
                    outline: true,
                    outlineColor: zoneColor,
                    outlineWidth: 3,
                    classificationType: Cesium.ClassificationType.BOTH,
                    perPositionHeight: true,
                    heightReference: Cesium.HeightReference.NONE
                }
            });

            // 在中心添加标签，展示面积；等级由后续传感器计算动态更新
            const labelEntity = viewer.entities.add({
                id: `marker_${id}_label`,
                position: center,
                label: {
                    text: `⚠️ ${name}\n${(area / 1_000_000).toFixed(2)} km²\n待传感器评估`,
                    font: 'bold 16px sans-serif',
                    fillColor: zoneColor,
                    outlineColor: Cesium.Color.WHITE,
                    outlineWidth: 3,
                    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                    disableDepthTestDistance: Number.POSITIVE_INFINITY,
                    showBackground: true,
                    backgroundColor: Cesium.Color.fromCssColorString('rgba(0,0,0,0.7)'),
                    verticalOrigin: Cesium.VerticalOrigin.CENTER
                }
            });

            const cartographic = Cesium.Cartographic.fromCartesian(center);

            // 记录多边形顶点经纬度用于区域统计（多区域预警）
            const verticesLonLat = points.map((p) => {
                const c = Cesium.Cartographic.fromCartesian(p);
                return {
                    lon: Cesium.Math.toDegrees(c.longitude),
                    lat: Cesium.Math.toDegrees(c.latitude)
                };
            });

            markers.push({
                id,
                type: 'dangerZone',
                name: name || defaultName,
                level, // '1' | '2' | '3'
                lon: Cesium.Math.toDegrees(cartographic.longitude).toFixed(6),
                lat: Cesium.Math.toDegrees(cartographic.latitude).toFixed(6),
                height: cartographic.height.toFixed(1),
                entity,
                labelEntity,
                vertices: points.length,
                verticesLonLat,
                area: Math.round(area), // 平方米
                timestamp: new Date().toLocaleString()
            });

            if (statusCallback) statusCallback(`✅ 已创建危险区域【${name || defaultName}】，风险等级 L${level}`);
            cancelMarking();
        }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
    };
    
    /**
     * 删除指定标注
     */
    const removeMarker = (id) => {
        if (!viewerInstance) return;
        
        const index = markers.findIndex(m => m.id === id);
        if (index === -1) return;
        
        const marker = markers[index];
        
        // 删除实体
        if (marker.entity) {
            viewerInstance.entities.remove(marker.entity);
        }
        if (marker.labelEntity) {
            viewerInstance.entities.remove(marker.labelEntity);
        }
        
        // 从列表移除
        markers.splice(index, 1);
    };
    
    /**
     * 飞行到指定标注
     */
    const flyToMarker = (id) => {
        if (!viewerInstance) return;
        
        const marker = markers.find(m => m.id === id);
        if (!marker || !marker.entity) return;
        
        viewerInstance.flyTo(marker.entity, {
            duration: 1.5,
            offset: new Cesium.HeadingPitchRange(0, -0.5, 500)
        });
    };
    
    /**
     * 清除所有标注
     */
    const clearAllMarkers = () => {
        if (!viewerInstance) return;
        
        markers.forEach(marker => {
            if (marker.entity) viewerInstance.entities.remove(marker.entity);
            if (marker.labelEntity) viewerInstance.entities.remove(marker.labelEntity);
        });
        
        markers.length = 0;
        cancelMarking();
    };
    
    /**
     * 取消当前标注操作
     */
    const cancelMarking = () => {
        if (handler) {
            handler.destroy();
            handler = null;
        }
        if (viewerInstance) {
            viewerInstance.scene.canvas.style.cursor = "default";
        }
        isMarking.value = false;
        markerMode.value = '';
    };
    
    /**
     * 导出标注数据为JSON
     */
    const exportMarkers = () => {
        const exportData = markers.map(m => ({
            id: m.id,
            type: m.type,
            name: m.name,
            lon: m.lon,
            lat: m.lat,
            height: m.height,
            timestamp: m.timestamp
        }));
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `markers_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };
    
    // ===== 辅助函数 =====
    const calculateCenter = (positions) => {
        let x = 0, y = 0, z = 0;
        positions.forEach(p => { x += p.x; y += p.y; z += p.z; });
        const n = positions.length;
        return new Cesium.Cartesian3(x / n, y / n, z / n);
    };
    
    return {
        isMarking,
        markerMode,
        markers,
        MARKER_TYPES,
        addMarker,
        addDangerZone,
        removeMarker,
        flyToMarker,
        clearAllMarkers,
        cancelMarking,
        exportMarkers
    };
}
