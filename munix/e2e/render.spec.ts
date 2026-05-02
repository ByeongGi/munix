import { expect, test } from "@playwright/test";

test("renders the no-vault picker in a browser harness", async ({ page }) => {
  await page.goto("/test-harness.html");

  await expect(page.getByRole("heading", { name: /Munix/ })).toBeVisible();
  await expect(
    page.getByText("Choose a folder to use as your vault."),
  ).toBeVisible();
});

test("renders a mocked vault workspace", async ({ page }) => {
  await page.goto("/test-harness.html?scenario=vault");

  await expect(page.getByText("Welcome.md")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "munix-render-vault" }),
  ).toBeVisible();
  await expect(page.locator(".munix-window-shell")).toBeVisible();
});

test("marks missing recent vault entries as disabled", async ({ page }) => {
  await page.goto("/test-harness.html?scenario=closed-vault");

  const missingVault = page.getByRole("button", {
    name: /missing-munix-vault/,
  });

  await expect(missingVault).toBeVisible();
  await expect(missingVault).toBeDisabled();
  await expect(
    page.locator("span").filter({ hasText: /^missing$/ }),
  ).toBeVisible();
});
