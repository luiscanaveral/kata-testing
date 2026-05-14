import { test, expect } from "@playwright/test";

const API_BASE = process.env.API_URL || "http://localhost:8000";
const shortUrlPattern = new RegExp(`${API_BASE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/\\w+`);

test("@e2e page renders correctly with title and description", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toHaveText("URL Shortener");
  await expect(page.locator("p")).toHaveText("Paste a long URL to get a short one");
});

test("@e2e user can shorten a URL via the frontend", async ({ page }) => {
  const longUrl = "https://example.com/very/long/path?q=test";

  await page.goto("/");
  await page.fill('input[type="url"]', longUrl);
  await page.click('button[type="submit"]');

  await expect(page.locator("text=Short URL:")).toBeVisible({ timeout: 10000 });

  const shortUrl = await page.locator("a").textContent();
  expect(shortUrl).toMatch(shortUrlPattern);
});

test("@e2e shortened URL resolves to the original URL", async ({ page }) => {
  const longUrl = "https://example.com/resolve-test";

  await page.goto("/");
  await page.fill('input[type="url"]', longUrl);
  await page.click('button[type="submit"]');

  await expect(page.locator("text=Short URL:")).toBeVisible({ timeout: 10000 });

  const shortUrl = (await page.locator("a").textContent()) || "";
  const response = await page.request.get(shortUrl);
  expect(response.ok()).toBeTruthy();
  const data = await response.json();
  expect(data.long_url).toBe(longUrl);
});

test("@e2e shows error for invalid URL", async ({ page }) => {
  await page.goto("/");
  await page.fill('input[type="url"]', "not-a-url");
  await page.click('button[type="submit"]');

  await expect(page.locator('input[type="url"]')).toHaveAttribute("required", "");
});

test("@e2e shows error message on API failure", async ({ page }) => {
  await page.route("**/shorten", (route) =>
    route.fulfill({ status: 422, body: JSON.stringify({ detail: "Invalid URL" }) })
  );

  await page.goto("/");
  await page.fill('input[type="url"]', "https://example.com/fail");
  await page.click('button[type="submit"]');

  await expect(page.locator("text=Invalid URL")).toBeVisible({ timeout: 5000 });
});

test("@e2e button shows loading state during request", async ({ page }) => {
  await page.route("**/shorten", async (route) => {
    await new Promise((r) => setTimeout(r, 500));
    await route.fulfill({
      status: 200,
      body: JSON.stringify({
        short_url: `${API_BASE}/abc1234`,
        short_code: "abc1234",
        long_url: "https://example.com/loading",
      }),
    });
  });

  await page.goto("/");
  await page.fill('input[type="url"]', "https://example.com/loading");
  await page.click('button[type="submit"]');

  await expect(page.locator('button[type="submit"]')).toHaveText("Shortening...");
  await expect(page.locator('button[type="submit"]')).toBeDisabled();

  await expect(page.locator("text=Short URL:")).toBeVisible({ timeout: 5000 });
});

test("@e2e copy button is visible after shortening a URL", async ({ page }) => {
  await page.goto("/");
  await page.fill('input[type="url"]', "https://example.com/copy-test");
  await page.click('button[type="submit"]');

  await expect(page.locator("text=Copy")).toBeVisible({ timeout: 10000 });
});

test("@e2e copy button copies short URL to clipboard", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);

  await page.goto("/");
  await page.fill('input[type="url"]', "https://example.com/clipboard-test");
  await page.click('button[type="submit"]');

  await expect(page.locator("text=Copy")).toBeVisible({ timeout: 10000 });

  await page.click("text=Copy");
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboardText).toMatch(shortUrlPattern);
});

test("@e2e multiple URLs can be shortened sequentially", async ({ page }) => {
  await page.goto("/");

  const urls = [
    "https://example.com/first",
    "https://example.com/second",
    "https://example.com/third",
  ];

  for (const url of urls) {
    await page.fill('input[type="url"]', url);
    await page.click('button[type="submit"]');
    await expect(page.locator("text=Short URL:")).toBeVisible({ timeout: 10000 });

    const shortUrl = await page.locator("a").textContent();
    expect(shortUrl).toMatch(shortUrlPattern);
  }
});

test("@e2e result section has green success styling", async ({ page }) => {
  await page.goto("/");
  await page.fill('input[type="url"]', "https://example.com/styling-test");
  await page.click('button[type="submit"]');

  const resultBox = page.locator("p:has-text(\"Short URL:\")").locator("xpath=..");
  await expect(resultBox).toBeVisible({ timeout: 10000 });
  const bg = await resultBox.evaluate((el) => getComputedStyle(el).background);
  expect(bg).toContain("rgb(246, 255, 237)");
});

test("@e2e input placeholder shows example URL", async ({ page }) => {
  await page.goto("/");
  const input = page.locator('input[type="url"]');
  await expect(input).toHaveAttribute("placeholder", "https://example.com/very/long/url");
});

test("@e2e short URL link opens in new tab", async ({ page }) => {
  await page.goto("/");
  await page.fill('input[type="url"]', "https://example.com/target-test");
  await page.click('button[type="submit"]');

  const link = page.locator("a");
  await expect(link).toBeVisible({ timeout: 10000 });
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");
});
