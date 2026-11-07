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

const controls = (page: Page) => page.getByRole("complementary", { name: "Storm controls" });
const stormButtons = (page: Page) => controls(page).locator("button[aria-pressed]");
const timeReadout = (page: Page) => page.getByRole("slider", { name: "Scrub playback time" });
const statValue = (page: Page, label: string) => page.getByText(label, { exact: true }).locator("xpath=following-sibling::div[1]");

/** Load the page and wait until the default storm (the hold-out) is fully loaded. */
async function openReady(page: Page) {
  await page.goto("/");
  await expect(stormButtons(page)).toHaveCount(8);
  await expect(stormButtons(page).filter({ hasText: "HOLD-OUT" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "▶ Simulate" })).toBeEnabled();
  await expect(statValue(page, "Peak what-if")).not.toHaveText(/^—/);
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
  test("loads without errors and renders the main sections", async ({ page }) => {
    const errors = trackErrors(page);
    await openReady(page);

    await expect(page.getByRole("heading", { level: 1 })).toContainText("Dial-a-Storm");
    await expect(page.getByText(/^(FIXTURE DATA|PIPELINE)$/)).toBeVisible();
    await expect(page.locator("canvas").first()).toBeVisible();
    await expect(page.getByText("Could not load storm data")).toHaveCount(0);
    await expect(page.getByRole("img").filter({ has: page.locator("path") }).first()).toBeVisible();
    await expect(page.getByText("How it works")).toBeAttached();
    await expect(page.locator("#honest-test")).toBeAttached();

    expect(errors).toEqual([]);
  });

  test("each storm can be selected and loads its data", async ({ page }) => {
    const errors = trackErrors(page);
    await openReady(page);

    const count = await stormButtons(page).count();
    for (let i = 0; i < count; i++) {
      const button = stormButtons(page).nth(i);
      await button.click();
      await expect(button).toHaveAttribute("aria-pressed", "true");
      await expect(controls(page).getByText("Could not load this storm.")).toHaveCount(0);
      await expect(statValue(page, "Peak what-if")).not.toHaveText(/^—/);
    }
    expect(errors).toEqual([]);
  });
});

test.describe("controls", () => {
  test("solar-wind sliders change the prediction and Reset restores it", async ({ page }) => {
    const errors = trackErrors(page);
    await openReady(page);

    const reset = controls(page).getByRole("button", { name: "Reset" });
    const peak = statValue(page, "Peak what-if");
    await expect(reset).toBeDisabled();
    const baseline = await peak.innerText();

    await controls(page).getByLabel("Southward Bz").fill("3");
    await controls(page).getByLabel("Wind speed").fill("1.5");
    await expect(reset).toBeEnabled();
    await expect(peak).not.toHaveText(baseline);
    await expect(page.getByText("BEYOND TRAINING DATA")).toBeVisible();

    await controls(page).getByLabel("Southward Bz").fill("0.5");
    await controls(page).getByLabel("Wind speed").fill("0.8");
    await controls(page).getByLabel("Proton density").fill("0.5");
    await expect(peak).not.toHaveText(baseline);

    await reset.click();
    await expect(reset).toBeDisabled();
    await expect(peak).toHaveText(baseline);
    expect(errors).toEqual([]);
  });

  test("playback plays, pauses, scrubs and restarts", async ({ page }) => {
    const errors = trackErrors(page);
    await openReady(page);

    const scrub = timeReadout(page);
    await controls(page).getByRole("button", { name: "Restart" }).click();
    await expect(scrub).toHaveValue("0");

    await controls(page).getByRole("button", { name: "Play" }).click();
    await expect(controls(page).getByRole("button", { name: "Pause" })).toBeVisible();
    await expect.poll(async () => Number(await scrub.inputValue())).toBeGreaterThan(0);
    await controls(page).getByRole("button", { name: "Pause" }).click();
    const paused = await scrub.inputValue();
    await page.waitForTimeout(500);
    await expect(scrub).toHaveValue(paused);

    await scrub.fill("100");
    await expect(scrub).toHaveValue("100");
    await expect(statValue(page, "What-if SYM-H")).not.toHaveText(/^—/);

    await controls(page).getByRole("button", { name: "Restart" }).click();
    await expect(scrub).toHaveValue("0");

    await controls(page).getByRole("combobox").selectOption("48");
    await expect(controls(page).getByRole("combobox")).toHaveValue("48");

    await page.getByRole("button", { name: "▶ Simulate" }).click();
    await expect(controls(page).getByRole("button", { name: "Pause" })).toBeVisible();
    expect(errors).toEqual([]);
  });
});
