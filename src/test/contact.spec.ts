import { test, expect } from "@playwright/test";

test.describe("contact page", () => {
  test("contact page renders with contact info", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/contact", { waitUntil: "domcontentloaded" });
    // The contact page has an email button and contact methods
    await expect(page.locator(".contact").first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.locator(".contact__methods").first()).toBeVisible({
      timeout: 30_000,
    });
  });

  test("contact page has a mailto link", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/contact", { waitUntil: "domcontentloaded" });
    const mailtoLink = page.locator('a[href^="mailto:"]').first();
    await expect(mailtoLink).toBeVisible({ timeout: 30_000 });
    const href = await mailtoLink.getAttribute("href");
    expect(href).toContain("mailto:");
  });

  test("contact page shows map or placeholder", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/contact", { waitUntil: "domcontentloaded" });
    // Either the map facade button or the placeholder should be visible
    const mapFacade = page.locator(".contact__map-facade").first();
    const mapPlaceholder = page.locator(".contact__placeholder").first();
    await expect(mapFacade.or(mapPlaceholder).first()).toBeVisible({
      timeout: 30_000,
    });
  });
});
