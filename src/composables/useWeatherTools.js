import { ref } from 'vue';
import * as Cesium from 'cesium';

export function useWeatherTools(viewerRef) {
  const isRaining = ref(false);
  const rainIntensity = ref(0.5); // 雨量大小 (0-1)
  let rainStage = null;

  const fs_rain = `
    uniform sampler2D colorTexture;
    uniform float intensity; // 接收雨强
    in vec2 v_textureCoordinates;
    out vec4 fragColor;

    float hash(float x) {
        return fract(sin(x * 133.3) * 13.13);
    }

    void main(void) {
        float time = czm_frameNumber / 60.0;
        vec2 resolution = czm_viewport.zw;
        vec2 uv = (gl_FragCoord.xy * 2. - resolution.xy) / min(resolution.x, resolution.y);
        vec3 c = vec3(.6, .7, .8);
        float a = -.1;
        float si = sin(a), co = cos(a);
        uv *= mat2(co, -si, si, co);
        uv *= length(uv + vec2(0, 4.9)) * .3 + 1.;
        float v = 1. - sin(hash(floor(uv.x * 100.)) * 2.);
        
        // 使用 intensity 来控制雨滴的浓度与速度
        float speed = (20.0 + intensity * 20.0) * time * v + uv.y * (10.0 - intensity * 5.0) / (v + .5);
        float threshold = 0.98 - (intensity * 0.1); 
        float b = clamp(abs(sin(speed)) - threshold, 0., 1.) * (30.0 + intensity*20.0);
        c *= v * b;
        
        // 渲染图层与雨层混合，强度控制混合度
        fragColor = mix(texture(colorTexture, v_textureCoordinates), vec4(c, 1), 0.3 + intensity*0.3);
    }
  `;

  const toggleRain = () => {
    if (!viewerRef.value) return;
    isRaining.value = !isRaining.value;

    if (isRaining.value) {
      if (!rainStage || rainStage.isDestroyed()) {
        rainStage = new Cesium.PostProcessStage({
          name: 'czm_rain',
          fragmentShader: fs_rain,
          uniforms: {
            intensity: () => rainIntensity.value
          }
        });
      }
      viewerRef.value.scene.postProcessStages.add(rainStage);
      // 雨天修改光照和雾效，增加氛围感
      viewerRef.value.scene.skyAtmosphere.hueShift = -0.5;
      viewerRef.value.scene.skyAtmosphere.saturationShift = -0.7;
      viewerRef.value.scene.skyAtmosphere.brightnessShift = -0.3;
      viewerRef.value.scene.fog.density = 0.005;
      viewerRef.value.scene.fog.minimumBrightness = 0.8;
    } else {
      if (rainStage && viewerRef.value.scene.postProcessStages.contains(rainStage)) {
        viewerRef.value.scene.postProcessStages.remove(rainStage);
      }
      rainStage = null; // 必须置空，因为 remove() 会默认调用 destroy() 导致下次重用报错
      // 恢复晴天光效
      viewerRef.value.scene.skyAtmosphere.hueShift = 0.0;
      viewerRef.value.scene.skyAtmosphere.saturationShift = 0.0;
      viewerRef.value.scene.skyAtmosphere.brightnessShift = 0.0;
      viewerRef.value.scene.fog.density = 0.0002;
    }
  };

  const updateRainIntensity = (e) => {
    rainIntensity.value = parseFloat(e.target.value);
  };

  return { isRaining, rainIntensity, toggleRain, updateRainIntensity };
}
