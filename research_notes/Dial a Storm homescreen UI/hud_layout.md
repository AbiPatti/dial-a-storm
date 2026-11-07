# UI/HUD Layout and Interaction Design for the Dial-a-Storm Homescreen

Scope: layout, hierarchy, typography, onboarding, controls, time series and severity display, mobile, and anti-patterns for a full-screen 3D science explainer with a HUD. The audience is non-expert judges who need to understand it in about 10 seconds. Everything here must be buildable in Tailwind/React within a few hours.

Note on sources: the NN/g, W3C, MDN, NOAA SWPC, Bret Victor and Refactoring UI material was fetched or seen in search results. The Apple HIG Materials page and Material 3 bottom-sheet page returned no body text, so the claims attributed to them are listed under Gaps rather than cited. Ciechanowski.com failed with a TLS error.

## 1. Information hierarchy over a 3D hero (one hero number vs many stats; progressive disclosure)

### Takeaway
Show one hero readout (NOAA G-tier plus the what-if SYM-H, phrased in plain language) and one primary action on first load. Demote the other ~6 stats to a "details" layer one click away, and keep it to two levels. Whatever is visible first tells the viewer what matters, so a 7-stat banner tells judges that everything matters equally, which in practice means nothing does.

### Cited Findings
- Progressive disclosure means showing "only the most important options initially" and offering specialized options on request. Its premise is that "the very fact that something appears on the initial display tells users that it's important." — [NN/g, Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/)
- Designs with more than two disclosure levels "typically have low usability because users often get lost." The control that reveals the advanced level must be clearly visible and labeled so it "set[s] clear expectations." — [NN/g, Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/)
- Staged (linear) disclosure "is useful when you can divide a task into distinct steps that have little interaction." It is a poor fit when steps are interdependent. — [NN/g, Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/)
- Dashboards should be an "at-a-glance, single-screen view." Length and 2D position are the most accurate cues for quantity. Color is best for making a single item pop ("a red dot will easily stand out in a conglomerate of blue dots"), and "color should not be used to communicate information about quantitative values or magnitude." — [NN/g, Dashboards: Preattentive](https://www.nngroup.com/articles/dashboards-preattentive/)
- Applying too many preattentive attributes at once "creates visual clutter, overwhelms the reader, and defeats the purpose of guiding their attention." — [The Data School](https://www.thedataschool.co.uk/yoan-caboste/what-are-pre-attentive-attributes-and-why-do-they-deserve-your-attention)
- Refactoring UI: "labels are a last resort." When a label is needed, de-emphasize it by making it smaller, lower in contrast and lighter in weight. Emphasize the important element by de-emphasizing whatever competes with it. — [Refactoring UI, "Labels are a last resort"](https://www.refactoringui.com/previews/labels-are-a-last-resort)
- Game UI practice: "prioritize essential information and hide non-essential elements," and use context-sensitive UI that appears only when needed (e.g., weapon stats appear only when switching weapons). Minimal HUDs must not hide critical information. — [Educative, Game UI design principles](https://www.educative.io/answers/game-ui-design-principles-and-component-types); [uxdesign.cc, diegesis theory](https://uxdesign.cc/understanding-ux-in-video-games-diegesis-theory-f59d5a94cbcf)
- Game UI taxonomy (Fagerholt and Lorentzon): diegetic (in the world and the story), spatial (in 3D space but not the story), meta (in the story but on the 2D screen), and non-diegetic (classic HUD). Non-diegetic UI is best reserved for cases where other forms would compromise legibility. Mixing diegetic and non-diegetic UI half-heartedly reads as "conflicted" (Far Cry 2 criticism). — [uxdesign.cc](https://uxdesign.cc/understanding-ux-in-video-games-diegesis-theory-f59d5a94cbcf); [Game Developer](https://www.gamedeveloper.com/design/user-interface-design-in-video-games)
- Bret Victor's explorable explanations: an explanation "can be read like normal text" and readers interact only if they want to go deeper. The author "holds up their end of the conversation" by providing structure. — [Bret Victor, Explorable Explanations](https://worrydream.com/ExplorableExplanations/)

### Inferences
- **Hero block (top-left, the only large type).** A G-tier chip (e.g., "G5 · EXTREME") next to a big number ("−412 nT"), with one plain-language subline such as "Aurora visible down to ~40° latitude (Florida)". The aurora latitude is the most relatable metric for non-experts, so it should be the hero's caption, not a separate stat.
- **Turn the remaining stats into one "Details" disclosure** (a chevron or "Show the numbers" link): observed SYM-H, delta vs history, peak what-if and vBs coupling. Keep the "BEYOND TRAINING DATA" warning always visible as a contextual badge, but render it only when it's true, attached to the hero (amber outline chip), not as a separate banner. That matches the game-HUD pattern of context-sensitive display.
- **Use spatial/diegetic labels in the 3D scene where they're cheap.** Small anchored captions like "Sun", "Solar wind", "Magnetic shield" and "Aurora" teach the causal chain without reading the HUD. Use drei `<Html>` if the scene uses react-three-fiber (not verified). This is the highest-leverage move for 10-second comprehension: the scene explains itself.
- **Suggested layout grid:** hero top-left; a compact control dock right (desktop) or bottom sheet (mobile); a timeline strip bottom-center that merges chart, scrubber and play. Leave the center third of the screen clear for the 3D hero.
- **Restraint test:** at most one saturated accent color on screen at a time, reserved for the current G-tier.

### Gaps
- I found no rigorous study giving an ideal number of simultaneous HUD stats. "One hero number plus a details layer" comes from progressive disclosure principles, not a measured threshold.
- Apple product pages, Stripe, Linear and the Tesla configurator were not fetched. Claims about their specific patterns (e.g., Tesla's single big price/range readout above the configurator) are from general familiarity and are not cited here.

## 2. Glassmorphism vs solid panels over busy 3D

### Takeaway
Use glass sparingly and make it heavy: high blur, fairly high fill opacity on a dark tint, plus a subtle 1px stroke. Body text below about 18.5px needs 4.5:1 contrast against the worst-case pixel behind it. Over a moving, glowing 3D scene, a near-opaque dark panel (about 70–85% opacity) with blur is the safe default.

### Cited Findings
- "Glassmorphism is best when utilized sparingly to create an illusion of depth." It suits overlays and menus over complex backgrounds. — [NN/g, Glassmorphism](https://www.nngroup.com/articles/glassmorphism/)
- "More background blur is better, especially with intricate backgrounds." Blur "must account for the many possible backgrounds on which the item may appear." Example from the article: 30% white with a 25px blur keeps background edges visible, while 100px blur blends them away. — [NN/g, Glassmorphism](https://www.nngroup.com/articles/glassmorphism/)
- Lower opacity reveals more background but reduces contrast. Add a low-opacity stroke to suggest thickness. Let users adjust transparency where feasible; otherwise ensure all glass elements meet WCAG. — [NN/g, Glassmorphism](https://www.nngroup.com/articles/glassmorphism/)
- WCAG 1.4.3 AA: 4.5:1 for normal text and 3:1 for large text (≥18pt ≈ 24px, or ≥14pt bold ≈ 18.5px bold). Thresholds are not rounded (4.499:1 fails). Background images that don't provide sufficient contrast are a failure (F83). Anti-aliased thin text looks fainter, so use stronger weights or higher contrast. — [W3C, Understanding SC 1.4.3](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)
- WCAG 1.4.11 covers non-text contrast for charts, graphs and UI components, with a 3:1 example. — [W3C, Understanding SC 1.4.3](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)

### Inferences
- **Tailwind recipe for HUD panels:** `bg-slate-950/75 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl`. Text should be `text-white` (primary) or `text-slate-300` (secondary, which is still ≥4.5:1 on near-black). Don't use `text-slate-500` or lower for anything meaningful.
- **Text placed directly over the scene (hero number, captions)** needs a scrim or text shadow, because the Sun and aurora glows produce bright pixels. Options: a radial gradient scrim behind the hero (`bg-gradient-to-br from-black/60 to-transparent`) or `drop-shadow-[0_1px_8px_rgba(0,0,0,0.8)]`. Large hero text (≥24px) only needs 3:1.
- **Check contrast against the brightest frame** (Sun glare, aurora at peak), not an average frame, since F83 applies to background images.
- **Fallback when transparency is reduced:** browsers expose a `prefers-reduced-transparency` media query (support varies), so consider swapping to opaque panels when it matches. Its support is not verified here, so see Gaps.

### Gaps
- Apple HIG Materials / Liquid Glass guidance (don't stack glass on glass; respect Reduce Transparency) could not be fetched. The page returned only a title, so this is unverified.
- Browser support status of `prefers-reduced-transparency` was not verified.

## 3. Typography for dashboards/HUDs

### Takeaway
One sans family (Geist or Inter) carrying all hierarchy through size and weight, plus `tabular-nums` (or Geist Mono / JetBrains Mono) for every live number so digits don't jitter during playback. Use tracked uppercase micro-labels at low contrast for units and labels. Keep it to 3–4 type sizes total.

### Cited Findings
- `font-variant-numeric: tabular-nums` makes "numbers... all of the same size, allowing them to be easily aligned like in tables" (OpenType `tnum`). It has been Baseline widely available since January 2020. Proportional digits are often the default, so tabular must be requested explicitly. — [MDN, font-variant-numeric](https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant-numeric)
- Labels should be de-emphasized (smaller, lower contrast, lighter weight). Data that is self-identifying through its format or units doesn't need a label. — [Refactoring UI](https://www.refactoringui.com/previews/labels-are-a-last-resort)
- WCAG large-text threshold: ≥24px regular or ≥18.5px bold gets the relaxed 3:1. Thin fonts may need more contrast. — [W3C](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)

### Inferences
- **Type scale (Tailwind):**
  - Hero number: `text-6xl md:text-7xl font-semibold tabular-nums tracking-tight`.
  - Tier chip: `text-sm font-bold uppercase tracking-wider`.
  - Captions and body: `text-sm md:text-base text-slate-200`.
  - Micro-labels: `text-[11px] uppercase tracking-[0.14em] text-slate-400 font-medium`. Use these only for labels, never values, and keep them ≥11px.
- **Units as de-emphasized suffixes:** "−412 <span class="text-slate-400 text-2xl">nT</span>". Units self-identify the value, so no "SYM-H:" label is needed in the hero. Give the jargon term in the details layer and in a tooltip.
- **Next.js:** `next/font` ships Geist and Geist Mono (the `geist` package) and Inter with zero layout shift. Apply `tabular-nums` globally to the HUD container.
- **Avoid** more than two weights per screen region, all-caps body text, and glow or text-shadow effects on small text.

### Gaps
- I found no authoritative source specifying "Inter/Geist + mono" pairings. That is common practice, not a cited guideline.

## 4. Guided first-run / storytelling

### Takeaway
Skip carousels and coach-mark tours. Instead, make the default state a single primary CTA ("▶ Watch the May 2024 Gannon superstorm") that plays a pre-loaded replay with 3–4 short narrative captions synced to playback milestones (CME launch → wind arrives → shield compresses → aurora spreads south). After the replay, hand off to "Now dial your own storm". Captions should be dismissible and have a persistent "Skip" control.

### Cited Findings
- NN/g: "avoid creating app onboarding whenever possible and instead spend your resources making the UI more usable." "Tutorials didn't improve task performance" in deck-of-cards research, and NN/g "don't recommend deck-of-cards onboarding." If one is used anyway, keep a highly visible Skip, few cards and one concept per card. — [NN/g, Mobile-App Onboarding](https://www.nngroup.com/articles/mobile-app-onboarding/)
- Onboarding is justified when features are "unique or unfamiliar." Coach marks are "often nice-to-have and not need-to-have." Interactive walkthroughs "enable users to learn by doing," and should be kept brief with a skip option. "It's often more effective to train users by showing them tips in context." — [NN/g, Mobile-App Onboarding](https://www.nngroup.com/articles/mobile-app-onboarding/)
- Bret Victor: reactive documents let readers "play with the premise and assumptions… and see the consequences update immediately." The barrier should be "extremely low — simply click and drag." — [Bret Victor](https://worrydream.com/ExplorableExplanations/)
- Nicky Case's explorables use prediction before reveal ("Give it your best guess"), small one-idea chunks, and narrative and humor to hold attention. — [Nicky Case, How To Remember Anything Forever-ish](https://ncase.me/remember/)
- Gannon storm facts usable in captions: peak SYM-H/Dst was about −412 nT around 03:00 UTC on 11 May 2024, the most negative since March 1989 / the strongest since 2003. Sources vary (Dst figures of −406 to −518 nT appear), so verify against the app's own OMNI/Kyoto data. — [arXiv 2411.12490](https://arxiv.org/html/2411.12490v2); [Wikipedia mirror, May 2024 solar storms](https://wiki.krisyotam.com/content/wikipedia_en_all_nopic_2026-03/May_2024_solar_storms)

### Inferences
- **Narrative captions beat coach marks here.** The judges' goal is understanding causality, not learning controls. Each caption should be one line, appear in a fixed lower-third slot, and stay roughly 3–5 seconds. Also highlight the relevant 3D element (e.g., pulse the magnetosphere) as the diegetic counterpart.
- **Script sketch:**
  1. "May 10, 2024: the Sun hurls billions of tons of plasma at Earth."
  2. "It hits 1 million km/h, with its magnetic field pointing south. That's the dangerous part."
  3. "Earth's magnetic shield buckles. Severity: G5, Extreme."
  4. "Auroras reach Florida. Now try it yourself →" (this pulses the sliders).
- **Prediction hook (Nicky Case):** before the replay, a one-tap question such as "Guess: how far south will the aurora reach?" This is optional and only worth it if time allows.
- **Persistence:** remember "intro seen" in localStorage, wrapped in try/catch. Always offer a "Replay story" link.

### Gaps
- No direct guidance was found from Ciechanowski (site fetch failed) on caption timing. The 3–5 second guidance is an inference.

## 5. Controls: self-explanatory sliders, presets, one primary CTA

### Takeaway
Sliders fit here because approximate values are fine. Label each in plain language with the physics term secondary. Show the live value above the track. Add 3 annotated zones (calm / typical storm / extreme) and a preset row ("Calm day", "Gannon 2024", "Halloween 2003", "Carrington 1859"). Have exactly one filled primary button.

### Cited Findings
- "Sliders work best when the specific value does not matter to the user, but an approximate value is good enough." The wider or denser the range, the harder precise selection gets. — [NN/g, Slider Design](https://www.nngroup.com/articles/gui-slider-controls/)
- "Any slider labels must be displayed above or beside the slider, rather than below it," so the thumb or finger doesn't hide them. — [NN/g, Slider Design](https://www.nngroup.com/articles/gui-slider-controls/)
- Sliders are hard on mobile and for users with motor difficulties. Offer tap or type alternatives where precision matters. — [NN/g, Slider Design](https://www.nngroup.com/articles/gui-slider-controls/)
- Reactive documents: "simply click and drag," with consequences updating immediately. — [Bret Victor](https://worrydream.com/ExplorableExplanations/)

### Inferences
- **Plain-language labels:**
  - "Magnetic tilt (Bz)", with track ends labeled "North = shielded" and "South = storm".
  - "Wind speed", with a km/s value plus a "×N typical" hint.
  - "Wind density", in protons/cm³.
  - Put the value above the track, right-aligned, in `tabular-nums`.
- **Annotated ticks:** a thin tri-color band under each track (calm / typical / extreme) using the same severity ramp as the G-scale, with ≤3 tiny text ticks.
- **Presets as chips above the sliders.** Selecting one sets all three sliders and auto-runs Simulate. The 8-storm list can become a horizontally scrollable chip row or a select, saving the large list's space.
- **One primary CTA:** if the model is fast, auto-simulate on slider release and drop the Simulate button. Otherwise make "Simulate" the only filled button (`bg-white text-black` or the accent color). Play, pause and restart become icon buttons on the timeline, and Reset becomes a ghost text link.
- **Live preview:** debounce slider changes (about 150ms) to update the 3D scene (wind particle speed and density, the magnetopause standoff) even before the full simulation runs. Immediate visual feedback is the "wow."

### Gaps
- No source fetched on annotated tick conventions specifically. The NN/g slider article explicitly doesn't cover ticks.

## 6. Compact time series and severity scale

### Takeaway
Merge the observed-vs-predicted chart, the scrub slider and the play controls into one bottom "timeline strip": a 64–96px-tall sparkline-style area chart where the playhead is the scrubber, with G-tier threshold bands drawn as faint horizontal zones. Use the official NOAA G1–G5 descriptors and aurora latitudes. Color is our own choice (NOAA defines none), so pick a perceptually ordered ramp and always pair it with text.

### Cited Findings
- NOAA G-scale (official):
  - G1 Minor (Kp 5, about 900 days per cycle).
  - G2 Moderate (Kp 6, aurora ~55°, NY/Idaho).
  - G3 Strong (Kp 7, ~50°, Illinois/Oregon).
  - G4 Severe (Kp 8 incl. 9-, ~45°, Alabama/N. California).
  - G5 Extreme (Kp 9, about 4 days per cycle, ~40°, Florida/S. Texas).
  - The page specifies no color coding.
  — [NOAA SWPC, Scales Explanation](https://www.spaceweather.gov/noaa-scales-explanation)
- Length and 2D position are the most accurate magnitude cues, and color should not encode magnitude alone. Don't rely on color alone because of color blindness. Avoid 3D chart effects. Gauges "consume a lot of precious space" and are "harder to interpret than linear graphs," so prefer linear bullet-style displays. — [NN/g, Dashboards: Preattentive](https://www.nngroup.com/articles/dashboards-preattentive/)
- WCAG 1.4.11 applies a 3:1 non-text contrast to chart graphics and UI components. — [W3C](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)

### Inferences
- **Timeline strip:** a full-width bottom bar (desktop: `inset-x-6 bottom-6`, max-w-4xl, centered). Its pieces:
  - Left: a play/pause icon and a speed toggle (1×/4×/16× chip).
  - Center: the chart, with observed as a solid white line and what-if as an accent-colored line or area. The playhead is a vertical line plus a draggable handle (an `<input type="range">` overlaid with an opacity-0 track works).
  - Right: the current timestamp in mono.
  - A legend inline at the line ends ("observed", "what-if") instead of a separate legend box (direct labeling).
- **Severity bands:** horizontal dashed lines at the SYM-H values corresponding to G-tiers (map via the app's own thresholds), labeled G3/G4/G5 at the right edge in micro-type.
- **Severity ramp:** a 5-step single-hue-to-hot ramp, for example:
  - G1 `#FDE68A` (amber-200)
  - G2 `#FBBF24` (amber-400)
  - G3 `#F97316` (orange-500)
  - G4 `#EF4444` (red-500)
  - G5 `#D946EF` (fuchsia-500), which echoes the aurora magenta.
  
  Always show the text "G4 · Severe". Keep the scene's aurora greens distinct from the UI ramp. A linear 5-segment bar (bullet-chart style) with the active segment lit is better than a gauge.
- **Run the project's dataviz skill validator** on the chosen ramp before shipping (the repo has a dataviz skill).

### Gaps
- No colorblind-validated G-scale palette exists from NOAA. The ramp above is a proposal and has not been validated.
- The SYM-H to G-tier mapping is not defined by NOAA (G-scale is Kp-based). The app must state its own mapping.

## 7. Mobile/responsive and reduced-motion/accessibility

### Takeaway
On phones, keep the 3D scene full-bleed, with the hero compact at the top and controls in a bottom sheet. The sheet's collapsed peek shows the timeline and the primary CTA, and expanding it reveals presets and sliders. Respect `prefers-reduced-motion` by slowing or freezing particle motion and camera moves, and swap auto-orbit for a static framing.

### Cited Findings
- `prefers-reduced-motion: reduce` detects a user setting to minimize non-essential motion. It exists for people with vestibular disorders, and "scaling or panning large objects are particularly likely to trigger symptoms." — [MDN, prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)
- Sliders are difficult on mobile and for users with less steady hands, so offer tap alternatives such as presets. — [NN/g, Slider Design](https://www.nngroup.com/articles/gui-slider-controls/)
- Slider labels go above, not below, so the finger doesn't cover them. — [NN/g, Slider Design](https://www.nngroup.com/articles/gui-slider-controls/)

### Inferences
- **Bottom sheet in Tailwind** without a library:
  - `fixed inset-x-0 bottom-0 rounded-t-3xl bg-slate-950/85 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]`, toggled between `translate-y-[calc(100%-9rem)]` (peek) and `translate-y-0`.
  - Use a drag handle (`w-10 h-1 rounded-full bg-white/30`) that also works as a tap target.
  - Use `md:` breakpoints to turn it into a right-side dock on desktop.
  - Vaul (shadcn Drawer) is a drop-in alternative if a library is acceptable.
- **Mobile hero:** `text-4xl` number plus tier chip; move the aurora caption under it. Hide "Details" behind a tap.
- **Touch targets** of ≥44px for icon buttons, and a thicker slider thumb (custom `accent-*` or a styled range).
- **Reduced motion:** `const reduce = useReducedMotion()` (framer-motion) or a `matchMedia` hook. With it, set particle speed to about 0.2×, disable camera auto-rotate and pulsing glows, and make captions fade instead of slide. Use Tailwind `motion-reduce:` and `motion-safe:` variants for CSS animations.
- **Basics:**
  - Make all controls real `<button>` and `<input type="range">` elements with `aria-label`s.
  - Put an `aria-live="polite"` region on the hero tier ("Storm level G4, Severe").
  - Show a visible focus ring (`focus-visible:ring-2 ring-white/70`).
  - Give the canvas `aria-hidden` plus a text summary.

### Gaps
- Material 3 bottom sheet guidelines page returned no content, so standard vs modal sheet guidance is not cited.

## 8. Common anti-patterns in data dashboards over 3D

### Takeaway
The current HUD shows the classic set: too many equally weighted numbers, multiple competing CTAs, a separate legend, chart and scrubber that belong together, glow and color used everywhere, and small low-contrast labels over a bright scene. Fix them by subtracting.

### Cited Findings
- Too many preattentive cues at once overwhelms and "defeats the purpose of guiding their attention." — [The Data School](https://www.thedataschool.co.uk/yoan-caboste/what-are-pre-attentive-attributes-and-why-do-they-deserve-your-attention)
- Avoid 3D chart effects, pie/donut charts and gauges. Use color for single-item emphasis and categories, not magnitude. — [NN/g, Dashboards: Preattentive](https://www.nngroup.com/articles/dashboards-preattentive/)
- "Overwhelming backgrounds can make it hard for users to focus on meaningful content and affect text readability." — [NN/g, Glassmorphism](https://www.nngroup.com/articles/glassmorphism/)
- Background images without sufficient text contrast are a WCAG failure (F83). Thin anti-aliased text appears fainter. — [W3C](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)
- Instructional onboarding "should not be used to supplement poor design." — [NN/g, Onboarding](https://www.nngroup.com/articles/mobile-app-onboarding/)
- Equal-weight label:value pairs give every piece of data the same importance. — [Refactoring UI](https://www.refactoringui.com/previews/labels-are-a-last-resort)
- A hybrid diegetic/non-diegetic HUD that isn't committed to reads as "conflicted." — [Game Developer](https://www.gamedeveloper.com/design/user-interface-design-in-video-games)

### Inferences
Priority fix list for the first 10 seconds, highest impact first. Each item is about an hour or less of work.
1. Replace the 7-stat banner with a hero (tier chip + number + aurora-latitude sentence) and a "Details" toggle.
2. Add one primary CTA, "▶ Watch the 2024 superstorm", that auto-plays the Gannon replay with 3–4 synced captions.
3. Add 3D scene labels for Sun / solar wind / shield / aurora.
4. Merge chart, scrubber and playback into a bottom timeline strip with G-tier bands.
5. Convert the storm list to preset chips and rewrite slider labels in plain language with calm/typical/extreme zones.
6. Unify panels to one glass style (`bg-slate-950/75 backdrop-blur-xl border-white/10`). Allow one accent color (the current tier) and remove other glows from UI chrome.
7. Apply `tabular-nums` to all numbers; set a minimum 11px label size and slate-300 or brighter for anything meaningful.
8. Mobile bottom sheet plus `prefers-reduced-motion` handling.

### Gaps
- No quantitative study found linking HUD stat count to comprehension time. The "10-second" target is a design goal, not an evidence-based benchmark.
