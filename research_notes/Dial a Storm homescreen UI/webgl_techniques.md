# WebGL2 / react-three-fiber Technique Cookbook: Sun → Solar Wind → Magnetosphere → Earth/Aurora

Stack: Next.js 14, @react-three/fiber v8, three 0.170, drei v9, @react-three/postprocessing (one Bloom), hand-written GLSL in `THREE.ShaderMaterial`. WebGPU, TSL and node materials are not allowed. Target is 60 fps on an integrated GPU with DPR in [1, 1.5].

Note on sourcing: the cited findings come from pages fetched or searched during this research. The GLSL and TS sketches under "Inferences" are implementation proposals written for these notes, not code copied from a source. Treat them as starting points to test.

---

## 1. Magnetosphere and dipole field-line rendering

### Takeaway
Generate dipole lines on the CPU once (r = L·cos²λ). Bend them with a cheap analytic day/night warp. Draw them with drei `<Line>` (Line2, fixed pixel width) or with thin custom tubes and an additive "flow" shader. The magnetopause is a single BackSide or FrontSide fresnel shell, displaced into the Shue et al. (1997) shape r = r0·[2/(1+cosθ)]^α. Here r0 is the subsolar standoff and α the tail flaring, and both are driven by solar wind pressure and IMF Bz.

