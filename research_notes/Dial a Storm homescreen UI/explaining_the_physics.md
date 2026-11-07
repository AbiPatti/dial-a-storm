# Explaining Solar Wind–Magnetosphere Coupling to Laypeople (Dial-a-Storm)

Scope: what to show in a single-screen 3D scene (Sun → solar wind → magnetosphere → Earth + aurora), how to encode the three sliders (southward Bz, speed, density) and the ML output (SYM-H), honest quantitative anchors, metaphor guidance, uncertainty display, and plain-language labels.

Research note: ~16 tool calls. NASA Space Place solar wind page returned 404; NOAA SWPC and ESA pages fetched directly. Some quantitative relations (auroral boundary vs Dst) come from search summaries of papers and need checking against the originals (flagged below).

---

## 1. How do NASA / ESA / NOAA SWPC explain solar wind, IMF/southward Bz, reconnection, the magnetosphere shield, ring current, and equatorward aurora?

### Takeaway
Official explainers use one simple causal chain: the solar wind carries a magnetic field; when that field points **south (opposite to Earth's field)** it links up with Earth's field on the sunward side ("reconnection"), the wind drags those linked field lines to the night side, energy is stored as stretched field lines, and its release feeds the ring current and aurora. NOAA describes the storm-strength signal as a "ring of westward current around Earth". None of the agency pages fetched explains why aurora moves toward the equator, so that link has to come from the research literature and the NOAA G-scale latitudes.

### Cited Findings
- NOAA SWPC: "A geomagnetic storm is a major disturbance of Earth's magnetosphere". Storms happen when the solar wind efficiently transfers energy into near-Earth space. — [NOAA SWPC Geomagnetic Storms](https://www.spaceweather.gov/phenomena/geomagnetic-storms)
- NOAA SWPC avoids the term "Bz". It says the key condition is "a southward directed solar wind magnetic field (opposite the direction of Earth's field)", and that this orientation on the dayside is the most effective way to move energy into the magnetosphere. — [NOAA SWPC Geomagnetic Storms](https://www.spaceweather.gov/phenomena/geomagnetic-storms)
- NOAA SWPC on the ring current: "a ring of westward current around Earth produces magnetic disturbances on the ground". This current is what the Dst index measures, and Dst has historically been used to size storms. — [NOAA SWPC Geomagnetic Storms](https://www.spaceweather.gov/phenomena/geomagnetic-storms)
- NOAA SWPC metaphor for fast streams: high-speed streams "plow into the slower solar wind in front". — [NOAA SWPC Geomagnetic Storms](https://www.spaceweather.gov/phenomena/geomagnetic-storms)
- ESA (Cluster, with NASA-credited animation): with a northward IMF, "the IMF cannot connect to our magnetic field on the dayside" and the solar wind flows around the magnetosphere. With a southward IMF, "magnetic reconnection occurs". The solar wind drags the connected field lines from dayside to nightside, and plasma pours into the magnetotail. — [ESA sci.esa.int/j/36211](https://sci.esa.int/j/36211)
- ESA on energy storage: "This drag stretches the field lines, and stores the energy in the form of magnetic tension". When reconnection happens in the tail, particles and energy are released toward Earth, energizing particles and producing aurora. ESA's metaphors are "drags", "stretches", "pile up" and "pour into the tail". — [ESA sci.esa.int/j/36211](https://sci.esa.int/j/36211)
- Dayside reconnection "opens" previously closed field lines, which are then dragged anti-sunward. — [Frontiers in Astronomy & Space Sciences 2021](https://public-pages-files-2025.frontiersin.org/journals/astronomy-and-space-sciences/articles/10.3389/fspas.2021.740560/xml)
- NASA Dst description: when the IMF stays strongly southward for hours, the ring current of energetic particles encircling Earth strengthens and Dst drops quickly. Dst's fall, recovery and return to quiet define the three storm phases (main phase, recovery, quiet). — [NASA GSFC Dst Data Description](https://hdrl.gsfc.nasa.gov/LWS_Space_Weather/Dst_descrip.html)
- ESA Cluster: the ring current lies in the magnetic equatorial plane and spans about 2 to 9 Earth radii. Dst is **not** a pure ring-current measure, because other currents also contribute, mainly the magnetopause current. — [ESA First direct measurements of the ring current](https://sci.esa.int/j/37592)
- The storm-time ring current is fed from the nightside plasma sheet, with ions from both the solar wind and Earth's ionosphere. — [science.gov topic summary of ring current literature](https://www.science.gov/topicpages/s/storm+time+ring)
- Gonzalez et al. 1994 define a storm as an interval when a strong, long-lasting interplanetary electric field (solar-wind speed × southward field) intensifies the ring current past a Dst threshold. — [Gonzalez et al. 1994 via zendy](https://zendy.io/title/10.1029/93ja02867); [Wikipedia: Geomagnetic storm](https://en.wikipedia.org/wiki/Geomagnetic_storm)
- The auroral oval's equatorward boundary is correlated with Dst. Dst is used as a ring-current proxy, which links the boundary to plasma-sheet and ring-current expansion. — [Hayakawa et al. arXiv 1612.01106](https://arxiv.org/pdf/1612.01106)

### Inferences
- A simple, accurate narrative for the app has four steps: (1) the Sun blows a magnetized wind; (2) Earth's magnetic bubble deflects most of it; (3) when the wind's field points south, the bubble's front "links up" and energy gets in; (4) the energy builds a ring of current around Earth (the SYM-H number) and pushes aurora toward the equator.
- Use NOAA's own phrasing, "opposite the direction of Earth's field", as the tooltip for why south matters. It is accurate and needs no jargon.
- Show reconnection on the **dayside nose** (subsolar point) as the entry point, and show a **tail-side** release flash that feeds the ring current and aurora. This matches ESA's two-step picture.

### Gaps
- No NASA-authored public page specifically on "the door opens"/reconnection was retrieved (NASA Space Place solar-wind URL returned 404). NASA MMS mission pages are likely sources but were not fetched.
- No agency page fetched explains *why* aurora moves equatorward. The mechanism (the oval expands as the polar cap fills with open magnetic flux and the inner magnetosphere is stretched and inflated) is standard physics, but no lay source was found to cite.

---

## 2. Which metaphors work, and which mislead?

### Takeaway
I found no controlled studies testing space-weather metaphors on the public; recent work is limited to conference posters on aurora chasers. Judged on physics: "shield/bubble" is fine for the magnetosphere if the visuals show that it leaks; "door opens / links up" is good for southward Bz if it is shown as field lines connecting, not a literal hole; "stretched rubber band" (ESA) is the best metaphor for energy storage; "bathtub filling and draining" is quantitatively faithful to how SYM-H evolves (the Burton equation). "Wind on a sail" is fine for pressure but misleads if it implies that speed alone causes storms.

### Cited Findings
- No study specifically testing metaphors was found. Recent research covers aurora chasers and uncertainty. A Millersville poster lists common misreadings: treating global oval maps as local sky forecasts, using Kp or Dst as direct predictors of local visibility, and anchoring on single numbers such as predicted Kp. — [Millersville SWE poster](https://www.millersville.edu/esci/files/swe20237.pdf)
- Surveys of aurora chasers raise concern that media repeat forecasts without context, which leads to disappointment and lost trust. — [CPAESS: Space Weather Information and Aurora Chasers](https://cpaess.ucar.edu/abstract-sww-2025/space-weather-information-and-aurora-chasers)
- Early survey results: respondents preferred a more detailed forecast with explicit uncertainty language over a simpler one. The sample is not representative of the public. — [CPAESS: Initial Survey Results](https://cpaess.ucar.edu/abstract-2026-sww/initial-survey-results-aurora-chasers-use-space-weather-forecasts-and-uncertainty)
- ESA uses "stretches … magnetic tension" (an elastic band), "drag", "pile up" and "pour". — [ESA sci.esa.int/j/36211](https://sci.esa.int/j/36211)
- NOAA uses "plow into" for fast wind hitting slow wind. — [NOAA SWPC](https://www.spaceweather.gov/phenomena/geomagnetic-storms)
- Bathtub basis: the Burton model is dDst*/dt = Q − Dst*/τ. That is a source term (the tap, Q ∝ V·Bs once V·Bs > 0.5 mV/m) minus exponential drainage (the drain, with τ ≈ 7.7 h in Burton 1975). O'Brien & McPherron (2000) made τ depend on V·Bs. — [Search summary of Burton 1975 / O'Brien & McPherron 2000 via Annales Geophysicae 2008](https://angeo.copernicus.org/articles/26/2543/2008/); [Berkeley Dst estimate page](https://sprg.ssl.berkeley.edu/dst_index/estimate.html)
- Dissent on the "ring" metaphor: Campbell argues no complete ring of current exists, calling it a "false name". This is a minority view. Standard sources (NOAA, ESA) use "ring current". — [science.gov ring current dst](https://www.science.gov/topicpages/r/ring+current+dst)

### Inferences (metaphor verdicts)
| Metaphor | Use? | Why / caveat |
|---|---|---|
| **Magnetic shield / bubble** for magnetosphere | Yes, with care | Accurate for deflecting most of the wind. **Misleading** if shown as a solid hard shell that "breaks". Render it as a translucent, flexible, comet-shaped surface that squashes. Never show it shattering or "Earth exposed". |
| **"The door opens" / "fields link up"** for southward Bz | Yes | Accurate in spirit: reconnection lets energy and plasma in. **Misleading** if drawn as a literal hole through which particles fly straight to the ground. Show field lines joining, then being swept tailward. Prefer the label "links up" over "breaks through". |
| **Opposite magnets snap together** | Yes (best intuitive hook) | Matches NOAA's "opposite the direction of Earth's field". Caveat: it is reconnection, not magnetic attraction pulling Earth. Keep it as an analogy line. |
| **Stretched rubber band** (tail stores energy) | Yes | Directly from ESA. Good for explaining why storms last hours and arrive in bursts. |
| **Bathtub: tap fills, drain empties** for SYM-H | Yes, strongly recommended | Faithful to the Burton equation. The tap is speed × southward field, and the drain sets the hours-long recovery. Explains why SYM-H keeps falling for hours after the slider moves and recovers slowly. |
| **Wind on a sail / pressure squeezes the bubble** for density & speed | Yes for magnetopause compression | Dynamic pressure ∝ density × speed² does squash the dayside. **Misleading** if it implies that pressure alone makes a big storm. A dense, fast wind with northward field gives a compressed but mostly quiet magnetosphere (Dst can even go slightly *positive* from the magnetopause current, per ESA's note that the magnetopause current contributes to Dst). |
| **"Radiation hitting Earth" / "solar wind reaches the ground"** | No | The solar wind does not reach the ground. Aurora is caused by magnetospheric particles hitting the upper atmosphere at about 100+ km. |
| **Ring current as "a donut of trapped particles"** | Yes | Consistent with ESA's 2 to 9 Re equatorial-plane geometry. |

### Gaps
- No peer-reviewed public-testing data on any of these metaphors was found. The verdicts above rest on physics accuracy, not audience testing.

---

## 3. How should each slider's effect be visible in 3D?

### Takeaway
Give each slider its own visual channel so effects can be told apart: **Bz → color and direction of the incoming field lines, plus dayside link-up flashes; speed → particle velocity and streak length; density → particle count and opacity, which together with speed squashes the magnetopause.** SYM-H appears only on the **ring-current torus** (glow and thickness) and the **aurora oval** (radius and brightness). The bathtub lag should be visible: the ring current should brighten over seconds, not jump instantly.

### Cited Findings
- Southward IMF links to Earth's field on the dayside; northward IMF does not, so the wind flows around. — [ESA](https://sci.esa.int/j/36211)
- The magnetopause standoff distance r0 shrinks as dynamic pressure rises (r0 ∝ Pdyn^(−1/6.6)) and as southward Bz increases (tanh term). — [Shue et al. 1998 via UCLA Russell bibliography](https://faculty.epss.ucla.edu/~ctrussell/russell_bib.html/papers/mpause_extreme/); [rbamlib docs](https://rbamlib.readthedocs.io/dev/models/mp.html)
- Shue shape: r = r0 (2/(1+cos θ))^α with flaring α = (0.58 − 0.007·Bz)(1 + 0.024 ln Pdyn). Southward Bz therefore makes the tail flare *wider*. — [Shue et al. 1998 via UCLA](https://faculty.epss.ucla.edu/~ctrussell/russell_bib.html/papers/mpause_extreme/)
- The Newell coupling function, dΦ/dt ∝ v^(4/3) B_T^(2/3) sin^(8/3)(θc/2), correlates strongly with SYM-H and AE. Speed matters more than field strength, and the clock angle (north vs south) sharply gates the effect. — [ChaosMagPy coupling_Newell docs](https://chaosmagpy.readthedocs.io/en/master/functions/chaosmagpy.coordinate_utils.coupling_Newell.html); [Borovsky 2022, Frontiers](https://www.frontiersin.org/journals/astronomy-and-space-sciences/articles/10.3389/fspas.2022.990789/pdf)
- The Burton injection is zero below V·Bs ≈ 0.5 mV/m. — [Annales Geophysicae 2008 / search summary](https://angeo.copernicus.org/articles/26/2543/2008/)

### Inferences: concrete encoding spec (implementable in r3f in a few hours)

**Solar wind particles (instanced points or `<Points>` with a custom shader)**
- **Speed slider**: particle velocity along the Sun-Earth axis, mapped linearly from about 300 to 1000+ km/s, plus motion-streak length (stretch points into short lines). Color stays neutral (pale yellow-white) so color stays reserved for magnetic direction.
- **Density slider**: number of visible particles (draw count over a preallocated buffer, roughly 1 to 50 cm⁻³ mapped to 500 to 8,000 instances) and overall opacity. Use log scaling, because density spans a decade or more.
- Particles approaching the bow shock should slow and deflect around it (cheap trick: radial push-away when inside a paraboloid). This shows the shield doing its job.

**IMF / Bz slider (the star of the show)**
- Draw 5 to 8 wavy field lines riding with the wind, each with a small arrowhead.
- Color is a **diverging** scale: northward is cool blue-teal, southward is hot orange-magenta, near zero is gray. Arrowheads point up for north and down for south. Use color plus arrow direction (redundant encoding for color-blind users).
- When Bz < 0, spawn **link-up flashes** at the dayside magnetopause nose (a small bright sprite or ring pulse). Flash rate and brightness scale with a Newell-like driver (speed^(4/3) × |Bz|^(2/3)), so "fast and south" visibly flashes more than "slow and south". Below a small threshold (about V·Bs < 0.5 mV/m, i.e. 400 km/s × 1.25 nT), show no flashes, matching Burton's threshold.
- Optional: after each flash, animate one Earth field line "peeling" from the dayside and sliding over the pole into the tail (lerp between precomputed curves). This is the ESA "drag" picture.
- When Bz > 0, field lines visibly drape around the bubble with no flashes, under the caption "Field matches Earth's — wind slides around."

**Magnetopause / bow shock (two nested translucent shells)**
- Build the shell from the Shue formula with r0 and α computed live from the slider-derived dynamic pressure (Pdyn [nPa] ≈ 1.67×10⁻⁶ · n[cm⁻³] · v[km/s]², proton-only approximation) and Bz. This is honest geometry at near-zero cost (parametric surface, rebuild the `BufferGeometry` or scale in a vertex shader).
- Draw a faint dashed ring at **6.6 Re (geostationary orbit, "where TV/weather satellites live")**. When the nose crosses inside it, highlight the ring ("Satellites now outside the shield"). This gives a concrete stake. In May 2024 this happened for about 6 hours.
- Bow shock: a second, wider, fainter shell at roughly 1.3 × r0 standoff. This is a visual rule of thumb, not a sourced number.

**Ring current (SYM-H output)**
- A torus in the equatorial plane between about 3 and 5 Re (ESA: 2 to 9 Re extent). Emissive intensity, tube thickness and a slow westward swirl (animated texture offset) scale with −SYM-H.
- Keep it nearly invisible at SYM-H > −30 nT. Map −50/−100/−250/−500 nT to clearly distinct glow steps.
- Animate toward the model value with a time constant (a visual "bathtub") instead of snapping. This shows the storm "building up".

**Aurora (output, derived from SYM-H)**
- Two emissive rings (shader on a thin annulus slightly above Earth's surface) around each magnetic pole. Set ring colatitude from a lookup tied to SYM-H using the NOAA G-scale latitudes (section 4). Brightness scales with the driver.
- Use green (557.7 nm oxygen) as the base color, adding red at the upper edge in big storms. This is a style choice consistent with how low-latitude storm aurora is commonly photographed; no source was fetched for it.
- Optionally pin 3 to 5 city markers (Oslo, Edinburgh, Chicago, Alabama, Florida, or judges' home cities) that light up when the oval reaches their latitude. This is the most relatable output.

**Earth & Sun**
- Earth's dipole field lines are drawn as soft white closed loops that get compressed on the dayside and stretched into a tail on the nightside. The Sun sits at the left edge. Distance is not to scale; label it "not to scale" in tiny text.

### Gaps
- No public-testing evidence was found for which 3D encodings laypeople read most accurately. The spec above is a design inference.
- The bow-shock-to-magnetopause ratio was not sourced (commonly around 1.3 standoff; verify with Farris & Russell 1994 if needed).

---

## 4. Quantitative relationships for honest visuals

### Takeaway
Three sourced relations make the visuals honest: (a) the Shue 1998 magnetopause formula (about 10 Re quiet, about 6 Re in a strong storm, below 6.6 Re in May 2024); (b) the NOAA G-scale aurora latitudes (G1 high latitudes → G5 about 40° geomagnetic); (c) the Gonzalez Dst storm classes (−50 / −100 / −250 nT). The Burton equation supplies the time behavior. The direct Dst-to-auroral-boundary formula is real (Yokoyama et al. 1998) but its exact coefficients were not verified.

### Cited Findings
- **Shue et al. 1998:** r0 = (10.22 + 1.29·tanh(0.184·(Bz + 8.14)))·Pdyn^(−1/6.6) Re, with Bz in nT and Pdyn in nPa. Flaring α = (0.58 − 0.007·Bz)(1 + 0.024·ln Pdyn). Shape r = r0(2/(1+cosθ))^α. Some sources write the tanh coefficient as 0.1849. — [UCLA Russell bib, Shue 1998](https://faculty.epss.ucla.edu/~ctrussell/russell_bib.html/papers/mpause_extreme/); [rbamlib](https://rbamlib.readthedocs.io/dev/models/mp.html); [EarthRef](https://earthref.org/ERR/22352)
- The Bz dependence of r0 has a slope break at Bz = 0, and r0 shrinks with increasing southward Bz. — [NASA ISTP Shue poster](https://pwg.gsfc.nasa.gov/istp/cloud_jan97/shue_poster.html)
- A quoted validity range for the fit is about −18 < Bz < 15 nT and 0.5 < Pdyn < 8.5 nPa. Attribution is unclear, so verify. — [Levitin seminar PDF](https://seminar.pgia.ru/archive/2010/2_fields/02-03_Levitin.pdf)
- **May 10–11 2024 (Gannon) storm:** dynamic pressure pushed the magnetopause inside geostationary orbit (6.6 Re) continuously for about 6 h (another paper says about 5.5 h). MHD models suggest it reached as low as about 3.3 Re. SYM-H peaked below −500 nT (about −518 nT), the second-largest of the space era. Intensified southward field of about 48 nT drove the main peak. — [Tulasi Ram et al. 2024, Space Weather (DOAJ)](https://doaj.org/article/c33b0ecfd1974adb84ec238176663bbc); [IAS repository](https://repository.ias.ac.in/141118); [Frontiers 2025](https://public-pages-files-2025.frontiersin.org/journals/astronomy-and-space-sciences/articles/10.3389/fspas.2025.1652705/pdf)
- The plasmasphere was compressed from about 44,000 km to about 9,600 km altitude in May 2024. — [Universe Today (secondary, reporting Nagoya Univ. study)](https://www.universetoday.com/articles/historic-may-2024-gannon-solar-storm-compressed-earths-plasmasphere)
- **NOAA G-scale (aurora latitude):** G1 (Kp 5): aurora "commonly visible at high latitudes (northern Michigan and Maine)", about 1,700 per cycle. G2 (Kp 6): "as low as New York and Idaho", typically 55° geomagnetic, about 600 per cycle. G3 (Kp 7): "Illinois and Oregon", typically 50°, about 200 per cycle. G4 (Kp 8, incl. 9−): "Alabama and northern California", typically 45°, about 100 per cycle. G5 (Kp 9): "Florida and southern Texas", typically 40°, about 4 per cycle. — [NOAA SWPC Scales Explanation](https://www.spaceweather.gov/noaa-scales-explanation)
- **Dst/SYM-H storm classes:** moderate −50 to −100 nT, intense −100 to −250 nT, super-storm below −250 nT. The intense threshold (≤ −100 nT) traces to Gonzalez et al. 1994; the −250 nT "superintense" threshold to later papers. — [Wikipedia: Geomagnetic storm](https://en.wikipedia.org/wiki/Geomagnetic_storm); [Gonzalez et al. 1994](https://zendy.io/title/10.1029/93ja02867)
- **Auroral boundary vs Dst:** Yokoyama et al. (1998), using 423 storms, found the oval's equatorward boundary (corrected magnetic latitude) decreases as peak Dst becomes more negative. Historical-aurora papers invert this with a fit reported as roughly Dst ≈ 12 − 2200·cos⁶Λ nT. **This coefficient form came from a search summary and was not verified against the paper.** — [arXiv 1903.08466](https://arxiv.org/pdf/1903.08466); [arXiv 1807.05186](https://arxiv.org/pdf/1807.05186)
- Equatorward expansion **saturates** at high activity. Xiong et al. 2014 (CHAMP field-aligned currents) found a roughly linear dependence on Dst/AE with leveling off at high activity. — [Annales Geophysicae 32, 609 (2014)](https://angeo.copernicus.org/articles/32/609/2014/); [arXiv 2405.08821](https://arxiv.org/pdf/2405.08821)
- Visual aurora boundary moves from about 51° to 44° corrected geomagnetic latitude as Dst goes from −100 to −400 nT. Visual luminosity can extend beyond the oval boundary. — [Zverev, PGIA seminar](https://seminar.pgia.ru/archive/2009/1_storm%5Cv_l_zverev__.pdf)
- **Burton equation:** dDst*/dt = Q − Dst*/τ. Q ≈ −4.4·(V·Bs − 0.5) nT/h (O'Brien & McPherron form), or −3.56·V·Bs in a 2009 ACE reanalysis, for V·Bs > 0.5 mV/m. τ = 7.7 h in Burton 1975, or τ = 2.40·exp(9.74/(4.69 + V·Bs)) h in O'Brien & McPherron 2000. — [Annales Geophysicae 2008](https://angeo.copernicus.org/articles/26/2543/2008/); [J. Astron. Space Sci. 2009 (DOAJ)](https://doaj.org/article/3848869f11bf4fa5bcbecd263901a32b); [Berkeley Dst estimate](https://sprg.ssl.berkeley.edu/dst_index/estimate.html)

### Inferences (worked numbers for the designer, computed from the formulas above)
- Shue r0 examples (my arithmetic):
  - Quiet (Bz = 0, Pdyn = 2 nPa, e.g. n ≈ 7, v ≈ 400): r0 ≈ 11.39 × 2^(−0.152) ≈ **10.3 Re**.
  - Moderate storm (Bz = −10, Pdyn = 5): tanh(0.184×(−1.86)) ≈ −0.33 → 9.80 × 5^(−0.152) ≈ **7.6 Re**.
  - Strong storm (Bz = −20, Pdyn = 20, e.g. n ≈ 20, v ≈ 770): 8.96 × 20^(−0.152) ≈ **5.7 Re**, inside geostationary orbit, consistent with May 2024.
  - Note that 20 nPa is outside the fit's quoted 8.5 nPa range. Clamp, or tag the visual as extrapolated.
- Dynamic pressure helper: Pdyn[nPa] ≈ 1.67e-6 × n[cm⁻³] × v[km/s]² (proton mass × n × v²; standard physics, not from a fetched source). Optionally multiply by about 1.1 to 1.2 for helium.
- Aurora-latitude lookup for the oval ring, built by combining NOAA G-scale latitudes with Dst classes. **This mapping is an inference:** G-scale is Kp-based, and Kp and SYM-H are related but not equivalent.
  - SYM-H > −30 nT: oval at about 65 to 67° magnetic latitude (quiet; typical oval, not sourced here).
  - −50 nT: about 60°
  - −100 nT: about 55 to 50° (Zverev: about 51° visual at −100)
  - −250 nT: about 47 to 45°
  - −400 to −500 nT: about 44 to 40° (Zverev: about 44° at −400; NOAA G5 40°)
  - Below −500: clamp at about 40° (saturation per Xiong 2014).
- Cross-check against the cos⁶ fit as reported (unverified): Λ = 50° → about −130 nT, 45° → about −260 nT, 40° → about −420 nT. That is roughly consistent with the lookup above, which gives some confidence the reported fit is approximately right.
- Use Burton (τ about 7.7 h) as the "visual bathtub" time constant when animating ring-current glow during historic replays. During slider play the ML output drives the target value, and the animation eases toward it. Do not present Burton as the model.
- Remember that geomagnetic latitude ≠ geographic latitude. North America sits about 10° higher in magnetic latitude than geographic, Europe less so. Place city markers on magnetic latitude, or put the oval in a dipole-tilted frame.

### Gaps
- Exact Yokoyama et al. 1998 coefficients were not retrieved (the PDF was not machine-readable here). Verify before quoting a formula on screen.
- No source gives a direct Kp ↔ SYM-H conversion. Any G-level badge computed from SYM-H should be labeled "approximate".
- Typical quiet solar-wind values (about 400 km/s, about 5 cm⁻³, |B| about 5 nT) were not sourced in this session. They are widely stated but need a citation (e.g., NASA or SWPC real-time solar wind page).

---

## 5. Communicating model uncertainty / "beyond training data" without clutter

### Takeaway
Show uncertainty in the **same visual channel** as the prediction, e.g. a soft band on the SYM-H gauge and a blurred, wider aurora edge. Add one plain-language "confidence" word, and a distinct "uncharted territory" state when sliders exceed the training range (2010–2026 extremes, which top out near the May 2024 −518 nT event). Research suggests the best display depends on audience and goal. Lay readers misread category thresholds and numeric ranges, and non-experts anchor on single numbers.

### Cited Findings
- Spiegelhalter, Pearson & Short (2011, *Science*): the best uncertainty visualization "depends closely on the objectives of the presenter, the context of communication, and the audience". Communicating deep uncertainty (incomplete knowledge) remains a challenge. — [Visualizing Uncertainty About the Future, Science 2011 (ADS)](https://ui.adsabs.harvard.edu/abs/2011Sci...333.1393S); [PDF](https://www.stat.berkeley.edu/users/aldous/157/Papers/spiegelhalter_visualizing.pdf)
- Candidate formats: fan charts, density strips, spaghetti plots, blurred icon arrays, and the "cone of uncertainty". Formal experimental evidence is limited. — [Spiegelhalter Cambridge talk](https://www.talks.cam.ac.uk/talk/index/38316/)
- Icon arrays help low-numeracy audiences by showing the denominator. Numerical ranges are harder for low-numeracy readers, and non-experts may misinterpret category thresholds. — [Bhatt et al., Uncertainty as a Form of Transparency (arXiv 2011.07586)](https://arxiv.org/pdf/2011.07586)
- Aurora users anchor on single predicted values (predicted Kp, CME arrival) despite their uncertainty. — [Millersville poster](https://www.millersville.edu/esci/files/swe20237.pdf)
- Aurora-chaser respondents preferred forecasts with explicit uncertainty language (non-representative sample). — [CPAESS initial survey](https://cpaess.ucar.edu/abstract-2026-sww/initial-survey-results-aurora-chasers-use-space-weather-forecasts-and-uncertainty)
- The strongest storm in the 2010–2026 window is May 2024, with SYM-H about −518 nT. — [Space Weather 2024 (DOAJ)](https://doaj.org/article/c33b0ecfd1974adb84ec238176663bbc)

### Inferences
- **Gauge band:** draw the predicted SYM-H as a needle or line, with a translucent band for the model interval (e.g. 80%). The band widens as sliders leave dense training regions.
- **3D echo:** make the aurora ring's equatorward edge soft and feathered, with feather width set by the interval, and give the ring current a slight shimmer or flicker when uncertainty is high. One encoding, no extra widgets.
- **One word, not a number:** "Confidence: High / Medium / Low", tied to interval width or distance from the training data.
- **Out-of-range state:** when any slider exceeds the max seen 2010–2026 (or the input combination is far from training data), tint the slider track past that point with a hatched "uncharted" zone. Show a single line: "Stronger than anything in our 2010–2026 data — the model is guessing." Optionally hatch the gauge region below about −520 nT the same way.
- **Real-storm ghost marker:** during replays, overlay the *observed* SYM-H as a faint dotted line next to the prediction. Judges can see the error directly, which builds more trust than a stated accuracy.
- Avoid showing a G-level badge as exact. Say "about G4 (severe)".

### Gaps
- No study was found that tests uncertainty displays specifically in 3D or interactive scientific apps for laypeople.

---

## 6. Plain-language labels and progressive disclosure

### Takeaway
Lead with everyday words and keep the technical term in small secondary text (for credibility with technical judges). NOAA's own language ("southward … opposite the direction of Earth's field", "ring of current around Earth") is the safest template. Use three layers: (1) one-glance labels on the scene, (2) a hover tooltip with a one-sentence why, (3) an optional "How it works" 4-step strip.

### Cited Findings
- NOAA phrasing: "southward directed solar wind magnetic field (opposite the direction of Earth's field)"; "a ring of westward current around Earth". — [NOAA SWPC](https://www.spaceweather.gov/phenomena/geomagnetic-storms)
- NOAA G-scale descriptors: Minor / Moderate / Strong / Severe / Extreme, with US-state aurora examples. — [NOAA Scales](https://www.spaceweather.gov/noaa-scales-explanation)
- ESA verbs: "connect", "drags", "stretches", "pour into the tail". — [ESA](https://sci.esa.int/j/36211)

### Inferences: label table
| Technical | Primary label (large) | Secondary (small) | Tooltip (one sentence) |
|---|---|---|---|
| IMF Bz (nT, southward) | **Solar wind's magnetic direction** with a North ↔ South toggle-slider | "Bz, nT" | "When the Sun's field points south — opposite Earth's — the two link up and energy pours in." |
| Solar wind speed | **Wind speed** | "km/s" | "Faster wind pushes harder and drives energy in faster." Add a fun conversion: 400 km/s ≈ Sun to Earth in about 4 days. |
| Proton density | **Wind thickness** (or "How crowded the wind is") | "particles per cm³" | "A denser wind squeezes Earth's magnetic bubble, but by itself rarely causes a big storm." |
| Dynamic pressure | **Push on Earth's bubble** | "nPa" | Shown only as the magnetopause moving. |
| Magnetopause | **Earth's magnetic bubble** (edge) | "magnetopause" | "Where Earth's magnetic field holds off the solar wind." |
| Bow shock | **Shock wave** | "bow shock" | "Where the supersonic wind suddenly slows, like water in front of a boat." (NOAA uses "plow" imagery.) |
| Reconnection | **Link-up flash** / "Fields connect" | "magnetic reconnection" | "Opposite fields snap together and open a path for energy." |
| Ring current | **Storm ring** / "Ring of electric current" | "ring current" | "Trapped charged particles circling Earth. The brighter it glows, the stronger the storm." |
| SYM-H (nT) | **Storm strength** (gauge reads downward: 0 = calm, −500 = historic) | "SYM-H, nT (more negative = stronger)" | "Measures how much the ring of current weakens Earth's magnetic field at the surface." |
| Dst classes | **Calm / Moderate / Intense / Super-storm** at −50 / −100 / −250 nT | "Gonzalez et al. 1994 classes" | — |
| NOAA G-scale | "≈ G3 Strong" badge | "NOAA scale, approx." | "G1 to G5, like hurricane categories." (Hurricane-category comparison is an inference.) |
| Auroral oval latitude | **Where you could see the aurora** with city markers | "geomagnetic latitude" | "In big storms the aurora slides toward the equator. In May 2024 it reached Florida-like latitudes." (NOAA G5: "as low as Florida and southern Texas".) |
| Geostationary orbit ring | **Satellite orbit (36,000 km)** | "6.6 Earth radii" | "If the bubble shrinks inside this line, satellites feel the raw solar wind." |

### Inferences: progressive disclosure
1. **Glance (always visible):** the 3D scene, three sliders with big plain labels, the storm-strength gauge with a calm-to-historic color ramp, and one dynamic headline sentence generated from state, e.g. "South-pointing field + fast wind → energy is getting in → Intense storm, aurora down to ~50°."
2. **Hover / tap:** tooltips from the table above. Hovering a 3D object (bubble, ring, flash) highlights its matching slider or gauge so cause and effect are linked.
3. **"How it works" (collapsed by default):** a 4-panel strip: Sun blows wind → bubble deflects it → south field links up (the door) → energy fills the storm ring like a bathtub, and aurora spreads south. Include one honest-caveat line: "Not to scale; real distances are 23,000× larger."
4. **Guided first run (about 20 s, skippable):** auto-play a quiet day, flip Bz to south (flashes appear), then raise speed (the ring glows). This teaches the single most important lesson, that **direction matters more than strength**, before judges touch anything.
5. **Replay mode:** a timeline scrubber for historic storms. Sliders animate on their own, and the observed SYM-H ghost line is drawn beside the prediction.

### Gaps
- No usability testing of these specific labels was found. They are derived from agency phrasing and physics accuracy.
