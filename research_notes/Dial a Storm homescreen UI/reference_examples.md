# Reference Examples: Best-in-Class Scientific / Space-Weather 3D Web Visualizations and Award-Winning 3D Data-Storytelling Sites (for Dial-a-Storm)

Note on method: about 17 search/fetch calls. Primary sources were fetched for the GitHub globe, Stripe globe, JPL Eyes relaunch, Igloo Inc (Awwwards case study) and NASA SVS 5435. Other items come from search snippets and are marked that way. Claims drawn from the researcher's general familiarity, not a fetched source, are kept in "Inferences" and labeled "(unverified)".

## Which space-weather / heliophysics visualizations are best-in-class, and what do they do well and badly for laypeople?

### Takeaway
The official heliophysics tools fall into two groups. NASA SVS renders (cinematic, model-driven, legend kept off-screen) look the best but aren't interactive. NOAA SWPC and Eyes are interactive but are dashboards or explorers built for people who already know what Kp, Bz or a spacecraft name means. No official tool combines "turn a knob, see the magnetosphere react, read one big number." Dial-a-Storm can fill that gap.

### Cited Findings
**1. NASA SVS 5435: "Geomagnetic and Atmospheric Response to May 2024 Solar Storm" (Gannon storm)** — https://svs.gsfc.nasa.gov/5435
- A MAGE/GAMERA magnetosphere simulation of May 10–11, 2024. The page says the storm reached G5, "the highest level on the geomagnetic storm scale." — [NASA SVS 5435](https://svs.gsfc.nasa.gov/5435)
- Color legend: white = satellite orbit trails; orange = proposed GDC orbits; orange-to-purple = magnetic field lines; **blue trails = solar-wind velocity tracers**; **green clouds = electric-current intensity**. The legend lives on the web page, not as overlays in the video. — [NASA SVS 5435](https://svs.gsfc.nasa.gov/5435)
- Offered up to 5760x3240, plus a version with the hypothetical orbits removed (decluttered). — [NASA SVS 5435](https://svs.gsfc.nasa.gov/5435)
- Peak Dst for the storm was −412 nT at 03:00 UTC on 11 May 2024 (a useful headline number for a replay). — [Wikipedia: May 2024 solar storms](https://en.wikipedia.org/wiki/May_2024_solar_storms)
- NASA named the storm after Jennifer Gannon. It was the first G5 in over two decades. — [Space.com](https://space.com/stargazing/auroras/nasa-names-geomagnetic-storm-for-1st-time-honoring-a-space-weather-scientist-who-died-suddenly-in-2024); [EurekAlert](https://www.eurekalert.org/news-releases/1083377)

**2. NASA SVS magnetosphere/CME series (3902, 3551, 4188, 11689)**
- SVS 3902 (dome show) is built on a real December 2003 CME. It shows solar wind flowing around Earth and field lines trailing into the tail, and openly says the particles are a stylized stand-in because the real ions and electrons are far too small to see. — [NASA SVS 3902](https://svs.gsfc.nasa.gov/3902/)
- SVS 4188 (BATS-R-US): each frame is 2 minutes of real time. It shows a low-density wake behind Earth on a density cut-plane. — [NASA SVS 4188](https://svs.gsfc.nasa.gov/4188/)
- SVS 11689 "Modeling Earth's Magnetism" compares a moderate and an extreme CME side by side. That is a direct precedent for a "compare storms" mode. — [NASA SVS 11689](https://svs.gsfc.nasa.gov/11689)

**3. NASA/JPL Eyes on the Solar System (browser relaunch, 2022)** — https://eyes.nasa.gov/apps/solar-system
- Browser-based. It has 126 spacecraft, a 1949–2049 time scrubber, side-by-side comparison, adjustable lighting and viewing angle, and **scrollable guided "journeys"** such as Voyager's Grand Tour. It took more than 2 years to build. — [JPL News](https://www.jpl.nasa.gov/news/explore-the-solar-system-with-nasas-new-and-improved-3d-eyes/)
- Producer Jason Craig: "The beauty of the new browser-based 'Eyes on the Solar System' is that it really invites exploration." — [JPL News](https://www.jpl.nasa.gov/news/explore-the-solar-system-with-nasas-new-and-improved-3d-eyes/)
- Simplified navigation was a stated goal of the redesign. — [Habr (summarizing the NASA release)](https://habr.com/ru/news/t/686494); [BGR](https://www.bgr.com/science/nasas-awesome-updated-site-lets-you-explore-outer-space-from-home)
- Still updated: an April 2026 update matched the Artemis II simulation to the actual launch time. — search snippet via [NASA](https://science.nasa.gov/?p=1219535)

**4. NOAA SWPC Aurora Dashboard (experimental, launched Sept 29, 2022)** — https://www.swpc.noaa.gov/communities/aurora-dashboard-experimental
- One page pulls together OVATION viewline forecasts for tonight and tomorrow (driven by the 3-day Kp forecast), solar-wind speed, IMF readings, F10.7 flux, and explanations of how Kp affects visibility. — [SWPC news](https://www.spaceweather.gov/news/experimental-aurora-dashboard-available)
- NOAA recolored its Planetary K-index plot so the colors line up with the G-scale (green for Kp ≤ 4) and added decimal values. Consistent color-to-severity mapping is the official direction. — search snippet, [SWPC node 960](https://swpc.noaa.gov/node/960)

**5. earth.nullschool.net (Cameron Beccario)**: the non-space benchmark for "dark globe + motion = instant comprehension." — https://earth.nullschool.net
- Commentators credit the animated particle-flow aesthetic as "the gold standard for meteorological visualization" since 2014. The layout is minimal: a dark globe, moving particles, compact controls. — [webiano.digital](https://webiano.digital/earth-nullschool-lets-you-watch-the-planet-breathe/)
- Showing only wind over a 3D globe makes the effects easier to grasp. — [AIN Online](https://ainonline.com/aviation-news/business-aviation/2014-12-22/new-wind-visualization-tool-appears)
- Inspired by Viégas and Wattenberg's hint.fm Wind Map. The code is open (github.com/cambecc/earth). An HN commenter criticized possible magnitude miscalibration over land and noted that the animation pauses during pan/zoom. — [Cool Infographics](https://coolinfographics.com/blog/2017/7/31/earth-a-visualization-project.html); [HN mirror](https://pdkfjnhmlf.duckdns.org/item?id=6924854)

**6. OpenSpace / CCMC Gannon-storm aurora visualization**
- CCMC/NASA GSFC built a Gannon-storm aurora visualization in OpenSpace (an interactive tool), and a 2025 poster plans updates with geophysical models. — [UCAR poster (Natsheh)](https://cpaess.ucar.edu/sites/default/files/poster-2025-sww/Natsheh-Feras.pdf)

**Layperson failure modes in official tools**
- NOAA's Space Weather Scales are being revised because they "have become outdated and confusing" for the public. STPI is preparing revision options for NOAA. — [Space.com](https://www.space.com/the-universe/earth/space-weather-scales-are-outdated-and-confusing-heres-what-noaa-scientists-are-doing-about-it) (headline + search snippet; the full body could not be fetched)
- A 2026 Space Weather Workshop poster (Kiczenski and Melnik) finds aurora chasers treating Kp/Dst as predictors of local visibility despite their uncertainty. — search snippet via [UCAR CPAESS](https://cpaess.ucar.edu/print/pdf/node/26804)
- A 2025 poster (Melnik team): forecasts reach the public without their limits or uncertainty explained, which leads to "public disappointment when forecasts do not materialize." — search snippet via [UCAR CPAESS](https://cpaess.ucar.edu/print/pdf/node/26356)
- Outreach writing notes that many people "are still quite confused" about the relevance of space weather to daily life. — [CAPjournal](https://capjournal.org/issues/16/16_15.php)

### Inferences
- SVS's strongest lesson is **semantic color**: one hue per physical thing (blue = solar wind, green = current, warm-to-cool = field). Dial-a-Storm should give each actor one hue and keep it everywhere: the slider, the 3D particle, the chart line and the label.
- SVS puts the legend off-canvas. That's fine for a video but bad for a single-screen app. Put short labels directly on the 3D scene ("Solar wind →", "Magnetic shield", "Aurora") instead of using a legend.
- SVS 3902 shows that **honest stylization is acceptable** if you say so: "particles are illustrative." Add a one-line "artistic, not to scale" disclaimer so judges don't think the 3D is the model output.
- NOAA's Kp-to-G-scale color alignment suggests that the ML output should be shown as **G0–G5 with NOAA-consistent colors plus a plain-English word** (Quiet / Minor / ... / Extreme), not as a raw Kp/Dst number alone.
- The Kiczenski and Melnik finding implies the prediction needs an uncertainty cue (a range band or a "confidence" word) and should not promise local aurora visibility. Phrase it as "aurora could reach ~X° latitude."
- (unverified) SpaceWeatherLive and the SWPC home page are dense multi-panel dashboards with many plots and acronyms (Bt, Bz, nT, km/s). They are good for experts but unreadable at a glance. They are useful mainly as the "what not to do on the homescreen" foil, and as the source of the convention that a southward (negative) Bz is the key driver, often colored red when negative.
- (unverified) WSA-Enlil's SWPC animation (ecliptic density "pinwheel" with a rainbow colormap) is iconic but uses a rainbow/jet palette and dense axis labels that laypeople can't decode.

### Gaps
- No usability study of NASA Eyes, SWPC or SpaceWeatherLive with laypeople was found.
- Could not fetch the full Space.com article on the NOAA scales revision. Specific quotes and proposed new scales are unknown.
- Did not verify the ESA Space Weather Service Network or SDO/Helioviewer UIs in this pass. NASA Eyes on the Earth was not reviewed.

## Which Awwwards / FWA / CSSDA-class space, planet or science sites (2020–2026) stand out, and why?

### Takeaway
The award winners that matter for Dial-a-Storm are the restrained data globes (GitHub, Stripe) and the high-polish single-scene sites (Igloo Inc, Bruno Simon). They win through one hero object, real data as "proof of life," adaptive performance, a fast first paint, and micro-interactions, not through feature count.

### Cited Findings
**7. GitHub homepage globe (2020)** — https://github.blog/engineering/engineering-principles/how-we-built-the-github-globe/
- Built in three.js with **no textures**. It has five layers: halo, globe, land regions, blue spikes (open PRs) and pink arcs (merged PRs). That is a **two-accent palette on a dark base**. — [GitHub Blog](https://github.blog/engineering/engineering-principles/how-we-built-the-github-globe/)
- Land is about 12k instanced five-sided circles sampled from a small world-map PNG (alpha ≥ 90). — [GitHub Blog](https://github.blog/engineering/engineering-principles/how-we-built-the-github-globe/)
- Halo: a custom-shader gradient on the back face of a sphere at 1.15× scale, rotated to emphasize the top-left. It hides the jagged edge left by turning antialiasing off. — [GitHub Blog](https://github.blog/engineering/engineering-principles/how-we-built-the-github-globe/)
- Fading dot alpha by camera distance "simulated the look of a thicker atmosphere" and reduced moiré. — [GitHub Blog](https://github.blog/engineering/engineering-principles/how-we-built-the-github-globe/)
- Arcs are CubicBezierCurve3 at three altitudes, with longer arcs higher. They are animated with TubeBufferGeometry plus setDrawRange. Landing points get a persistent dot and an expanding, fading ring. Easing moves 6% of the remaining distance per frame. — [GitHub Blog](https://github.blog/engineering/engineering-principles/how-we-built-the-github-globe/)
- **Adaptive quality**: if the page can't hold 55.5 fps over 50 frames, it steps down through four tiers (pixel ratio 2.0 → 1.5, fewer arcs, less frequent raycasting, land density ×0.65). — [GitHub Blog](https://github.blog/engineering/engineering-principles/how-we-built-the-github-globe/)
- The initial rotation is offset by the device timezone, so you see "your" region without an IP lookup. — [GitHub Blog](https://github.blog/engineering/engineering-principles/how-we-built-the-github-globe/)
- **Perceived speed**: a static SVG of the globe renders first, then the WebGL canvas crossfades in (Web Animations API). — [GitHub Blog](https://github.blog/engineering/engineering-principles/how-we-built-the-github-globe/)
- Real data gave "proof of life." Clickable arcs "really upleveled the experience." — [GitHub Blog](https://github.blog/engineering/engineering-principles/how-we-built-the-github-globe/)

**8. Stripe globe (2020)** — https://stripe.com/blog/globe
- About 60k dots on a sunflower/Fibonacci spiral to avoid polar clumping, culled to about 20k (live countries only). There's a semi-transparent ocean sphere underneath. — [Stripe Blog](https://stripe.com/blog/globe)
- Dots are grouped per country through a color-coded PNG mask, so a whole country can animate color, opacity and z together. — [Stripe Blog](https://stripe.com/blog/globe)
- Arcs are TubeBufferGeometry with draw range grown over 2.5 s and a custom fragment shader for color. — [Stripe Blog](https://stripe.com/blog/globe)
- Target: everything at 60 fps, with a static-image fallback (never needed). Disabling `antialias` fixed stutter on 5K displays. Other animations pause during scroll. The globe stops rendering once off-screen. — [Stripe Blog](https://stripe.com/blog/globe)
- Process: a Photoshop mock first, then a fully functional prototype early so quality could be judged while iterating. — [Stripe Blog](https://stripe.com/blog/globe)

**9. Igloo Inc (abeto / Bureaux): Awwwards Site of the Year and Developer Site of the Year 2024** — https://www.igloo.inc ; case study https://www.awwwards.com/igloo-inc-case-study.html
- Awarded Site of the Year and Developer SOTY 2024. — [Awwwards Annual Awards 2024](https://www.awwwards.com/annual-awards-2024/site-of-the-year)
- Jury (Quintin Lodge) praised pairing an immersive 3D experience with easy scroll-based navigation, plus the micro-interactions. — search snippet via [Awwwards](https://www.awwwards.com/annual-awards-2024/site-of-the-year)
- Only **three sections**. Keeping a short scroll engaging was the core challenge. — [Awwwards case study](https://www.awwwards.com/igloo-inc-case-study.html)
- "Previs" untextured camera-path renders got the team to agree on camera moves before production. — [Awwwards case study](https://www.awwwards.com/igloo-inc-case-study.html)
- The UI is rendered in WebGL, with an SDF text "scramble" done by shifting texture offsets, avoiding HTML/CSS recalculation. — [Awwwards case study](https://www.awwwards.com/igloo-inc-case-study.html)
- The intro is real-time shaders, not video (smaller, editable). Textures load and shaders compile in the background. It was tuned for low-end devices. — [Awwwards case study](https://www.awwwards.com/igloo-inc-case-study.html)
- **Particles change color with speed and glow as they form shapes.** Sound is tied to particle motion. — [Awwwards case study](https://www.awwwards.com/igloo-inc-case-study.html)
- Also won a 2026 Webby for Best Visual Design – Aesthetic. — [Webby Awards](https://winners.webbyawards.com/2026/websites-and-mobile-sites/features-design/best-visual-design-aesthetic/361001/igloo-inc)

**10. Bruno Simon portfolio (2019 version won Awwwards SOTY 2020; 2025 rebuild won SOTM Jan 2026)** — https://bruno-simon.com
- The original won Site of the Year 2020. The 2025 rebuild ("for the WebGPU era") won Portfolio Honors (Dec 2025) and Site of the Month (Jan 2026). — search snippets via [Awwwards case study](https://www.awwwards.com/brunos-portfolio-case-study.html)
- Stack reported (secondhand): Three.js with WebGL/WebGPU, Rapier physics, Howler audio, MIT-licensed repo brunosimon/folio-2025. — [GeekNews](https://news.hada.io/topic?id=24963) (unconfirmed from primary)
- The original drew about 400k visitors. — [Pastel blog](https://usepastel.com/blog/how-a-design-portfolio-got-the-attention-of-400-000-visitors)

**11. Explorable explanations lineage (Bret Victor, Nicky Case)**: the interaction-design ancestor of "sliders that move a model."
- Victor's 2011 essay coined the term. A common reading of it: "Most interactive widgets dump the user in a sandbox and say 'figure it out for yourself'. Those are not explanations." — [worrydream.com](https://worrydream.com/ExplorableExplanations/); [Medium summary](https://medium.com/@Max_Goldstein/exploring-explorable-explanations-92f865c8d6ba)
- Nicky Case defines an explorable as something that "1) teaches something, and 2) is more interactive than a boring ol' quiz with only one right answer." — [explorabl.es via search](https://blog.ncase.me/explorable-explanations)

### Inferences
- **Key transferable pattern (GitHub + Stripe):** a dark field, a textureless stylized planet made of instanced dots, a back-face fresnel halo, and **one or two saturated accents that each carry meaning**. The GitHub halo trick is directly portable to an Earth plus magnetosphere "shield" in react-three-fiber (`<mesh scale={1.15}><sphereGeometry/><shaderMaterial side={BackSide} .../></mesh>`).
- The Igloo idea of "particles change color with speed and glow as they form" maps one-to-one onto solar-wind particles colored by speed slider (cool to hot) with brightness by density. The visual then *is* the data encoding.
- Igloo's "three sections" and GitHub's single hero support one screen, one scene, three acts: Sun → wind → Earth.
- Bruno Simon's 2025 rebuild relies on WebGPU, which doesn't fit this project's constraints. The transferable lessons are physics-y playfulness and sound feedback, not the renderer.
- (unverified) Other references worth a glance: Lusion (lusion.co, Awwwards SOTY-class WebGL studio known for restrained monochrome plus a single accent), NASA "Eyes on Exoplanets", Solar System Scope, Google Arts & Culture's "Experiments" (e.g., the Chrome Experiments "100,000 Stars"), The Pudding / NYT step-scroll explainers. These were not fetched in this pass.
- (unverified) Linear and Vercel heroes use near-black backgrounds, a single gradient glow, large tight-tracked sans type (Inter-class), and 1–2 lines of copy. This is the minimalist "SaaS hero" convention judges will read as polished.

### Gaps
- No confirmed 2020–2026 Awwwards SOTD/SOTY that is specifically a space-weather or heliophysics site was found. The space-themed Awwwards finds were either old (NASA Spacecrafts, SOTD 2018) or unverified portfolios.
- No primary source was found for a Pudding/NYT/Reuters 3D space-weather interactive on the May 2024 storm. Coverage was mostly photo galleries and articles.
- Palette hex values for GitHub and Igloo aren't published in their write-ups.

## What recurring design patterns create "wow" while staying minimalist?

### Takeaway
Across the references, the "wow" comes from motion of real or real-looking data on a dark field, one hero object, semantic accent colors, a soft halo instead of heavy bloom, and fast perceived load. Minimalism comes from on-object labels, a single hero number, and guided first moves instead of an empty sandbox.

### Cited Findings
- Dark globe plus motion plus compact controls is the nullschool formula. Motion is "the first thing you notice." — [webiano.digital](https://webiano.digital/earth-nullschool-lets-you-watch-the-planet-breathe/)
- A shader halo or fresnel stands in for the atmosphere and costs less than antialiasing or post bloom. — [GitHub Blog](https://github.blog/engineering/engineering-principles/how-we-built-the-github-globe/)
- Draw-on animations (setDrawRange over about 2.5 s) and landing pulses (an expanding, fading ring) give events a "heartbeat." — [Stripe Blog](https://stripe.com/blog/globe); [GitHub Blog](https://github.blog/engineering/engineering-principles/how-we-built-the-github-globe/)
- Exponential easing (6% of the remaining distance per frame) gives slow, settling motion. — [GitHub Blog](https://github.blog/engineering/engineering-principles/how-we-built-the-github-globe/)
- Static poster first, then a crossfade to WebGL. Shaders compile in the background. — [GitHub Blog](https://github.blog/engineering/engineering-principles/how-we-built-the-github-globe/); [Awwwards Igloo case study](https://www.awwwards.com/igloo-inc-case-study.html)
- Adaptive quality tiers keyed to FPS. — [GitHub Blog](https://github.blog/engineering/engineering-principles/how-we-built-the-github-globe/)
- Scroll or step navigation through a few sections, plus micro-interactions. — [Awwwards SOTY 2024](https://www.awwwards.com/annual-awards-2024/site-of-the-year)
- Guided journeys layered on top of free exploration (Eyes "Voyager's Grand Tour"). — [JPL News](https://www.jpl.nasa.gov/news/explore-the-solar-system-with-nasas-new-and-improved-3d-eyes/)
- A side-by-side moderate vs. extreme comparison. — [NASA SVS 11689](https://svs.gsfc.nasa.gov/11689)

### Inferences (actionable for Dial-a-Storm, WebGL2 / r3f)
1. **Palette:** near-black blue base (#05070D-ish), with one semantic hue per actor. Sun is warm amber/white. Solar wind is a ramp from cool cyan (slow) to hot white-orange (fast), with opacity by density. Earth's field/shield is a pale blue-violet fresnel. Aurora is green (#3CFF9A-ish) shading to red at extreme levels, which is physically accurate since red oxygen emission appears high up in big storms (unverified). Show **southward Bz as the only red/magenta UI accent** ("shield-opening" direction). The G-scale output uses NOAA-aligned colors.
2. **Camera:** a fixed cinematic three-quarter view framing Sun (left, partially off-screen and huge), the wind stream across the middle, and Earth plus magnetosphere (right), with a slow idle drift (±2–3° yaw, about 30 s period). On a storm replay, ease (GitHub-style lerp) toward Earth so the aurora oval reads. Avoid free OrbitControls on the homescreen (unverified heuristic). Allow at most a limited drag with spring-back.
3. **Bloom restraint:** bloom only on the Sun and aurora (selective bloom or emissive threshold), with a fresnel halo for the shield. Avoid full-screen bloom that washes out labels.
4. **Hero number:** one large readout (e.g., "G4 · Severe", or predicted min Dst "−412 nT" in small type beneath). It animates (count-up) as sliders move. Add a one-line plain-English consequence: "Aurora visible as far south as ~X°."
5. **Data drives the visual:** the Bz slider rotates or recolors the incoming field arrows and visibly "opens" the dayside shield (magnetopause compresses and reconnection glow appears). Speed sets particle velocity and color. Density sets particle count and opacity. The aurora oval grows equatorward with the prediction. The Igloo-style speed-to-color encoding is the precedent.
6. **Onboarding instead of sandbox:** start with an auto-playing ~10 s replay of the May 2024 Gannon storm (named, dated, real), then a single coach mark "Now try it: drag Bz south ↓." Offer three to four storm chips (e.g., 2003 Halloween, 2024 Gannon, a quiet day) as Eyes-style "journeys."
7. **Typography:** one geometric/grotesk sans (Inter / Space Grotesk-class), a huge tabular-numeral readout, labels in small caps on the 3D objects, and units de-emphasized (unverified convention).
8. **Perf/first paint:** a static poster PNG of the scene, crossfaded to the canvas. Use drei `<PerformanceMonitor>` (unverified API name; r3f ecosystem) to step DPR 2 → 1.5 and reduce particle counts, mirroring GitHub's tiers. Use instanced points for the wind.
9. **Honesty line:** "Illustration, not to scale; prediction from ML model trained on OMNI data" (SVS 3902-style disclosure), plus an uncertainty band on the prediction.

### Gaps
- No quantitative evidence was found (A/B or user test) that these patterns improve lay comprehension. The support comes from practitioner case studies and award juries.

## What common mistakes make science visualizations confusing for non-experts?

### Takeaway
The recurring failures are unexplained indices and acronyms (Kp, Bz, nT), scales the public finds confusing, no stated uncertainty, legends separated from the visual, sandbox interfaces with no guided first action, and stylized visuals that aren't flagged as stylized.

### Cited Findings
- NOAA's own space-weather scales are described as "outdated and confusing" and are under revision. — [Space.com](https://www.space.com/the-universe/earth/space-weather-scales-are-outdated-and-confusing-heres-what-noaa-scientists-are-doing-about-it)
- The public misreads Kp/Dst as local-visibility predictors. — [UCAR CPAESS poster snippet](https://cpaess.ucar.edu/print/pdf/node/26804); an anecdotal echo on the [SpaceWeatherLive forum](https://community.spaceweatherlive.com/topic/2816-unspecified-geomagnetic-activity/page/75/) ("Kp is never for aurora visibility")
- Missing uncertainty leads to disappointment and lost trust. — [UCAR CPAESS poster snippet](https://cpaess.ucar.edu/print/pdf/node/26356)
- Sandboxes without guidance "are not explanations." — [Medium summary of Victor](https://medium.com/@Max_Goldstein/exploring-explorable-explanations-92f865c8d6ba)
- Novelty of interaction is "not really the point." The explanation is. — search snippet, [Red Blob Games notes](https://redblobgames.com/x/2306-educ432)
- Stylized particles must be disclosed as such (SVS does this explicitly). — [NASA SVS 3902](https://svs.gsfc.nasa.gov/3902/)
- Legends kept off the visual (SVS 5435 puts its five-color legend on the web page only) require cross-referencing. — [NASA SVS 5435](https://svs.gsfc.nasa.gov/5435)
- Interaction that pauses the animation (nullschool pausing on pan/zoom) and questions about magnitude calibration hurt trust. — [HN mirror](https://pdkfjnhmlf.duckdns.org/item?id=6924854)
- Plain language is a recurring government lesson from solar-storm communication. — [GovLoop](https://www.govloop.com/community/blog/solar-storm-a-real-world-case-for-plain-language)

### Inferences
- Avoid on the homescreen: rainbow/jet colormaps (as in classic Enlil plots), more than one chart, raw "Bz = −25 nT" without a "southward = opens the shield" gloss, more than three sliders, free orbit cameras that let users lose the Sun–Earth line, and full-screen bloom that drowns text (unverified heuristics consistent with the cited findings).
- Translate every slider into a verb: "Flip the magnetic field south," "Speed up the wind," "Thicken the wind." Show the expert unit small underneath.
- Never let the 3D contradict the ML number. If the model says G1, the aurora oval and shield compression must look mild. Inconsistency between the visual and the readout is the fastest way to lose judges' trust.

### Gaps
- No peer-reviewed lay-comprehension study of geomagnetic-storm visualizations was found. Evidence is conference posters (snippets only) and practitioner commentary.
- Datawrapper / The Pudding / NYT style-guide writing on science-explainer mistakes was not fetched in this pass.
