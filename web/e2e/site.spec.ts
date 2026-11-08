import { expect, test, type Page } from "@playwright/test";

/** Collect uncaught exceptions and console errors so every test can assert a clean page. */
function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
  });
  return errors;
}

const GUIDE_KEY = "dial-a-storm:guide-seen";
const ENTERED_KEY = "dial-a-storm:entered";
const landing = (page: Page) => page.getByRole("region", { name: "Welcome" });
const dials = (page: Page) => page.getByRole("region", { name: "Solar wind dials" });
const playback = (page: Page) => page.getByRole("region", { name: "Playback" });
const scrub = (page: Page) => page.getByRole("slider", { name: "Scrub playback time" });
const peak = (page: Page) => page.getByTestId("peak-whatif");
const stormChip = (page: Page) => page.getByRole("button", { name: /Change storm/ });
const catalogue = (page: Page) => page.getByRole("dialog", { name: "Storm catalogue" });
const warning = (page: Page) => dials(page).getByRole("alert");

/** Press a global shortcut with nothing focused (form fields keep their own keys). */
async function pressGlobal(page: Page, key: string) {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press(key);
}

/** Load the page (landing and guide already seen) and wait until the default storm is ready. */
async function openReady(page: Page) {
  await page.addInitScript(
    ([guide, entered]) => {
      window.localStorage.setItem(guide, "1");
      window.sessionStorage.setItem(entered, "1");
    },
    [GUIDE_KEY, ENTERED_KEY],
  );
  await page.goto("/");
  await expect(stormChip(page)).toContainText("Gannon");
  await expect(peak(page)).not.toHaveText(/^—/);
  await expect(dials(page).getByRole("button", { name: "Simulate from the start" })).toBeEnabled();
}

test.describe("static data", () => {
  test("every artifact listed in storms.json is served", async ({ request }) => {
    for (const path of ["/data/manifest.json", "/data/storms.json"]) {
      expect((await request.get(path)).status(), path).toBe(200);
    }
    const { storms } = await (await request.get("/data/storms.json")).json();
    expect(storms).toHaveLength(8);
    for (const s of storms as { id: string }[]) {
      for (const dir of ["storm_windows", "scenario_grid"]) {
        const res = await request.get(`/data/${dir}/${s.id}.json`);
        expect(res.status(), `${dir}/${s.id}`).toBe(200);
      }
    }
  });
});

