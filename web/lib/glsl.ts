/**
 * Shared GLSL (WebGL 2 / GLSL ES 3.0 via THREE.ShaderMaterial; also valid GLSL ES 1.0).
 *
 * 3D simplex noise: Ian McEwan & Stefan Gustavson, Ashima Arts, "webgl-noise" (MIT licence).
 */
export const NOISE_GLSL = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
          + i.y + vec4(0.0, i1.y, i2.y, 1.0))
          + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

float fbm(vec3 p) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 5; i++) {
    sum += amp * snoise(p);
    p = p * 2.03 + vec3(1.7, 9.2, 3.1);
    amp *= 0.5;
  }
  return sum;
}

float fbm3(vec3 p) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 3; i++) {
    sum += amp * snoise(p);
    p = p * 2.07 + vec3(5.3, 1.1, 7.7);
    amp *= 0.5;
  }
  return sum;
}
`;

/** Scene layout (scene units). Earth radius = 1 R_E. */
export const SCENE = {
  sunPosition: [-30, 0, 0] as [number, number, number],
  sunRadius: 5,
  earthRadius: 1.5,
  /** Particles spawn at the solar surface and leave the frame past Earth. */
  windStartX: -25,
  windEndX: 16,
  /** Earth obliquity used for the tilted Earth frame (rad). */
  tilt: (23.44 * Math.PI) / 180,
} as const;

/**
 * Compress a physical magnetopause stand-off (R_E) into scene units so the cavity stays on screen:
 * 10 R_E -> ~5.8 units, 6 R_E -> ~3.9 units, 4 R_E -> ~2.9 units.
 */
export function standoffToScene(r0Re: number): number {
  return SCENE.earthRadius * (1 + 0.32 * (Math.max(1.5, r0Re) - 1));
}

/** Geostationary orbit radius in Earth radii. */
export const GEO_RE = 6.6;

/**
 * Shue et al. (1998) flaring factor r(theta) / r0 = (2 / (1 + cos theta))^0.6, with cos theta
 * clamped at -0.6 so the tail stays finite. Mirrored in the SolarWindParticles vertex shader.
 */
export function shueFlare(cosTheta: number): number {
  return Math.pow(2 / (1 + Math.max(cosTheta, -0.6)), 0.6);
}

/**
 * Scene-space magnetopause radius in the direction with angle cos(theta) from the Sun line. The
 * physical distance r0 * flare is mapped through `standoffToScene`, so the shell, the particle
 * deflection and the geostationary ring (standoffToScene(GEO_RE)) share one radial scale.
 */
export function magnetopauseSceneRadius(r0Re: number, cosTheta: number): number {
  return standoffToScene(r0Re * shueFlare(cosTheta));
}

/** GLSL twin of `magnetopauseSceneRadius` (needs uniform uEarthR = SCENE.earthRadius). */
export const MAGNETOPAUSE_GLSL = /* glsl */ `
float magnetopauseRadius(float r0Re, float cosT, float earthR) {
  float rRe = r0Re * pow(2.0 / (1.0 + max(cosT, -0.6)), 0.6);
  return earthR * (1.0 + 0.32 * (max(1.5, rRe) - 1.0));
}
`;
