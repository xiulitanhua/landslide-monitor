import * as Cesium from 'cesium';
import { ref } from 'vue';

export function useAnalysisTools(viewerInstance) {
    const isMeasuring = ref(false);
    const profilePoints = ref([]); // 🔥 存储剖面采样点坐标，用于联动
    let highlightEntity = null;    // 🔥 高亮点实体
    
    // 坡度预警 - 使用 Batch Table 中的 NormalZ 属性
    const toggleSlopeAnalysis = (tileset, enable) => {
        if (!tileset) return;
        if (enable) {
            // CesiumLab 导出的法线存储在 Batch Table 的 NormalX/Y/Z 中
            // NormalZ 接近 1 表示平地，接近 0 表示陡坡
            tileset.style = new Cesium.Cesium3DTileStyle({
                color: {
                    conditions: [
                        ['${NormalZ} < 0.6', "color('red')"],      // 陡坡 >53°
                        ['${NormalZ} < 0.8', "color('orange')"],   // 中坡 36-53°
                        ['true', "color('white')"]                  // 缓坡 <36°
                    ]
                }
            });
        } else {
            tileset.style = undefined;
        }
    };

    // 🔥 剖面分析 - 专业版
    const measureProfile = async (callback, statusCallback) => {
        if (!viewerInstance) return;
        const viewer = viewerInstance;
        const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        const points = [];
        
        isMeasuring.value = true;
        viewer.scene.canvas.style.cursor = "crosshair";
        if (statusCallback) statusCallback("🎯 请点击模型上的【起点】");

        handler.setInputAction(async (click) => {
            let cartesian = viewer.scene.pickPosition(click.position);
            if (Cesium.defined(cartesian)) {
                points.push(cartesian);
                
                // 添加标记点
                const pointColor = points.length === 1 ? Cesium.Color.LIME : Cesium.Color.RED;
                const label = points.length === 1 ? "起点" : "终点";
                viewer.entities.add({ 
                    position: cartesian, 
                    point: { pixelSize: 12, color: pointColor, outlineColor: Cesium.Color.WHITE, outlineWidth: 2 },
                    label: { text: label, font: '14px sans-serif', fillColor: Cesium.Color.WHITE, 
                             style: Cesium.LabelStyle.FILL_AND_OUTLINE, outlineWidth: 2,
                             verticalOrigin: Cesium.VerticalOrigin.BOTTOM, pixelOffset: new Cesium.Cartesian2(0, -15) }
                });

                if (points.length === 1) {
                    if (statusCallback) statusCallback("🎯 请点击模型上的【终点】");
                }

                if (points.length === 2) {
                    // 画剖面线
                    viewer.entities.add({
                        polyline: { 
                            positions: points, 
                            width: 4, 
                            material: new Cesium.PolylineGlowMaterialProperty({
                                glowPower: 0.3,
                                color: Cesium.Color.YELLOW
                            }),
                            clampToGround: false
                        }
                    });

                    if (statusCallback) statusCallback("⏳ 正在采样高程数据...");
                    
                    // 计算插值并采样
                    const result = await calculateProfileData(points[0], points[1], viewer);
                    callback(result.chartData);
                    profilePoints.value = result.positions; // 存储用于联动
                    
                    // 🔥 创建高亮点实体（初始隐藏）- 更醒目的样式
                    highlightEntity = viewer.entities.add({
                        position: points[0],
                        point: { 
                            pixelSize: 20, 
                            color: Cesium.Color.CYAN, 
                            outlineColor: Cesium.Color.WHITE, 
                            outlineWidth: 4,
                            disableDepthTestDistance: Number.POSITIVE_INFINITY, // 始终显示在最前面
                            heightReference: Cesium.HeightReference.NONE
                        },
                        label: {
                            text: '●',
                            font: '24px sans-serif',
                            fillColor: Cesium.Color.CYAN,
                            style: Cesium.LabelStyle.FILL,
                            verticalOrigin: Cesium.VerticalOrigin.CENTER,
                            horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
                            disableDepthTestDistance: Number.POSITIVE_INFINITY
                        },
                        show: false
                    });
                    
                    console.log("✅ 高亮实体已创建, profilePoints:", profilePoints.value.length);

                    handler.destroy();
                    viewer.scene.canvas.style.cursor = "default";
                    isMeasuring.value = false;
                    if (statusCallback) statusCallback(`✅ 剖面分析完成，共 ${result.chartData.length} 个采样点`);
                }
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    };

    // 🔥 专业版高程采样：每2米一个点
    const calculateProfileData = async (start, end, viewer) => {
        // 1. 计算总距离
        const totalDistance = Cesium.Cartesian3.distance(start, end);
        console.log("📏 剖面总长度:", totalDistance.toFixed(2), "米");
        
        // 2. 计算采样点数（每2米一个点，最少50个，最多500个）
        const step = 2.0;
        let count = Math.floor(totalDistance / step);
        count = Math.max(50, Math.min(count, 500));
        console.log("📊 采样点数:", count);
        
        // 3. 生成插值点
        const positions = [];
        const cartesianPositions = []; // 存储笛卡尔坐标用于联动
        for (let i = 0; i <= count; i++) {
            const factor = i / count;
            const p = Cesium.Cartesian3.lerp(start, end, factor, new Cesium.Cartesian3());
            cartesianPositions.push(p.clone());
            positions.push(Cesium.Cartographic.fromCartesian(p));
        }
        
        // 4. 异步采样高度（关键！使用 sampleHeightMostDetailed 获取 3D Tiles 表面高度）
        let updatedPositions;
        try {
            updatedPositions = await viewer.scene.sampleHeightMostDetailed(positions);
        } catch (e) {
            console.warn("⚠️ sampleHeightMostDetailed 失败，使用原始高度:", e);
            updatedPositions = positions;
        }
        
        // 5. 构建图表数据
        const chartData = [];
        const validPositions = [];
        
        for (let i = 0; i <= count; i++) {
            const currentDist = (i / count) * totalDistance;
            const height = updatedPositions[i].height;
            
            // 过滤无效高度
            if (height !== undefined && !isNaN(height) && height > -1000) {
                chartData.push([currentDist.toFixed(1), height.toFixed(1)]);
                validPositions.push(Cesium.Cartesian3.fromRadians(
                    updatedPositions[i].longitude, 
                    updatedPositions[i].latitude, 
                    height
                ));
            }
        }
        
        console.log("✅ 有效采样点:", chartData.length);
        return { chartData, positions: validPositions };
    };

    // 🔥 图表联动：根据索引高亮地图上的点
    const highlightPointOnMap = (index) => {
        if (!highlightEntity || !profilePoints.value || profilePoints.value.length === 0) {
            console.log("⚠️ 联动失败: entity=", !!highlightEntity, "points=", profilePoints.value?.length);
            return;
        }
        
        if (index >= 0 && index < profilePoints.value.length) {
            const pos = profilePoints.value[index];
            highlightEntity.position = new Cesium.ConstantPositionProperty(pos);
            highlightEntity.show = true;
            console.log("🎯 高亮点:", index, "位置:", pos);
        } else {
            highlightEntity.show = false;
        }
    };

    const clearAnalysis = (tileset) => {
        if(viewerInstance) viewerInstance.entities.removeAll();
        if(tileset) tileset.style = undefined;
        isMeasuring.value = false;
        profilePoints.value = [];
        highlightEntity = null;
    };

    return { 
        isMeasuring, 
        profilePoints,
        toggleSlopeAnalysis, 
        measureProfile, 
        highlightPointOnMap,
        clearAnalysis 
    };
}