// src/core/crtFilter.js
// Arcade/CRT post-process (prototype). One full-screen pass: chromatic aberration,
// glow, scanlines, grain, vignette, slight screen curvature + colour grade. Same
// shader as crt-filter-studio.html. Toggled live via window.__crt.enabled (read in
// onApply each frame), persisted in localStorage 'tk_crt'. Default ON.
import { PostProcess, Effect } from '@babylonjs/core';

// Values dialed in the studio (2026-06-18). Tune freely; one place.
// "Pure CRT texture": scanlines + faint glow/vignette/aberration, NO colour grade
// (brightness/contrast/saturation = 1) — earlier grade read as over-saturated.
export const CRT_PARAMS = {
  scanline: 0.27, density: 440, curvature: 0.04, vignette: 0.21, aberration: 0.001,
  glow: 0.24, grain: 0.04, brightness: 1.02, contrast: 1.15, saturation: 1.06,
};

// Global live state (so the Settings toggle flips it without recreating the pass).
// `enabled` persists across reloads; `params` always re-syncs from source so edits
// here take effect on reload/HMR.
if (typeof window !== 'undefined') {
  window.__crt = window.__crt || { enabled: localStorage.getItem('tk_crt') !== '0' };
  window.__crt.params = CRT_PARAMS;
}

Effect.ShadersStore['crtFragmentShader'] = `
precision highp float;
varying vec2 vUV;
uniform sampler2D textureSampler;
uniform vec2 resolution;
uniform float enabled, time, scanline, density, curvature, vignette, aberration, glow, grain, brightness, contrast, saturation;
float rand(vec2 c){ return fract(sin(dot(c, vec2(12.9898,78.233))) * 43758.5453); }
vec2 curve(vec2 u){ u = u*2.0-1.0; vec2 off = abs(u.yx) * curvature; u = u + u*off*off; return u*0.5+0.5; }
void main(){
  if (enabled < 0.5){ gl_FragColor = texture2D(textureSampler, vUV); return; }
  vec2 cuv = curve(vUV);
  if (cuv.x<0.0||cuv.x>1.0||cuv.y<0.0||cuv.y>1.0){ gl_FragColor = vec4(0.0,0.0,0.0,1.0); return; }
  vec3 col;
  col.r = texture2D(textureSampler, cuv + vec2(aberration, 0.0)).r;
  col.g = texture2D(textureSampler, cuv).g;
  col.b = texture2D(textureSampler, cuv - vec2(aberration, 0.0)).b;
  if (glow > 0.001){
    vec3 b = vec3(0.0); float ox = 1.6/resolution.x; float oy = 1.6/resolution.y;
    for (int x=-2;x<=2;x++){ for (int y=-2;y<=2;y++){
      vec3 s = texture2D(textureSampler, cuv + vec2(float(x)*ox, float(y)*oy)).rgb;
      b += max(s - 0.55, 0.0);
    }}
    col += (b/25.0) * glow * 3.0;
  }
  float sl = sin(cuv.y * density * 3.14159);
  col *= 1.0 - scanline * (0.5 + 0.5*sl) * 0.7;
  col += (rand(cuv + fract(time)) - 0.5) * grain;
  col *= brightness;
  col = (col - 0.5) * contrast + 0.5;
  float lum = dot(col, vec3(0.299,0.587,0.114));
  col = mix(vec3(lum), col, saturation);
  vec2 vu = vUV*(1.0-vUV.yx);
  float vig = pow(vu.x*vu.y*15.0, 0.3);
  col *= mix(1.0, clamp(vig,0.0,1.0), vignette);
  gl_FragColor = vec4(clamp(col,0.0,1.0), 1.0);
}`;

// Attach a CRT pass to a camera. Always created; the shader passes through raw when
// window.__crt.enabled is false, so the Settings toggle is instant + camera-agnostic.
export function attachCrt(camera) {
  const pp = new PostProcess('crt', 'crt',
    ['enabled', 'time', 'resolution', 'scanline', 'density', 'curvature', 'vignette',
     'aberration', 'glow', 'grain', 'brightness', 'contrast', 'saturation'],
    null, 1.0, camera);
  let t = 0;
  pp.onApply = (effect) => {
    const c = window.__crt || { enabled: true, params: CRT_PARAMS };
    const p = c.params || CRT_PARAMS;
    t += 0.016;
    effect.setFloat('enabled', c.enabled ? 1 : 0);
    effect.setFloat('time', t);
    effect.setFloat2('resolution', pp.width || camera.getEngine().getRenderWidth(),
                                   pp.height || camera.getEngine().getRenderHeight());
    effect.setFloat('scanline', p.scanline);   effect.setFloat('density', p.density);
    effect.setFloat('curvature', p.curvature); effect.setFloat('vignette', p.vignette);
    effect.setFloat('aberration', p.aberration); effect.setFloat('glow', p.glow);
    effect.setFloat('grain', p.grain);         effect.setFloat('brightness', p.brightness);
    effect.setFloat('contrast', p.contrast);   effect.setFloat('saturation', p.saturation);
  };
  return pp;
}