### Cited Findings
- Shue et al. (1997) fit the magnetopause with r = r0[2/(1+cosθ)]^α, using ISEE 1/2, AMPTE/IRM and IMP 8 crossings. r0 is the standoff distance and α the tail flaring level. Both depend on IMF Bz and solar wind dynamic pressure. — [Shue et al. 1997 JGR PDF](https://ulcar.uml.edu/eeas/Songetal/Shue_et_al-1997-Journal_of_Geophysical_Research-_Solid_Earth_(1978-2012).pdf); [NASA ISTP Shue poster](https://pwg.gsfc.nasa.gov/istp/cloud_jan97/shue_poster.html)
- SpacePy's implementation gives the coefficients (Bz in nT, Dp in nPa). r0 = (11.4 + 0.013·Bz)·Dp^(−1/6.6) for Bz ≥ 0, and (11.4 + 0.140·Bz)·Dp^(−1/6.6) for Bz < 0. α = (0.58 − 0.010·Bz)·(1 + 0.010·Dp). — [SpacePy empiricals source](https://pythonhosted.org/SpacePy/_modules/spacepy/empiricals.html). These were not cross-checked against the paper text in this research.
- The model is valid for about −18 < Bz < 15 nT and 0.5 < Dp < 8.5 nPa. The tail is open (r→∞ at θ=π) or closed depending on α. — [Shue et al. 1997](https://ulcar.uml.edu/eeas/Songetal/Shue_et_al-1997-Journal_of_Geophysical_Research-_Solid_Earth_(1978-2012).pdf) (summarized via search snippet)
- Under extreme conditions the magnetopause compresses a lot. Russell's group discusses magnetopause location in extreme storms. — [Russell, Magnetopause location under extreme conditions](https://faculty.epss.ucla.edu/~ctrussell/russell_bib.html/papers/mpause_extreme/index.html)
- drei `<Line>` renders a `THREE.Line2`, or a `LineSegments2` with `segments`. It takes `points` (Vector3 or tuples), `color`, `lineWidth` (in pixels), `dashed` and per-point `vertexColors`. All LineMaterial props pass through. — [drei Line docs](https://drei.docs.pmnd.rs/shapes/line)
- MeshLine-style lines animate a "traced" look through `dashArray`/`dashOffset`, with no geometry rebuild. The Codrops example decrements `material.uniforms.dashOffset.value -= 0.01` each frame. — [Codrops: Animated Mesh Lines (2019)](https://tympanus.net/codrops/2019/01/08/animated-mesh-lines/)
- For transparent or glowing MeshLines, the threejs-meshline docs recommend `depthTest:false` (or careful depthWrite), `transparent:true` and a suitable blending mode. — [threejs-meshline npm](https://npmjs.com/package/@amcdnl/threejs-meshline)

### Inferences (implementation sketch)
**Dipole line generation (CPU, once in `useMemo`):**
```ts
// Earth radius = 1 scene unit. L-shells e.g. [1.6, 2.2, 3, 4, 5.5, 7.5]. Longitudes every 30°.
function dipoleLine(L: number, phi: number, n = 96, compress = 0.35, stretch = 1.8) {
  const pts: THREE.Vector3[] = [];
  const latMax = Math.acos(Math.sqrt(1 / L));   // where r = 1 (the line hits the surface)
  for (let i = 0; i <= n; i++) {
    const lat = -latMax + (2 * latMax * i) / n;
    const r = L * Math.cos(lat) ** 2;
    let x = r * Math.cos(lat) * Math.cos(phi);
    const y = r * Math.sin(lat);                  // y = magnetic north
    let z = r * Math.cos(lat) * Math.sin(phi);
    // Cheap solar-wind distortion: sun is along +x.
    const day = Math.max(0, x / r);               // 0..1 on dayside
    const night = Math.max(0, -x / r);
    const k = 1 - compress * day * Math.min(1, (r - 1) / 6);   // squash the dayside
    x *= k; z *= k;
    x -= stretch * night * night * (r - 1);       // pull the nightside into a tail
    pts.push(new THREE.Vector3(x, y, z));
  }
  return pts;
}
```
- Drive `compress` and `stretch` from a uniform-like store value, such as the Shue r0. Regenerating about 40 lines × 96 pts on slider change is cheap. Do it in a debounced effect, not every frame. Alternatively, upload the undistorted points once and apply the warp in a custom vertex shader, so it costs nothing per frame.
- For a "stunning" tail, open the outer L-shells (L > 8) on the night side. Stop generating once x < −r_tail and let the alpha fade.

**Flow along lines, two options:**
1. drei `<Line dashed dashSize={0.15} gapSize={0.35} lineWidth={1.5} transparent opacity={0.6} toneMapped={false} />`, then animate `ref.current.material.dashOffset -= delta * speed` in `useFrame`. LineMaterial exposes `dashOffset`. Line2 dashes need line distances, which drei computes.
2. (Recommended for many lines.) Merge every line into one `BufferGeometry` of `LineSegments` or thin ribbons with an `aT` attribute (0..1 along the line) and an `aSeed` attribute, then use one `ShaderMaterial` with additive blending:
```glsl
// fragment
uniform float uTime; uniform vec3 uColor; uniform float uSpeed;
varying float vT; varying float vSeed;
void main(){
  float pulse = fract(vT * 6.0 - uTime * uSpeed + vSeed);
  float head  = smoothstep(0.0, 0.08, pulse) * (1.0 - smoothstep(0.08, 0.35, pulse));
  float base  = 0.18;                                 // faint always-visible line
  float edge  = smoothstep(0.0, 0.1, vT) * smoothstep(1.0, 0.9, vT); // fade at the feet
  gl_FragColor = vec4(uColor * (base + 2.2 * head), (base + head) * edge);
}
// material: transparent, depthWrite:false, blending: AdditiveBlending, toneMapped:false
```
Values above 1.0 in `head` are what bloom picks up (see section 4). This draws everything in one call.

**Magnetopause shell (Shue shape displaced in the vertex shader):**
```glsl
// vertex: start from a unit SphereGeometry(1, 96, 64); sun along +x
uniform float uR0; uniform float uAlpha;
varying vec3 vN; varying vec3 vView;
void main(){
  vec3 d = normalize(position);
  float cosT = d.x;                                    // angle from the Sun-Earth line
  float r = uR0 * pow(2.0 / (1.0 + max(cosT, -0.97)), uAlpha); // clamp avoids infinity at θ=π
  vec3 p = d * r;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vN = normalize(mat3(modelMatrix) * d);               // approximate normal is fine for a glow
  vView = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
// fragment
uniform vec3 uColor; uniform float uTime;
varying vec3 vN; varying vec3 vView;
void main(){
  float f = pow(1.0 - abs(dot(vN, vView)), 3.0);       // fresnel rim
  gl_FragColor = vec4(uColor, f * 0.35);
}
// transparent, depthWrite:false, side: DoubleSide, AdditiveBlending
```
- Scale: in Earth radii r0 is about 10 at quiet times and drops to about 6–7 in big storms. To keep things legible, compress visually (for example draw r0_scene = 2 + 0.35·r0) rather than staying literal.
- A thin bow-shock shell about 1.3× r0 in a second colour adds depth for one extra draw call.

### Gaps
- Line2 `dashOffset` animation was not verified against three 0.170's LineMaterial source in this research. The custom-shader approach avoids depending on it.
- No open-source r3f "dipole field lines" demo was found and verified.
- Tsyganenko-style realistic field models are out of scope. The warp above is an aesthetic approximation.

---

## 2. Solar wind particle streams

### Takeaway
Avoid per-particle CPU updates. Use a static `THREE.Points` (or InstancedMesh of streak quads) whose vertex shader computes position from `(seed, uTime)`. Each particle travels along +x→−x in a looping "conveyor" (`fract(seed + t*speed)`) and is pushed analytically around the magnetopause by the same Shue function. Speed and density come from uniforms. GPGPU (FBO ping-pong) is only worth it for true flow-field chaos.

### Cited Findings
- R3F docs: each mesh is a draw call, so repeated objects should use `InstancedMesh` (one draw call). Keep total draw calls to "a few hundred at most". — [R3F scaling performance](https://r3f.docs.pmnd.rs/advanced/scaling-performance)
- Codrops "Crafting a Dreamy Particle Effect with Three.js and GPGPU" (Dominik Fojcik, Dec 2024) stores particle positions and velocities in textures, computed on the GPU, and adds post-processing shine. — [Codrops GPGPU particles](https://tympanus.net/codrops/2024/12/19/crafting-a-dreamy-particle-effect-with-three-js-and-gpgpu/)
- Three.js Journey "GPGPU Flow Field Particles" renders into offscreen FBOs to evolve particles in a flow field. It is rated very hard and behind a paywall. — [Three.js Journey GPGPU lesson](https://threejs-journey.com/lessons/gpgpu-flow-field-particles-shaders)
- Bruno Imbrizi's Codrops "Interactive Particles" is a simpler large-particle-count example. — [nsarno/particles (GitHub ref from search)](https://github.com/nsarno/particles) (not verified in detail)

### Inferences (implementation sketch)
**Stateless vertex-shader wind (about 8–20k points, one draw call):**
```glsl
// attributes: aSeed (vec4 random), static. position attribute unused (can be zeros).
uniform float uTime, uSpeed, uR0, uAlpha, uSize, uPixelRatio;
uniform float uXStart, uXEnd;          // e.g. +40 (near the Sun) to -40 (past Earth)
varying float vAlpha; varying float vSpeedTint;
float shueR(float cosT){ return uR0 * pow(2.0/(1.0+max(cosT,-0.95)), uAlpha); }
void main(){
  float life = fract(aSeed.x + uTime * uSpeed * (0.7 + 0.6*aSeed.w));
  float x = mix(uXStart, uXEnd, life);
  vec2 yz = (aSeed.yz * 2.0 - 1.0) * 14.0;            // cross-section of the stream
  vec3 p = vec3(x, yz);
  // deflect: if inside the magnetopause, push the point radially out to the surface
  float r = length(p); vec3 d = p / r;
  float rm = shueR(d.x) * 1.05;
  float inside = 1.0 - smoothstep(rm, rm * 1.25, r);
  p = mix(p, d * max(r, rm), inside);                 // slides around the shell
  vAlpha = smoothstep(0.0,0.08,life) * (1.0 - smoothstep(0.85,1.0,life));
  vSpeedTint = aSeed.w;
  vec4 mv = modelViewMatrix * vec4(p,1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * uPixelRatio * (1.0 / -mv.z);
}
// fragment: soft round dot
void main(){
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d) * vAlpha;
  vec3 c = mix(vec3(1.0,0.75,0.45), vec3(1.0,0.95,0.85), vSpeedTint);
  gl_FragColor = vec4(c * 1.4, a);
}
```
- **Density mapping:** set `geometry.setDrawRange(0, Math.floor(maxCount * density))` from the store. It costs nothing and avoids reallocating buffers. Or fade alpha by `step(aSeed.x, uDensity)`.
- **Speed mapping:** `uSpeed`, plus tint (slow is amber, fast is white-blue).
- **Streaks without trails:** stretch along velocity. (a) Use InstancedMesh of a 1×0.02 plane, oriented in the vertex shader along −x (or along the deflection tangent) with length ∝ speed. (b) Cheaper: with Points, compute the previous position at `life - 0.01` and draw `LineSegments` with two vertices per particle (head and tail evaluated at two `life` values). That is one draw call and looks like motion blur.
- **Avoid drei `<Trail>` for thousands of particles.** Its CPU history is per object. Use it only for one hero CME blob, if at all.
- **CME event:** a second Points system with a spherical shell front, `uCmeProgress` 0→1 driving x. Brighter colours above 1.0 for bloom.

### Gaps
- No measured fps figures for N points on integrated GPUs were found. Profile with 10k and step up.
- The radial projection deflection is a visual approximation, not MHD.

---

## 3. Aurora and ring current

### Takeaway
The cheapest high-payoff aurora is a thin shell slightly above Earth (r ≈ 1.02–1.06). It is shaded with a latitude band (the oval) centred on the magnetic pole, wiggled by noise, and given an altitude gradient (green at the bottom to red/purple at the top) by stacking 2–3 nested shells or an extruded ribbon. The ring current is an additive fresnel torus. Raymarched Shadertoy auroras (nimitz "Auroras") are beautiful but are sky-dome shaders, too heavy at full screen on integrated GPUs.

### Cited Findings
- The canonical Shadertoy aurora is "Auroras" by nimitz (2017, @stormoid), shadertoy.com/view/XtGGRt. It is widely ported to Godot and Unity. — [Godot aurora port referencing XtGGRt](https://godotshaders.com/shader/aurora-sky-shader/); [makisho gist (Unity port)](https://gist.github.com/makisho/cfe20d80537384af26fa67bf76189576)
- Porters report it gets expensive at 1920×1080 with the default loop count (50). They suggest cutting it to about 25 iterations. — [Troikatronix Isadora thread](https://community.troikatronix.com/topic/7442/aurora-borealis-shader)
- A volumetric aurora variant with polar reflection exists as a Godot shader, another reference for the curtain look. — [godotshaders volumetric aurora](https://godotshaders.com/shader/volumetric-aurora-borealis-with-polar-reflection/)

### Inferences (implementation sketch)
**Aurora oval shell (one draw call per hemisphere-agnostic shell):**
```glsl
// SphereGeometry(1.035, 128, 64). Varyings: vPos (object-space unit dir), vN, vView.
uniform float uTime, uOvalLat, uWidth, uIntensity;   // uOvalLat ~ 67° quiet, ~55° storm (in radians)
uniform vec3 uMagPole;                                 // unit vector of magnetic N pole (tilted ~10°)
// include a 2D/3D simplex noise (Ashima / stegu webgl-noise, MIT)
void main(){
  vec3 d = normalize(vPos);
  float magLat = asin(clamp(abs(dot(d, uMagPole)), 0.0, 1.0)); // both hemispheres
  float lon = atan(d.z, d.x);
  float n = snoise(vec3(lon * 3.0, magLat * 8.0, uTime * 0.15));
  float n2 = snoise(vec3(lon * 11.0, uTime * 0.6, 0.0));       // fine curtain striations
  float center = uOvalLat + 0.03 * n;
  float band = exp(-pow((magLat - center) / uWidth, 2.0));
  band *= 0.6 + 0.4 * n2;
  float rim = pow(1.0 - abs(dot(vN, vView)), 1.5);            // curtains read best on the limb
  vec3 green = vec3(0.2, 1.0, 0.55), red = vec3(1.0, 0.25, 0.45);
  vec3 col = mix(green, red, smoothstep(0.0, 1.0, uStormLevel));
  gl_FragColor = vec4(col * band * uIntensity * (0.6 + 1.6 * rim), band);
}
// transparent, AdditiveBlending, depthWrite:false, toneMapped:false
```
- **Vertical green→red curtains:** add 2 more shells at r = 1.06 and 1.09 with the same band but `mix(green, red, layerIndex/2)` and decreasing alpha. Alternatively, build a ribbon: a ring of quads at the oval latitude extruded radially, with a `vUv.y` height gradient `mix(green, crimson, vUv.y) * (1.0 - vUv.y)` and a noise-offset bottom edge `step(noise, vUv.y)`. That gives a true "curtain from the side" look on the limb.
- **Storm dial mapping:** move `uOvalLat` equatorward (expansion), widen `uWidth`, raise `uIntensity`, and shift colour toward red/magenta at high Kp.
- **Ring current:** `TorusGeometry(3.5, 0.9, 32, 128)` in the magnetic equatorial plane, with a fresnel additive shader, low alpha (0.1–0.25) and scrolling noise along the tube angle. Use warm orange-pink to contrast with the cyan field lines. Brighten with Dst (more negative Dst means brighter).

### Gaps
- No verified r3f-specific aurora oval example was found. The shader above is original.
- The exact nimitz shader code was not fetched (Shadertoy was not retrieved). Check the license before porting; Shadertoy defaults to CC BY-NC-SA unless stated otherwise.

---

## 4. Earth and Sun without heavy textures; bloom tuning

### Takeaway
Earth: a dark sphere with a procedural or low-res land mask, a sun-direction terminator (`smoothstep` on dot(N, L)), and an additive BackSide atmosphere shell with a fresnel power of about 3–5, tinted toward orange at the twilight band. Sun: a small sphere with an fbm-noise surface plus a camera-facing corona billboard (radial falloff and noise rays). Bloom with `luminanceThreshold≈1` and `toneMapped={false}` on emissive materials, so that only HDR (>1) pixels glow.

### Cited Findings
- The bobbyroe/threejs-earth `getFresnelMat.js` is a ShaderMaterial. Uniforms are `fresnelBias=0.1`, `fresnelScale=1.0` and `fresnelPower=4.0`, with rim color `0x0088ff` and facing color black. The vertex shader computes `bias + scale·pow(1 + dot(I, N), power)`. The fragment shader mixes the colors by that factor and uses it as alpha, with `transparent:true` and `AdditiveBlending`. — [bobbyroe/threejs-earth getFresnelMat.js](https://github.com/bobbyroe/threejs-earth/blob/main/src/getFresnelMat.js) (summarized, not quoted)
- A similar ThreeEarth project combines a fresnel glow material, a starfield and ACES tone mapping. — [Tryhard-source/ThreeEarth](https://github.com/Tryhard-source/ThreeEarth)
- Three.js Journey "Earth Shaders" builds day/night from sun direction, with clouds and specular from a packed texture (R = specular, G = clouds, linear). Day/night textures are sRGB 4096×2048. The atmosphere is framed as a glow "feeling like a volume". Detailed atmosphere code is paywalled. — [Three.js Journey Earth shaders](https://threejs-journey.com/lessons/earth-shaders)
- The three.js forum suggests adding fresnel to built-in materials via `onBeforeCompile`, injecting after map/color are applied. — [discourse: Fresnel shader or similar effect](https://discourse.threejs.org/t/fresnel-shader-or-similar-effect/9997/26)
- `@react-three/postprocessing` Bloom props and defaults are: `intensity` 1, `luminanceThreshold` 0.9, `luminanceSmoothing` 0.025, `mipmapBlur` true, `radius` 0.85 (mipmap only), `levels` 8. "Bloom is selective by default": with `luminanceThreshold={1}` nothing glows unless its colour exceeds [0,1], and the material must have `toneMapped={false}`. Example: `<meshBasicMaterial color={[2,0,0]} toneMapped={false} />` glows. — [react-postprocessing Bloom docs](https://react-postprocessing.docs.pmnd.rs/effects/bloom)

### Inferences (implementation sketch)
**Earth surface (texture-free or one small texture):**
```glsl
uniform vec3 uSunDir;            // world-space, normalized
varying vec3 vN; varying vec3 vPosObj;
void main(){
  float ndl = dot(normalize(vN), uSunDir);
  float day = smoothstep(-0.15, 0.25, ndl);
  // procedural continents: fbm on the unit position, thresholded (or one 1k mask texture)
  float land = smoothstep(0.02, 0.06, fbm(vPosObj * 2.2) - 0.05);
  vec3 ocean = vec3(0.02, 0.07, 0.16), ground = vec3(0.05, 0.12, 0.10);
  vec3 dayCol = mix(ocean, ground, land);
  vec3 nightCol = vec3(1.0, 0.7, 0.35) * land * step(0.62, fbm(vPosObj * 18.0)) * 0.6; // city sparkle
  vec3 col = mix(nightCol, dayCol, day);
  float twilight = smoothstep(-0.25, 0.0, ndl) * smoothstep(0.35, 0.0, ndl);
  col += vec3(1.0, 0.45, 0.2) * twilight * 0.15;
  gl_FragColor = vec4(col, 1.0);
}
```
A dark, desaturated Earth makes the aurora and field lines pop. That suits the minimalist look better than a photoreal Blue Marble.

**Atmosphere shell (sphere r = 1.04, side: BackSide, AdditiveBlending, depthWrite false):**
```glsl
float f = pow(clamp(1.0 - dot(vN, vView), 0.0, 1.0), 4.0);     // for BackSide flip vN or use (dot+1)
float sunSide = smoothstep(-0.3, 0.6, dot(vN, uSunDir));
vec3 atm = mix(vec3(1.0,0.45,0.25), vec3(0.3,0.6,1.0), smoothstep(-0.1, 0.4, dot(vN,uSunDir)));
gl_FragColor = vec4(atm * f * (0.25 + 1.2 * sunSide), f);
```

**Sun (small, or partially off-screen):**
- Sphere with `fbm(pos*4 + uTime*0.05)` granulation, colour `mix(vec3(1.0,0.45,0.1), vec3(1.0,0.9,0.6), n) * 3.0` (HDR, so it blooms) and `toneMapped:false`.
- Corona: a camera-facing plane (drei `<Billboard>`) 4–6× the sun radius. Fragment: `float r = length(uv-0.5)*2.0; float rays = fbm(vec2(atan(uv.y-0.5,uv.x-0.5)*6.0, r*2.0 - uTime*0.1)); alpha = pow(1.0 - r, 3.0) * (0.6 + 0.4*rays);` with additive blending. One quad, very cheap.

**Bloom settings to start from:** `<EffectComposer multisampling={0} disableNormalPass>` `<Bloom mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.2} intensity={0.8} radius={0.7} />`. Only push the sun core, flow-pulse heads, aurora peaks and CME front above 1.0. Everything else stays below 1 and does not bloom, which keeps the frame clean.

### Gaps
- Exact code of the Three.js Journey atmosphere is paywalled. The fresnel atmosphere approach is confirmed by bobbyroe's repo.
- The `disableNormalPass` prop name changed across @react-three/postprocessing versions (`enableNormalPass` in v2.16+). Check the installed version.

---

## 5. Camera choreography

### Takeaway
Use drei `<CameraControls>` (which wraps yomotsu/camera-controls). `setLookAt(px,py,pz, tx,ty,tz, true)` gives smooth transitions, and transition methods return awaitable promises, so you can sequence an intro fly-in. `smoothTime` controls damping. For idle drift, add a tiny sinusoidal offset in `useFrame` or use `azimuthAngle` increments. For reduced motion, pass `false` (no transition) and disable the drift.

### Cited Findings
- In camera-controls, `setLookAt(positionX, positionY, positionZ, targetX, targetY, targetZ, enableTransition)` animates when the last argument is `true`. Transition methods (`rotateTo`, `dollyTo`, `fitToSphere`, ...) return promises that can be awaited in sequence. Passing `false` resolves immediately. — [camera-controls README (jsDelivr)](https://cdn.jsdelivr.net/npm/camera-controls@3.1.2/readme.md); [tessl camera-controls movement docs](https://tessl.io/registry/tessl/npm-camera-controls/files/docs/camera-movement.md)
- Transition feel is tuned with `smoothTime` and `restThreshold`. — [camera-controls README](https://cdn.jsdelivr.net/npm/camera-controls@3.1.2/readme.md)
- drei's controls call `invalidate()` automatically, which matters if `frameloop="demand"`. — [R3F scaling performance](https://r3f.docs.pmnd.rs/advanced/scaling-performance)

### Inferences (implementation sketch)
```tsx
const cc = useRef<CameraControls>(null);
const reduced = typeof window !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
useEffect(() => { (async () => {
  const c = cc.current!; c.smoothTime = 1.2;
  await c.setLookAt(0, 6, 60, 0, 0, 0, false);              // start far
  await c.setLookAt(-4, 3, 16, 0, 0, 0, !reduced);         // fly-in
  c.smoothTime = 0.6;
})(); }, []);
// events: store.subscribe(s => s.focus, f => cc.current?.setLookAt(...presets[f], !reduced))
// idle drift (skip if reduced or user interacting):
useFrame((_, dt) => { if (!reduced && !interacting.current) cc.current?.azimuthAngle && cc.current.rotate(dt * 0.02, 0, false); });
```
- Limit `minDistance`/`maxDistance` and polar angles so users cannot get lost. Consider `mouseButtons.wheel = ACTION.NONE` on a homescreen, so scrolling the page does not dolly.
- Without CameraControls: `camera.position.lerp(target, 1 - Math.exp(-dt * 3))` (frame-rate-independent damping) and a reused `Vector3`.
- Preset framings: "Overview" (Sun glow at the screen-left edge, Earth right of centre), "Magnetosphere" (side view, tail streaming right), "Aurora" (close over the north pole, limb view so the curtains show).

### Gaps
- The drei example sandbox (sew669) was not opened. The drei-side ref API matches camera-controls methods, but the exact prop list was not verified.

---

## 6. Minimalist aesthetic

### Takeaway
Use a near-black background, at most 3 hue families (warm sun/wind amber, cool cyan/blue field lines and atmosphere, aurora green with a magenta accent), and let bloom provide all the "wow". Cheat scale hard: the sun is a small glowing disc or sits partly off-screen at the left, Earth is about 1 unit, and the magnetosphere is about 10–15 units. Fake depth of field with fog-like alpha falloff and particle size by depth, not a DoF pass. Add a vignette in the final shader or as a CSS radial-gradient overlay to save a pass.

### Cited Findings
- Bloom being selective by HDR value (threshold 1, `toneMapped={false}`) is what lets a minimal scene glow only where intended. — [react-postprocessing Bloom](https://react-postprocessing.docs.pmnd.rs/effects/bloom)
- ACES tone mapping plus a starfield is a common recipe in Earth demos. — [Tryhard-source/ThreeEarth](https://github.com/Tryhard-source/ThreeEarth)

### Inferences
- **Starfield:** drei `<Stars radius={200} depth={60} count={3000} factor={3} saturation={0} fade speed={0.3} />` is a single Points draw. Or write your own Points with size and brightness falloff. Keep stars dim (<1) so they do not bloom into noise.
- **Vignette without a pass:** an absolutely positioned div over the canvas, `background: radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.7) 100%)`, with `pointer-events:none`. It costs no GPU passes and composes well with HTML UI.
- **DoF alternative:** in the particle vertex shader, `vAlpha *= smoothstep(far, near, -mv.z)` and enlarge distant points slightly with low alpha. That produces a bokeh-ish look for free. Use `<fog attach="fog" args={['#02040a', 30, 90]} />` for meshes (ShaderMaterial needs `fog:true` plus the fog chunks, or a manual fog in the shader).
- **Uncluttered:** show field lines at 0.15–0.25 base alpha and let only the pulses bloom. Show 6–8 L-shells × 8–12 longitudes, not 50. Hide the bow shock until the storm level is high. One focal event at a time.
- **Palette example:** bg #03050B, sun #FFB15C to #FFF2D6, wind #FFD9A8, field #6FD3FF, atmosphere #4FA3FF, aurora #3DFF9A / #FF4D8D, ring current #FF8A5C.

### Gaps
- No studio write-up (e.g., Active Theory, Lusion) on minimalist space scenes was retrieved in this research. The aesthetic guidance is inference.

---

## 7. Performance

### Takeaway
Use one Canvas with `dpr={[1, 1.5]}`, `gl={{ antialias:false, powerPreference:'high-performance' }}`, and a single Bloom with `mipmapBlur` and `multisampling={0}`. Keep everything in about 10–15 draw calls, with all animation in shaders driven by uniforms updated in `useFrame` from `store.getState()` (no React state per frame). Use drei `PerformanceMonitor` to step DPR (1.5→1.25→1) and particle count, plus a `flipflops` fallback. Pause rendering when offscreen or the tab is hidden.

### Cited Findings
- Don't call `setState` in `useFrame`. Mutate refs instead, and multiply motion by `delta`. Read Zustand with `api.getState()` inside `useFrame` rather than subscribing reactively to fast-changing values. Don't allocate (e.g., `new Vector3`) inside loops. Share geometries and materials, and toggle `visible` instead of mounting and unmounting (unmounting forces shader recompiles). — [R3F performance pitfalls](https://r3f.docs.pmnd.rs/advanced/pitfalls)
- `frameloop="demand"` renders only on change, and `invalidate()` requests a frame. Canvas `performance={{min, max, debounce}}` with `regress()` gives movement-based regression, which apps must read via `state.performance.current`. Use instancing to cut draw calls, and `<Detailed distances=[...]>` for LOD. — [R3F scaling performance](https://r3f.docs.pmnd.rs/advanced/scaling-performance)
- drei `PerformanceMonitor` props: `ms` (250), `iterations` (10), `threshold` (0.75), `bounds` (default `refreshrate > 90 ? [50, 90] : [50, 60]`), `flipflops` (Infinity), `factor` (0.5), `step` (0.1). Callbacks are `onIncline`, `onDecline`, `onChange({factor})` and `onFallback`. Children can use `usePerformanceMonitor`. — [drei PerformanceMonitor docs](https://drei.docs.pmnd.rs/performances/performance-monitor)
- Raymarched aurora shaders get expensive at 1080p. Halving iterations is the recommended fix. — [Troikatronix thread](https://community.troikatronix.com/topic/7442/aurora-borealis-shader)

### Inferences (implementation sketch)
```tsx
const [dpr, setDpr] = useState(1.5);
<Canvas dpr={dpr} gl={{ antialias: false, powerPreference: 'high-performance', alpha: false }}
        camera={{ fov: 35, near: 0.1, far: 500 }} frameloop={visible ? 'always' : 'never'}>
  <PerformanceMonitor factor={1} flipflops={3}
     onChange={({ factor }) => setDpr(1 + 0.5 * factor)}        // stays inside [1, 1.5]
     onFallback={() => { setDpr(1); useScene.getState().setQuality('low'); }} />
  ...
  <EffectComposer multisampling={0}><Bloom mipmapBlur luminanceThreshold={1} intensity={0.8} /></EffectComposer>
</Canvas>
```
- `visible` comes from an IntersectionObserver on the canvas container plus `document.visibilitychange`, so a homescreen hero stops rendering when scrolled away.
- Uniform updates: `useFrame((s, dt) => { mat.current.uniforms.uTime.value += dt; const {r0, alpha, speed} = useScene.getState(); u.uR0.value = THREE.MathUtils.damp(u.uR0.value, r0, 4, dt); })`. Damping makes slider changes animate smoothly with zero re-renders.
- Cost controls: aurora shells use 1 noise octave or 2, never raymarching. Sun fbm is limited to 3–4 octaves on a small screen area. Particles are 6k (low) / 12k (mid) / 20k (high) via `setDrawRange`. Additive transparent objects use `depthWrite:false` and are ordered via `renderOrder`.
- Mobile fallback: `if (navigator.hardwareConcurrency <= 4 || matchMedia('(pointer: coarse)').matches)` means quality 'low', no ring-current torus, half particles and dpr 1. If WebGL2 is unavailable, show a static poster image (pre-rendered screenshot) and keep the HTML UI.
- Next.js 14: load the Canvas through `dynamic(() => import('./Scene'), { ssr:false })` so three does not run on the server. Add `transpilePackages: ['three']` only if needed.
- Use `ShaderMaterial` (not RawShaderMaterial) so `modelViewMatrix`, `cameraPosition` and the rest are injected. three 0.170 compiles as GLSL3 on WebGL2 automatically, so `gl_FragColor` still works via three's compatibility defines. Add `#include <tonemapping_fragment>` and `<colorspace_fragment>` only for materials that should be tone-mapped.

### Gaps
- No benchmark numbers for this exact scene on Intel Iris Xe or similar were found. Profile with `r3f-perf` or Chrome's GPU profiler.
- The claim about GLSL3 conversion and gl_FragColor compatibility comes from general knowledge of three.js r150+ behaviour and was not verified against 0.170 source in this research.

---

## 8. Notable open-source examples and tutorials (URLs)

### Takeaway
The most directly useful references are bobbyroe/threejs-earth (fresnel glow material), Three.js Journey Earth Shaders and GPGPU Flow Field lessons (paid), Codrops GPGPU dreamy particles and Animated Mesh Lines, nimitz's Shadertoy "Auroras" (XtGGRt), and the pmndrs docs for performance, Line, PerformanceMonitor and Bloom.

### Cited Findings
- Fresnel Earth glow: [bobbyroe/threejs-earth](https://github.com/bobbyroe/threejs-earth); [Tryhard-source/ThreeEarth](https://github.com/Tryhard-source/ThreeEarth)
- Earth shaders lesson (day/night, atmosphere): [Three.js Journey – Earth Shaders](https://threejs-journey.com/lessons/earth-shaders)
- GPGPU flow-field particles: [Three.js Journey – GPGPU Flow Field Particles](https://threejs-journey.com/lessons/gpgpu-flow-field-particles-shaders); [Codrops – Dreamy GPGPU particles (2024)](https://tympanus.net/codrops/2024/12/19/crafting-a-dreamy-particle-effect-with-three-js-and-gpgpu/)
- Animated glowing lines: [Codrops – Animated Mesh Lines (2019)](https://tympanus.net/codrops/2019/01/08/animated-mesh-lines/)
- Aurora: Shadertoy "Auroras" by nimitz, https://www.shadertoy.com/view/XtGGRt (referenced by [godotshaders port](https://godotshaders.com/shader/aurora-sky-shader/)); [volumetric aurora (Godot)](https://godotshaders.com/shader/volumetric-aurora-borealis-with-polar-reflection/)
- Fresnel on built-in materials: [three.js discourse thread](https://discourse.threejs.org/t/fresnel-shader-or-similar-effect/9997/26)
- Physics reference for magnetopause: [Shue et al. 1997](https://ulcar.uml.edu/eeas/Songetal/Shue_et_al-1997-Journal_of_Geophysical_Research-_Solid_Earth_(1978-2012).pdf); [SpacePy implementation](https://pythonhosted.org/SpacePy/_modules/spacepy/empiricals.html)
- pmndrs docs: [R3F scaling performance](https://r3f.docs.pmnd.rs/advanced/scaling-performance), [R3F pitfalls](https://r3f.docs.pmnd.rs/advanced/pitfalls), [drei Line](https://drei.docs.pmnd.rs/shapes/line), [drei PerformanceMonitor](https://drei.docs.pmnd.rs/performances/performance-monitor), [react-postprocessing Bloom](https://react-postprocessing.docs.pmnd.rs/effects/bloom)
- Camera: [camera-controls README](https://cdn.jsdelivr.net/npm/camera-controls@3.1.2/readme.md)

### Inferences
- Noise for all shaders: Ashima/stegu `webgl-noise` (simplex 3D, MIT), pasted as a GLSL string chunk shared across materials. This is general knowledge; the URL is https://github.com/stegu/webgl-noise and was not fetched.
- A recommended build order for a few hours with the biggest payoff: (1) starfield, dark Earth and fresnel atmosphere, with Bloom at threshold 1. (2) Field lines merged into one geometry with the flow-pulse shader. (3) Shue shell. (4) Vertex-shader solar wind with deflection. (5) Aurora oval shell. (6) CameraControls intro and presets. (7) PerformanceMonitor and visibility pause. (8) Sun and corona billboard, ring current.

### Gaps
- No public repo combining sun, solar wind, magnetosphere and aurora in r3f was found. NASA's "Eyes" and SVS visualizations exist but were not examined.
- Not found or verified: CodePens specific to dipole field lines, and an r3f aurora example.
