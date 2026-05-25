import * as Cesium from 'cesium';

class TiandituTerrainProvider {
    constructor(options = {}) {
        this._urls = options.urls || [];
        this._errorEvent = new Cesium.Event();
        this._ready = true;
        this._readyPromise = Promise.resolve(true);
        this._tilingScheme = new Cesium.GeographicTilingScheme({
            numberOfLevelZeroTilesX: 2, numberOfLevelZeroTilesY: 1
        });
        this._levelZeroMaximumGeometricError = Cesium.TerrainProvider.getEstimatedLevelZeroGeometricErrorForAHeightmap(
            this._tilingScheme.ellipsoid, 65, this._tilingScheme.getNumberOfXTilesAtLevel(0)
        );
    }

    get errorEvent() { return this._errorEvent; }
    get credit() { return undefined; }
    get tilingScheme() { return this._tilingScheme; }
    get ready() { return this._ready; }
    get readyPromise() { return this._readyPromise; }
    get hasWaterMask() { return false; }
    get hasVertexNormals() { return false; }

    getLevelMaximumGeometricError(level) { return this._levelZeroMaximumGeometricError / (1 << level); }

    requestTileGeometry(x, y, level) {
        const serverIdx = (x + y) % this._urls.length;
        const url = this._urls[serverIdx].replace('{x}', x).replace('{y}', y).replace('{z}', level);

        return Cesium.Resource.fetchArrayBuffer({ url: url }).then((arrayBuffer) => {
            let heightBuffer = new Uint16Array(arrayBuffer, 0, arrayBuffer.byteLength / 2);
            let buffer = new Int16Array(heightBuffer.length);
            for (let i = 0; i < heightBuffer.length; i++) {
                buffer[i] = (heightBuffer[i] / 10000);
            }
            return new Cesium.HeightmapTerrainData({
                buffer: buffer, width: 65, height: 65,
                childTileMask: new Uint8Array(arrayBuffer, arrayBuffer.byteLength - 1, 1)[0] || 15,
                structure: { heightScale: 1.0, heightOffset: 0, elementsPerHeight: 1, stride: 1, elementMultiplier: 256.0, isBigEndian: false }
            });
        }).catch(() => {
            return new Cesium.HeightmapTerrainData({ buffer: new Uint8Array(65 * 65), width: 65, height: 65 });
        });
    }

    getTileDataAvailable(x, y, level) {
        // 返回 undefined 表示不确定是否有数据，Cesium 会尝试加载
        return undefined;
    }

    loadTileDataAvailability(x, y, level) {
        return undefined;
    }

    getAvailability() { return undefined; }
}
export default TiandituTerrainProvider;