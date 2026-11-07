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

const timeline = (page: Page) => page.getByRole("region", { name: "Timeline" });
const stormDots = (page: Page) => timeline(page).locator("button[aria-pressed]");
const heroValue = (page: Page) => page.getByTestId("hero-value");
const dial = (page: Page) => page.getByRole("slider", { name: "Storm intensity" });
const scrub = (page: Page) => page.getByRole("slider", { name: "Scrub playback time" });

/** Load the page and wait until the default storm (the hold-out) is fully loaded. */
async function openReady(page: Page) {
  await page.goto("/");
  await expect(stormDots(page)).toHaveCount(8);
  await expect(timeline(page).getByRole("button", { name: /hold-out/ })).toHaveAttribute("aria-pressed", "true");
  await expect(timeline(page).getByRole("button", { name: "Play" })).toBeEnabled();
  await expect(heroValue(page)).not.toHaveText(/^—/);
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
  test("loads without errors and renders the main pieces", async ({ page }) => {
    const errors = trackErrors(page);
    await openReady(page);

    await expect(page.getByRole("heading", { level: 1 })).toContainText("Dial-a-Storm");
    await expect(page.getByText(/^(FIXTURE DATA|PIPELINE)$/)).toBeVisible();
    await expect(page.locator("canvas").first()).toBeVisible();
    await expect(page.getByText("Could not load storm data")).toHaveCount(0);
    await expect(page.getByRole("region", { name: "What is happening" }).getByRole("heading")).not.toBeEmpty();
    await expect(dial(page)).toBeVisible();
    await expect(page.getByRole("img", { name: /Storm strength over time/ })).toBeVisible();
    await expect(page.getByText("How it works")).toBeAttached();
    await expect(page.locator("#honest-test")).toBeAttached();

    expect(errors).toEqual([]);
  });

  test("each storm can be selected and loads its data", async ({ page }) => {
    const errors = trackErrors(page);
    await openReady(page);

    const count = await stormDots(page).count();
    for (let i = 0; i < count; i++) {
      const dot = stormDots(page).nth(i);
      await dot.click();
      await expect(dot).toHaveAttribute("aria-pressed", "true");
      await expect(page.getByText("Could not load this storm.")).toHaveCount(0);
      await expect(heroValue(page)).not.toHaveText(/^—/);
    }

    // The arrows step through the same list.
    await stormDots(page).first().click();
    await timeline(page).getByRole("button", { name: "Next storm" }).click();
    await expect(stormDots(page).nth(1)).toHaveAttribute("aria-pressed", "true");
    await timeline(page).getByRole("button", { name: "Previous storm" }).click();
    await expect(stormDots(page).first()).toHaveAttribute("aria-pressed", "true");
    expect(errors).toEqual([]);
  });
});

test.describe("controls", () => {
  test("the dial changes the prediction and Reset restores it", async ({ page }) => {
    const errors = trackErrors(page);
    await openReady(page);

    // Move into the storm so the prediction is clearly non-zero.
    const max = Number(await scrub(page).getAttribute("max"));
    await scrub(page).fill(String(Math.round(max * 0.3)));
    const reset = page.getByRole("button", { name: "Reset" });
    await expect(reset).toBeDisabled();
    const baseline = await heroValue(page).innerText();

    await dial(page).focus();
    await page.keyboard.press("End");
    await expect(dial(page)).toHaveAttribute("aria-valuenow", "3");
    await expect(heroValue(page)).not.toHaveText(baseline);
    await expect(reset).toBeEnabled();

    await page.keyboard.press("Home");
    await expect(dial(page)).toHaveAttribute("aria-valuenow", "0.5");
    await expect(heroValue(page)).not.toHaveText(baseline);

    await reset.click();
    await expect(reset).toBeDisabled();
    await expect(dial(page)).toHaveAttribute("aria-valuenow", "1");
    await expect(heroValue(page)).toHaveText(baseline);
    expect(errors).toEqual([]);
  });

  test("fine-tune exposes the three driver sliders", async ({ page }) => {
    const errors = trackErrors(page);
    await openReady(page);

    await page.getByRole("button", { name: "fine-tune" }).click();
    for (const label of ["Southward Bz", "Wind speed", "Proton density"]) {
      await expect(page.getByLabel(label)).toBeVisible();
    }
    await page.getByLabel("Southward Bz").fill("2");
    await expect(dial(page)).toHaveAttribute("aria-valuenow", "2");
    await page.getByLabel("Proton density").fill("3");
    await expect(page.getByRole("button", { name: "Reset" })).toBeEnabled();
    expect(errors).toEqual([]);
  });

  test("playback plays, pauses, scrubs and restarts", async ({ page }) => {
    const errors = trackErrors(page);
    await openReady(page);

    const t = timeline(page);
    await t.getByRole("button", { name: "Restart" }).click();
    await expect(scrub(page)).toHaveValue("0");

    await t.getByRole("button", { name: "Play" }).click();
    await expect(t.getByRole("button", { name: "Pause" })).toBeVisible();
    await expect.poll(async () => Number(await scrub(page).inputValue())).toBeGreaterThan(0);
    await t.getByRole("button", { name: "Pause" }).click();
    const paused = await scrub(page).inputValue();
    await page.waitForTimeout(500);
    await expect(scrub(page)).toHaveValue(paused);

    await scrub(page).fill("100");
    await expect(scrub(page)).toHaveValue("100");
    await expect(heroValue(page)).not.toHaveText(/^—/);

    await t.getByRole("button", { name: "Restart" }).click();
    await expect(scrub(page)).toHaveValue("0");
    expect(errors).toEqual([]);
  });
});

test.describe("consequences", () => {
  test("impacts and the history ruler escalate with the dial", async ({ page }) => {
    const errors = trackErrors(page);
    await openReady(page);

    const panel = page.getByRole("region", { name: "Consequences" });
    await expect(panel).toBeVisible();
    for (const id of ["aurora", "grid", "satellites", "gps", "radio"]) {
      await expect(panel.getByTestId(`impact-${id}`)).toBeVisible();
    }
    await expect(page.getByTestId("history-ruler")).toBeVisible();

    const grid = panel.getByTestId("impact-grid");
    await dial(page).focus();
    await page.keyboard.press("Home");
    const gentle = Number(await grid.getAttribute("data-peak-level"));
    await expect(page.getByTestId("history-verdict")).toContainText("short of a Carrington");

    await page.keyboard.press("End");
    await expect.poll(async () => Number(await grid.getAttribute("data-peak-level"))).toBeGreaterThan(gentle);
    await expect(page.getByTestId("history-verdict")).toContainText("Carrington-class");

    // The live rows follow the cursor: scrubbing to the start of the window leaves the grid quiet.
    await scrub(page).fill("0");
    await expect(grid).toHaveAttribute("data-level", "0");
    expect(errors).toEqual([]);
  });
});