test.describe("page", () => {
  test("loads without errors into the 3D scene with its HUD", async ({ page }) => {
    const errors = trackErrors(page);
    await openReady(page);

    await expect(page.getByRole("heading", { level: 1 })).toContainText("Dial-a-Storm");
    await expect(page.getByText(/^(FIXTURE DATA|PIPELINE)$/)).toBeVisible();
    await expect(page.locator("canvas").first()).toBeVisible();
    await expect(page.getByText("Could not load storm data")).toHaveCount(0);
    await expect(playback(page).getByRole("img").first()).toBeVisible();
    for (const name of ["Solar wind", "Earth", "Magnetopause", "Aurora"]) {
      await expect(page.getByRole("button", { name: `${name}: select` })).toBeVisible();
    }
    // The scene is the page: no document scroll.
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);
    // Opens at the observed peak of the storm, not at the quiet start of the window.
    expect(Number(await scrub(page).inputValue())).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });

  test("each storm can be selected from the catalogue and by keyboard", async ({ page }) => {
    const errors = trackErrors(page);
    await openReady(page);

    await stormChip(page).click();
    const count = await catalogue(page).getByRole("button").count();
    expect(count).toBe(8);
    await page.keyboard.press("Escape");
    for (let i = 0; i < count; i++) {
      await stormChip(page).click();
      const button = catalogue(page).getByRole("button").nth(i);
      const name = (await button.locator("span.truncate").first().innerText()).trim();
      await button.click();
      await expect(catalogue(page)).toHaveCount(0);
      await expect(stormChip(page)).toContainText(name);
      await expect(peak(page)).not.toHaveText(/^—/);
    }

    await expect(stormChip(page)).not.toContainText("loading");
    const before = await stormChip(page).getAttribute("aria-label");
    await page.keyboard.press("]");
    await expect(stormChip(page)).not.toHaveAttribute("aria-label", before ?? "");
    await page.keyboard.press("[");
    await expect(stormChip(page)).toHaveAttribute("aria-label", before ?? "");
    expect(errors).toEqual([]);
  });

  test("model & validation drawer shows the hold-out test and method", async ({ page }) => {
    const errors = trackErrors(page);
    await openReady(page);

    await page.getByRole("button", { name: "Model and validation" }).click();
    const drawer = page.getByRole("dialog", { name: "Model and validation" });
    await expect(drawer.locator("#honest-test")).toBeVisible();
    await expect(drawer.getByRole("img").first()).toBeVisible();
    await drawer.getByRole("tab", { name: "How it works" }).click();
    await expect(drawer.getByText("Teaching a machine to see a magnetosphere")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer).toHaveCount(0);
    await page.keyboard.press("m");
    await expect(drawer).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe("controls", () => {
  test("solar-wind dials change the prediction, flag extrapolation, and Reset restores it", async ({ page }) => {
    const errors = trackErrors(page);
    await openReady(page);

    const reset = dials(page).getByRole("button", { name: "Reset" });
    await expect(reset).toBeDisabled();
    const baseline = await peak(page).innerText();

    // Weaker driving keeps peak coupling inside the 2010–2019 training range.
    await dials(page).getByLabel("Southward Bz").fill("0.5");
    await dials(page).getByLabel("Wind speed").fill("0.8");
    await expect(reset).toBeEnabled();
    await expect(peak(page)).not.toHaveText(baseline);
    await expect(warning(page)).toHaveCount(0);

    await dials(page).getByLabel("Southward Bz").fill("3");
    await dials(page).getByLabel("Wind speed").fill("1.5");
    await dials(page).getByLabel("Proton density").fill("0.5");
    await expect(warning(page)).toContainText("BEYOND TRAINING DATA");
    await expect(peak(page)).not.toHaveText(baseline);

    await reset.click();
    await expect(reset).toBeDisabled();
    await expect(peak(page)).toHaveText(baseline);

    await dials(page).getByRole("button", { name: "Max" }).click();
    await expect(dials(page).getByLabel("Southward Bz")).toHaveValue("3");
    await page.keyboard.press("r");
    await expect(peak(page)).toHaveText(baseline);
    expect(errors).toEqual([]);
  });

  test("playback plays, pauses, scrubs, restarts and simulates", async ({ page }) => {
    const errors = trackErrors(page);
    await openReady(page);

    await playback(page).getByRole("button", { name: "Restart" }).click();
    await expect(scrub(page)).toHaveValue("0");

    await playback(page).getByRole("button", { name: "Play" }).click();
    await expect(playback(page).getByRole("button", { name: "Pause" })).toBeVisible();
    await expect.poll(async () => Number(await scrub(page).inputValue())).toBeGreaterThan(0);
    await playback(page).getByRole("button", { name: "Pause" }).click();
    const paused = await scrub(page).inputValue();
    await page.waitForTimeout(500);
    await expect(scrub(page)).toHaveValue(paused);

    await scrub(page).fill("100");
    await expect(scrub(page)).toHaveValue("100");
    await pressGlobal(page, "ArrowRight");
    await expect(scrub(page)).toHaveValue("104");

    await pressGlobal(page, "Home");
    await expect(scrub(page)).toHaveValue("0");

    await playback(page).getByRole("combobox", { name: "Replay duration" }).selectOption("48");
    await expect(playback(page).getByRole("combobox", { name: "Replay duration" })).toHaveValue("48");

    await dials(page).getByRole("button", { name: "Simulate from the start" }).click();
    await expect(playback(page).getByRole("button", { name: "Pause" })).toBeVisible();
    await pressGlobal(page, "Space");
    await expect(playback(page).getByRole("button", { name: "Play" })).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe("scene interaction", () => {
  test("selecting objects opens their details; Esc closes; labels toggle", async ({ page }) => {
    const errors = trackErrors(page);
    await openReady(page);

    await page.getByRole("button", { name: "Earth: select" }).click();
    const earth = page.getByRole("complementary", { name: "Earth details" });
    await expect(earth).toBeVisible();
    await expect(earth.getByText("What-if SYM-H now")).toBeVisible();
    await expect(earth.getByText(/^-?\d+/).first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(earth).toHaveCount(0);

    // Number keys select and fly to objects.
    await page.keyboard.press("3");
    const mp = page.getByRole("complementary", { name: "Magnetopause details" });
    await expect(mp).toBeVisible();
    await expect(mp.getByRole("status")).toContainText(/geostationary orbit/i);
    await page.keyboard.press("1");
    await expect(page.getByRole("complementary", { name: "Solar wind details" })).toContainText("km/s");
    await page.keyboard.press("4");
    await expect(page.getByRole("complementary", { name: "Aurora details" })).toContainText("°");
    await page.getByRole("button", { name: "Close details" }).click();
    await expect(page.getByRole("complementary", { name: /details$/ })).toHaveCount(0);

    const labelsButton = page.getByRole("button", { name: "Labels" });
    await labelsButton.click();
    await expect(labelsButton).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByRole("button", { name: "Earth: select" })).toHaveCount(0);
    await page.keyboard.press("l");
    await expect(page.getByRole("button", { name: "Earth: select" })).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe("landing", () => {
  test("scrolling dives into the storm and reveals the app", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/");
    await expect(landing(page)).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Dial-a-Storm/i);
    // The HUD is inert while the landing is up.
    await expect(page.getByRole("button", { name: "Model and validation" })).toHaveCount(0);

    await page.mouse.move(720, 450);
    for (let i = 0; i < 6; i++) await page.mouse.wheel(0, 300);
    await expect(landing(page)).toHaveCount(0, { timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Model and validation" })).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Guide" })).toBeVisible();

    // Same tab session: reloading skips straight to the app.
    await page.reload();
    await expect(stormChip(page)).toBeVisible();
    await expect(landing(page)).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("a small scroll springs back to the title", async ({ page }) => {
    await page.goto("/");
    await expect(landing(page)).toBeVisible();
    await page.mouse.move(720, 450);
    await page.mouse.wheel(0, 40);
    await page.waitForTimeout(1500);
    await expect(landing(page)).toBeVisible();
    await expect(page.getByRole("button", { name: "Model and validation" })).toHaveCount(0);
  });
});

test.describe("guide", () => {
  test("opens on the first visit, runs the superstorm demo, then stays closed", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/");
    await expect(landing(page)).toBeVisible();
    await page.getByRole("button", { name: "Enter Dial-a-Storm" }).click();
    await expect(landing(page)).toHaveCount(0, { timeout: 30_000 });
    const guide = page.getByRole("dialog", { name: "Guide" });
    await expect(guide).toBeVisible();
    await expect(peak(page)).not.toHaveText(/^—/);

    await guide.getByRole("button", { name: "Next" }).click();
    await guide.getByRole("button", { name: "Next" }).click();
    await guide.getByRole("button", { name: "Try the superstorm what-if" }).click();
    await expect(guide).toHaveCount(0);
    await expect(page.getByRole("complementary", { name: "Magnetopause details" })).toBeVisible();
    await expect(dials(page).getByLabel("Southward Bz")).toHaveValue("3");
    await expect(warning(page)).toContainText("BEYOND TRAINING DATA");
    await expect(playback(page).getByRole("button", { name: "Pause" })).toBeVisible();

    await page.reload();
    await expect(peak(page)).not.toHaveText(/^—/);
    await expect(guide).toHaveCount(0);
    await page.getByRole("button", { name: "Help" }).click();
    await expect(guide).toBeVisible();
    expect(errors).toEqual([]);
  });
});
