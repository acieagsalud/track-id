import { expect, test } from "@playwright/test";

test("search, sort, open a set and preview the playlist", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Demo mode")).toBeVisible();

  const search = page.getByRole("searchbox", { name: "Search sets" }).first();
  await search.fill("Solomun");
  await search.press("Enter");
  await expect(page).toHaveURL(/\/search\?q=Solomun/);
  await expect(page.getByRole("heading", { name: /Results for/ })).toBeVisible();

  // Newest is the default sort.
  const sort = page.getByRole("navigation", { name: "Sort results" });
  await expect(sort.locator('[aria-current="true"]')).toHaveText("Newest");
  await sort.getByRole("link", { name: "Oldest" }).click();
  await expect(page).toHaveURL(/sort=oldest/);

  await page.getByRole("link", { name: /Sputnik Club/ }).click();
  await expect(page).toHaveURL(/\/set\/264926/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Solomun");
  await expect(page.getByText(/^Tuk Tuk/)).toBeVisible();
  await expect(page.getByText("On Spotify").first()).toBeVisible();

  await page.getByRole("button", { name: "Save to Spotify" }).click();
  await expect(page.getByRole("status")).toContainText(
    /Demo: this would create “Solomun @ Sputnik Club/,
  );
});

test("flags unidentified tracks and unknown sets", async ({ page }) => {
  await page.goto("/set/113019");
  await expect(page.getByText("Unidentified").first()).toBeVisible();
  await expect(page.getByText("Partial tracklist")).toBeVisible();

  await page.goto("/set/999999999");
  await expect(page.getByRole("heading", { name: "Set not found" })).toBeVisible();
});
