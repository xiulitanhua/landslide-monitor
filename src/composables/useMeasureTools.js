/**
 * 🔥 测量工具 - 距离/面积/高差测量
 */

import * as Cesium from 'cesium';
import { ref } from 'vue';
import { computeAreaAndCenter } from '@/utils/geometry.js';

export function useMeasureTools(viewerInstance) {
    const isMeasuring = ref(false);
    const measureMode = ref(''); // 'distance' | 'area' | 'height'
    const measureResult = ref(null);
    
    let handler = null;
    let tempEntities = []; // 临时实体（测量过程中的点和线）
    let measureEntities = []; // 测量结果实体
    
    /**
     * 📏 距离测量 - 支持多点折线测量
     */
    const measureDistance = (statusCallback) => {
        if (!viewerInstance) return;
        
        clearMeasure();
        const viewer = viewerInstance;
        const points = [];
        let totalDistance = 0;
        let tempLine = null;
        
        isMeasuring.value = true;
        measureMode.value = 'distance';
        viewer.scene.canvas.style.cursor = "crosshair";
        if (statusCallback) statusCallback("📏 左键点击添加测量点，右键结束测量");
        
        handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        
        // 左键点击添加点
        handler.setInputAction((click) => {
            const cartesian = viewer.scene.pickPosition(click.position);
            if (!Cesium.defined(cartesian)) return;
            
            points.push(cartesian);
            
            // 添加点标记
            const pointEntity = viewer.entities.add({
                position: cartesian,
                point: {
                    pixelSize: 10,
                    color: Cesium.Color.YELLOW,
                    outlineColor: Cesium.Color.WHITE,
                    outlineWidth: 2,
                    disableDepthTestDistance: Number.POSITIVE_INFINITY
                }
            });
            tempEntities.push(pointEntity);
            
            // 计算与上一点的距离
            if (points.length > 1) {
                const lastPoint = points[points.length - 2];
                const { straightDistance: segmentDist } = computeGeodesicAnd3D(lastPoint, cartesian);
                totalDistance += segmentDist;
                
                // 添加线段
                const lineEntity = viewer.entities.add({
                    polyline: {
                        positions: [lastPoint, cartesian],
                        width: 3,
                        material: new Cesium.PolylineGlowMaterialProperty({
                            glowPower: 0.2,
                            color: Cesium.Color.YELLOW
                        }),
                        clampToGround: false,
                        depthFailMaterial: Cesium.Color.YELLOW.withAlpha(0.5)
                    }
                });
                tempEntities.push(lineEntity);
                
                // 添加距离标签
                const midPoint = Cesium.Cartesian3.midpoint(lastPoint, cartesian, new Cesium.Cartesian3());
                const labelEntity = viewer.entities.add({
                    position: midPoint,
                    label: {
                        text: formatDistance(segmentDist),
                        font: '14px sans-serif',
                        fillColor: Cesium.Color.WHITE,
                        outlineColor: Cesium.Color.BLACK,
                        outlineWidth: 2,
                        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                        pixelOffset: new Cesium.Cartesian2(0, -10),
                        disableDepthTestDistance: Number.POSITIVE_INFINITY
                    }
                });
                tempEntities.push(labelEntity);
            }
            
            if (statusCallback) {
                statusCallback(`📏 已测量 ${points.length} 个点，总距离: ${formatDistance(totalDistance)}`);
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
        
        // 鼠标移动显示临时线
        handler.setInputAction((movement) => {
            if (points.length === 0) return;
            
            const cartesian = viewer.scene.pickPosition(movement.endPosition);
            if (!Cesium.defined(cartesian)) return;
            
            // 更新临时线
            if (tempLine) {
                viewer.entities.remove(tempLine);
            }
            tempLine = viewer.entities.add({
                polyline: {
                    positions: [points[points.length - 1], cartesian],
                    width: 2,
                    material: Cesium.Color.YELLOW.withAlpha(0.5)
                }
            });
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
        
        // 右键结束测量
        handler.setInputAction(() => {
            if (tempLine) viewer.entities.remove(tempLine);
            
            if (points.length >= 2) {
                measureResult.value = {
                    type: 'distance',
                    value: totalDistance,
                    text: formatDistance(totalDistance),
                    points: points.length
                };
                
                // 添加总距离标签
                const lastPoint = points[points.length - 1];
                const resultLabel = viewer.entities.add({
                    position: lastPoint,
                    label: {
                        text: `总计: ${formatDistance(totalDistance)}`,
                        font: 'bold 16px sans-serif',
                        fillColor: Cesium.Color.CYAN,
                        outlineColor: Cesium.Color.BLACK,
                        outlineWidth: 2,
                        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                        verticalOrigin: Cesium.VerticalOrigin.TOP,
                        pixelOffset: new Cesium.Cartesian2(0, 10),
                        disableDepthTestDistance: Number.POSITIVE_INFINITY
                    }
                });
                measureEntities.push(resultLabel);
                
                if (statusCallback) statusCallback(`✅ 测量完成，总距离: ${formatDistance(totalDistance)}`);
            }
            
            finishMeasure();
        }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
    };
    
    /**
     * 📐 面积测量 - 多边形面积
     */
    const measureArea = (statusCallback) => {
        if (!viewerInstance) return;
        
        clearMeasure();
        const viewer = viewerInstance;
        const points = [];
        let tempPolygon = null;
        
        isMeasuring.value = true;
        measureMode.value = 'area';
        viewer.scene.canvas.style.cursor = "crosshair";
        if (statusCallback) statusCallback("📐 左键点击添加顶点，右键闭合并计算面积");
        
        handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        
        // 左键点击添加点
        handler.setInputAction((click) => {
            const cartesian = viewer.scene.pickPosition(click.position);
            if (!Cesium.defined(cartesian)) return;
            
            points.push(cartesian);
            
            // 添加点标记
            const pointEntity = viewer.entities.add({
                position: cartesian,
                point: {
                    pixelSize: 10,
                    color: Cesium.Color.LIME,
                    outlineColor: Cesium.Color.WHITE,
                    outlineWidth: 2,
                    disableDepthTestDistance: Number.POSITIVE_INFINITY
                },
                label: {
                    text: String(points.length),
                    font: '12px sans-serif',
                    fillColor: Cesium.Color.WHITE,
                    pixelOffset: new Cesium.Cartesian2(10, -10),
                    disableDepthTestDistance: Number.POSITIVE_INFINITY
                }
            });
            tempEntities.push(pointEntity);
            
            if (statusCallback) statusCallback(`📐 已添加 ${points.length} 个顶点`);
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
        
        // 鼠标移动显示临时多边形
        handler.setInputAction((movement) => {
            if (points.length < 2) return;
            
            const cartesian = viewer.scene.pickPosition(movement.endPosition);
            if (!Cesium.defined(cartesian)) return;
            
            // 更新临时多边形
            if (tempPolygon) {
                viewer.entities.remove(tempPolygon);
            }
            
            const positions = [...points, cartesian];
            tempPolygon = viewer.entities.add({
                polygon: {
                    hierarchy: new Cesium.PolygonHierarchy(positions),
                    material: Cesium.Color.LIME.withAlpha(0.3),
                    outline: true,
                    outlineColor: Cesium.Color.LIME,
                    outlineWidth: 2
                }
            });
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
        
        // 右键结束测量
        handler.setInputAction(() => {
            if (tempPolygon) viewer.entities.remove(tempPolygon);
            
            if (points.length >= 3) {
                // 计算面积
                const { area, center } = computeAreaAndCenter(points);

                // 添加最终多边形
                const polygonEntity = viewer.entities.add({
                    polygon: {
                        hierarchy: new Cesium.PolygonHierarchy(points),
                        material: Cesium.Color.LIME.withAlpha(0.4),
                        outline: true,
                        outlineColor: Cesium.Color.LIME,
                        outlineWidth: 3
                    }
                });
                measureEntities.push(polygonEntity);
                
                // 在中心添加面积标签
                const labelEntity = viewer.entities.add({
                    position: center,
                    label: {
                        text: `面积: ${formatArea(area)}`,
                        font: 'bold 16px sans-serif',
                        fillColor: Cesium.Color.WHITE,
                        outlineColor: Cesium.Color.BLACK,
                        outlineWidth: 2,
                        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                        disableDepthTestDistance: Number.POSITIVE_INFINITY
                    }
                });
                measureEntities.push(labelEntity);
                
                measureResult.value = {
                    type: 'area',
                    value: area,
                    text: formatArea(area),
                    points: points.length
                };
                
                if (statusCallback) statusCallback(`✅ 测量完成，面积: ${formatArea(area)}`);
            }
            
            finishMeasure();
        }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
    };
    
    /**
     * 📊 高差测量 - 两点垂直高度差
     */
    const measureHeight = (statusCallback) => {
        if (!viewerInstance) return;
        
        clearMeasure();
        const viewer = viewerInstance;
        const points = [];
        
        isMeasuring.value = true;
        measureMode.value = 'height';
        viewer.scene.canvas.style.cursor = "crosshair";
        if (statusCallback) statusCallback("📊 请点击第一个测量点");
        
        handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        
        handler.setInputAction((click) => {
            const cartesian = viewer.scene.pickPosition(click.position);
            if (!Cesium.defined(cartesian)) return;
            
            points.push(cartesian);
            const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
            const height = cartographic.height;
            
            // 添加点标记
            const label = points.length === 1 ? `点1: ${height.toFixed(1)}m` : `点2: ${height.toFixed(1)}m`;
            const color = points.length === 1 ? Cesium.Color.CYAN : Cesium.Color.ORANGE;
            
            const pointEntity = viewer.entities.add({
                position: cartesian,
                point: {
                    pixelSize: 12,
                    color: color,
                    outlineColor: Cesium.Color.WHITE,
                    outlineWidth: 2,
                    disableDepthTestDistance: Number.POSITIVE_INFINITY
                },
                label: {
                    text: label,
                    font: '14px sans-serif',
                    fillColor: Cesium.Color.WHITE,
                    outlineColor: Cesium.Color.BLACK,
                    outlineWidth: 2,
                    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                    pixelOffset: new Cesium.Cartesian2(0, -15),
                    disableDepthTestDistance: Number.POSITIVE_INFINITY
                }
            });
            tempEntities.push(pointEntity);
            
            if (points.length === 1) {
                if (statusCallback) statusCallback("📊 请点击第二个测量点");
            }
            
            if (points.length === 2) {
                // 计算高差
                const cart1 = Cesium.Cartographic.fromCartesian(points[0]);
                const cart2 = Cesium.Cartographic.fromCartesian(points[1]);
                const { surfaceDistance: horizontalDist, heightDiff, straightDistance } = computeGeodesicAnd3D(points[0], points[1]);
                const slope = Math.atan(Math.abs(heightDiff) / horizontalDist) * 180 / Math.PI;
                
                // 画垂直线和水平线
                const p1 = points[0];
                const p2 = points[1];
                const minH = Math.min(cart1.height, cart2.height);
                const p1Low = Cesium.Cartesian3.fromRadians(cart1.longitude, cart1.latitude, minH);
                const p2Low = Cesium.Cartesian3.fromRadians(cart2.longitude, cart2.latitude, minH);
                
                // 连接线
                const lineEntity = viewer.entities.add({
                    polyline: {
                        positions: [p1, p2],
                        width: 3,
                        material: new Cesium.PolylineDashMaterialProperty({
                            color: Cesium.Color.WHITE
                        }),
                        depthFailMaterial: Cesium.Color.WHITE.withAlpha(0.5)
                    }
                });
                measureEntities.push(lineEntity);
                
                // 高差标签
                const midPoint = Cesium.Cartesian3.midpoint(p1, p2, new Cesium.Cartesian3());
                const resultLabel = viewer.entities.add({
                    position: midPoint,
                    label: {
                        text: `高差: ${heightDiff >= 0 ? '+' : ''}${heightDiff.toFixed(2)}m\n水平距: ${horizontalDist.toFixed(1)}m\n直线距: ${straightDistance.toFixed(2)}m\n坡度: ${slope.toFixed(1)}°`,
                        font: 'bold 14px sans-serif',
                        fillColor: Cesium.Color.CYAN,
                        outlineColor: Cesium.Color.BLACK,
                        outlineWidth: 2,
                        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                        verticalOrigin: Cesium.VerticalOrigin.CENTER,
                        disableDepthTestDistance: Number.POSITIVE_INFINITY
                    }
                });
                measureEntities.push(resultLabel);
                
                measureResult.value = {
                    type: 'height',
                    value: heightDiff,
                    text: `${heightDiff >= 0 ? '+' : ''}${heightDiff.toFixed(2)}m`,
                    slope: slope,
                    horizontalDistance: horizontalDist,
                    straightDistance
                };
                
                if (statusCallback) statusCallback(`✅ 高差: ${heightDiff >= 0 ? '+' : ''}${heightDiff.toFixed(2)}m，坡度: ${slope.toFixed(1)}°`);
                finishMeasure();
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    };
    
    /**
     * 结束测量
     */
    const finishMeasure = () => {
        if (handler) {
            handler.destroy();
            handler = null;
        }
        if (viewerInstance) {
            viewerInstance.scene.canvas.style.cursor = "default";
        }
        isMeasuring.value = false;
        
        // 将临时实体转为测量实体
        measureEntities.push(...tempEntities);
        tempEntities = [];
    };
    
    /**
     * 清除测量结果
     */
    const clearMeasure = () => {
        if (handler) {
            handler.destroy();
            handler = null;
        }
        
        if (viewerInstance) {
            // 清除临时实体
            tempEntities.forEach(e => viewerInstance.entities.remove(e));
            tempEntities = [];
            
            // 清除测量结果实体
            measureEntities.forEach(e => viewerInstance.entities.remove(e));
            measureEntities = [];
            
            viewerInstance.scene.canvas.style.cursor = "default";
        }
        
        isMeasuring.value = false;
        measureMode.value = '';
        measureResult.value = null;
    };
    
    // ===== 辅助函数 =====
    
    /**
     * 格式化距离显示
     */
    const formatDistance = (meters) => {
        if (meters >= 1000) {
            return (meters / 1000).toFixed(2) + ' km';
        }
        return meters.toFixed(2) + ' m';
    };
    
    /**
     * 格式化面积显示
     */
    const formatArea = (sqMeters) => {
        if (sqMeters >= 1000000) {
            return (sqMeters / 1000000).toFixed(3) + ' km²';
        } else if (sqMeters >= 10000) {
            return (sqMeters / 10000).toFixed(2) + ' 公顷';
        }
        return sqMeters.toFixed(1) + ' m²';
    };
    
    /**
     * 使用椭球大地线 + 高差 计算更精确的距离
     * 返回：
     *  - surfaceDistance: 椭球面上的水平距离（m）
     *  - heightDiff: 高差（m）
     *  - straightDistance: 三维直线距离（m）
     */
    const computeGeodesicAnd3D = (p1, p2) => {
        const c1 = Cesium.Cartographic.fromCartesian(p1);
        const c2 = Cesium.Cartographic.fromCartesian(p2);

        // 椭球面两点（忽略高度）
        const geo = new Cesium.EllipsoidGeodesic(
            new Cesium.Cartographic(c1.longitude, c1.latitude, 0),
            new Cesium.Cartographic(c2.longitude, c2.latitude, 0)
        );

        const surfaceDistance = geo.surfaceDistance; // 椭球水平距离
        const heightDiff = c2.height - c1.height;
        const straightDistance = Math.sqrt(surfaceDistance * surfaceDistance + heightDiff * heightDiff);

        return { surfaceDistance, heightDiff, straightDistance };
    };
    
    return {
        isMeasuring,
        measureMode,
        measureResult,
        measureDistance,
        measureArea,
        measureHeight,
        clearMeasure
    };
}
