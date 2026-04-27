/**
 * Phase 1 UAT — live production portal evidence capture.
 *
 * Goal: exercise the P1 user-facing surfaces (deal list view, filter bar,
 * New Deal form, audit log) against `portal.utstitle.com` and produce a
 * reviewable trail of screenshots, console logs, and network-failure notes
 * for operator review. Assertions are LIGHT by design — this test is
 * evidence-oriented, not regression-proof.
 *
 * Auth: Path B (cookie injection). Operator signs in once in their browser,
 * copies `CF_Authorization` cookie value from DevTools into `.env.local` as
 * `CF_AUTHORIZATION_COOKIE`, and Playwright injects that cookie into each
 * test context via `context.addCookies(...)` in `beforeEach`. Trade-off:
 * cookie expires ~24h; refresh when tests start 302-redirecting to login.
 *
 * Screenshots land under `.playwright-uat/screenshots/`. Findings summary
 * is written to `.playwright-uat/p1-findings.md` on completion.
 */

import { test, expect, type Page, type ConsoleMessage, type Request, type Response } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";

const SCREENSHOT_DIR = ".playwright-uat/screenshots";
const FINDINGS_PATH = ".playwright-uat/p1-findings.md";

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

type Finding = {
  area: string;
  kind: "console-error" | "http-error" | "assertion" | "navigation" | "note";
  message: string;
  url?: string;
  status?: number;
};

const findings: Finding[] = [];
const screenshotsCaptured: string[] = [];

function ssPath(name: string) {
  const filepath = path.join(SCREENSHOT_DIR, `${name}.png`);
  screenshotsCaptured.push(filepath);
  return filepath;
}

function attachListeners(page: Page, area: string) {
  page.on("console", (msg: ConsoleMessage) => {
    if (msg.type() === "error") {
      findings.push({ area, kind: "console-error", message: msg.text(), url: page.url() });
    }
  });
  page.on("requestfailed", (req: Request) => {
    findings.push({
      area,
      kind: "http-error",
      message: `Request failed: ${req.failure()?.errorText ?? "unknown"}`,
      url: req.url(),
    });
  });
  page.on("response", (res: Response) => {
    if (res.status() >= 400 && !res.url().includes("favicon")) {
      findings.push({
        area,
        kind: "http-error",
        message: `HTTP ${res.status()} ${res.statusText()}`,
        url: res.url(),
        status: res.status(),
      });
    }
  });
}

test.afterAll(async () => {
  const byArea: Record<string, Finding[]> = {};
  for (const f of findings) {
    byArea[f.area] ||= [];
    byArea[f.area].push(f);
  }

  const ssList = screenshotsCaptured
    .map((p) => `- \`${p.replaceAll("\\", "/")}\``)
    .join("\n");

  let md = `# Phase 1 UAT — Live Portal Findings

**Run:** ${new Date().toISOString()}
**Target:** https://portal.utstitle.com
**Auth:** CF Access Service Token (service-identity JWT)

---

## Screenshots captured

${ssList}

---

## Findings by area

`;

  if (Object.keys(byArea).length === 0) {
    md += "_No findings logged (no console errors, no HTTP failures >= 400, no assertion issues)._\n";
  } else {
    for (const [area, fs_] of Object.entries(byArea)) {
      md += `### ${area}\n\n`;
      for (const f of fs_) {
        const statusTag = f.status ? ` [${f.status}]` : "";
        const urlTag = f.url ? ` — \`${f.url}\`` : "";
        md += `- **${f.kind}**${statusTag}: ${f.message}${urlTag}\n`;
      }
      md += "\n";
    }
  }

  md += `\n---\n\n## Summary\n\n- Total findings: ${findings.length}\n- Screenshots: ${screenshotsCaptured.length}\n`;

  fs.writeFileSync(FINDINGS_PATH, md);
  console.log(`\n📋 Findings written to: ${FINDINGS_PATH}`);
  console.log(`📸 Screenshots: ${screenshotsCaptured.length} files in ${SCREENSHOT_DIR}`);
});

/**
 * Inject the user's CF_Authorization cookie into every test context before
 * the test runs. This pre-authenticates the browser context as the signed-in
 * user, so requests reach the app with a valid CF Access session.
 *
 * Cookie scope matches CF Access's real Set-Cookie behavior on sign-in:
 *   Domain=portal.utstitle.com, Path=/, HttpOnly, Secure, SameSite=Lax
 *
 * (SameSite=Lax is what CF Access actually uses for CF_Authorization — not
 * None. Confirmed via browser DevTools on a live sign-in.)
 */
async function seedCfAuthCookie(context: import("@playwright/test").BrowserContext) {
  const cookie = process.env.CF_AUTHORIZATION_COOKIE;
  if (!cookie) {
    // Config already guards this at load time; defensive double-check in case
    // someone bypasses the config.
    throw new Error("CF_AUTHORIZATION_COOKIE not set in environment");
  }
  await context.addCookies([
    {
      name: "CF_Authorization",
      value: cookie,
      domain: "portal.utstitle.com",
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    },
  ]);
}

test.describe.serial("Phase 1 UAT — portal.utstitle.com", () => {
  test.beforeEach(async ({ context }) => {
    await seedCfAuthCookie(context);
  });

  test("1. Deal list view loads via CF Access session cookie", async ({ page }) => {
    attachListeners(page, "1-deal-list");

    const response = await page.goto("/");
    expect(response, "navigation response present").not.toBeNull();
    const status = response!.status();
    findings.push({
      area: "1-deal-list",
      kind: "navigation",
      message: `GET / → ${status}`,
      url: page.url(),
      status,
    });
    expect(status, "GET / should return 200 (CF Access cookie injection should pre-authenticate the session)").toBe(200);

    await page.waitForLoadState("networkidle");

    const currentUrl = page.url();
    expect(currentUrl, "should NOT be redirected to CF Access login").not.toMatch(/cloudflareaccess\.com/);
    expect(currentUrl, "should be on portal.utstitle.com").toMatch(/portal\.utstitle\.com/);

    await page.screenshot({ path: ssPath("01-list-view-full"), fullPage: true });
    await page.screenshot({ path: ssPath("01-list-view-viewport") });

    const title = await page.title();
    findings.push({
      area: "1-deal-list",
      kind: "note",
      message: `document.title = "${title}"`,
    });
    expect(title, "page title should match updated metadata (no 'prototype' suffix)").toMatch(/NPR Dashboard/);
    expect(title, "banner removal cleanup should have dropped '(prototype)' from title").not.toContain("(prototype)");

    const header = page.getByRole("banner");
    await expect(header, "AppHeader should render").toBeVisible();

    const bodyText = await page.locator("body").innerText();
    const hasPrototypeBanner = bodyText.includes("PROTOTYPE — mock data only");
    if (hasPrototypeBanner) {
      findings.push({
        area: "1-deal-list",
        kind: "assertion",
        message: "Stale PROTOTYPE banner is STILL VISIBLE — banner-removal fix may not have deployed yet",
      });
    }
    expect(hasPrototypeBanner, "prototype banner should be gone post-cleanup").toBe(false);

    const newDealVisible = await page
      .getByRole("link", { name: /new deal/i })
      .or(page.getByRole("button", { name: /new deal/i }))
      .first()
      .isVisible()
      .catch(() => false);
    findings.push({
      area: "1-deal-list",
      kind: "note",
      message: `"New Deal" CTA visible: ${newDealVisible}`,
    });
  });

  test("2. Filter bar — presence + interaction", async ({ page }) => {
    attachListeners(page, "2-filters");

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await page.screenshot({ path: ssPath("02-filter-bar-before"), fullPage: true });

    // Try to toggle "Needs me"
    const needsMe = page
      .getByRole("button", { name: /needs me/i })
      .or(page.getByText(/needs me/i));
    const needsMeCount = await needsMe.count();
    findings.push({
      area: "2-filters",
      kind: "note",
      message: `"Needs me" filter element count: ${needsMeCount}`,
    });

    if (needsMeCount > 0) {
      await needsMe.first().click();
      await page.waitForLoadState("networkidle");
      await page.screenshot({ path: ssPath("02-filter-needs-me-on"), fullPage: true });
      const urlAfter = page.url();
      findings.push({
        area: "2-filters",
        kind: "note",
        message: `URL after Needs-me click: ${urlAfter}`,
      });
    }

    // Explore track filter popover
    const trackFilter = page
      .getByRole("button", { name: /track/i })
      .or(page.locator('button:has-text("Track")'));
    const tfCount = await trackFilter.count();
    findings.push({
      area: "2-filters",
      kind: "note",
      message: `Track filter element count: ${tfCount}`,
    });

    if (tfCount > 0) {
      await trackFilter.first().click().catch(() => {});
      await page.waitForTimeout(500);
      await page.screenshot({ path: ssPath("02-filter-track-popover"), fullPage: true });
      await page.keyboard.press("Escape");
    }

    await page.screenshot({ path: ssPath("02-filter-bar-final"), fullPage: true });
  });

  test("3. New Deal form — navigate + snapshot + partial fill", async ({ page }) => {
    attachListeners(page, "3-new-deal");

    const resp = await page.goto("/deal/new");
    const status = resp?.status() ?? 0;
    findings.push({
      area: "3-new-deal",
      kind: "navigation",
      message: `GET /deal/new → ${status}`,
      status,
    });
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: ssPath("03-new-deal-initial"), fullPage: true });

    // Check accordion sections
    const fileBasics = await page.getByText(/file basics/i).count();
    const propertyDetails = await page.getByText(/property details/i).count();
    const financialsDates = await page.getByText(/financials/i).count();
    findings.push({
      area: "3-new-deal",
      kind: "note",
      message: `Accordion sections found — File basics: ${fileBasics}, Property details: ${propertyDetails}, Financials: ${financialsDates}`,
    });

    // Try opening track select if present
    const trackSelect = page
      .getByRole("combobox", { name: /track/i })
      .or(page.locator('[role="combobox"]').first());
    if (await trackSelect.count() > 0) {
      await trackSelect.first().click().catch(() => {});
      await page.waitForTimeout(500);
      await page.screenshot({ path: ssPath("03-new-deal-track-dropdown"), fullPage: true });
      await page.keyboard.press("Escape");
    }

    // Capture form in default state (no fill, to avoid creating test rows on first run)
    await page.screenshot({ path: ssPath("03-new-deal-form-state"), fullPage: true });

    // Verify Create Deal button present
    const createBtn = page.getByRole("button", { name: /create deal/i });
    const createBtnVisible = await createBtn.first().isVisible().catch(() => false);
    findings.push({
      area: "3-new-deal",
      kind: "note",
      message: `"Create Deal" button visible: ${createBtnVisible}`,
    });
  });

  test("4. Deal creation + audit trail (optional — creates a UAT-tagged row)", async ({ page }) => {
    attachListeners(page, "4-create-audit");

    const uatTag = `UAT-${new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-")}`;
    await page.goto("/deal/new");
    await page.waitForLoadState("networkidle");

    // Attempt fill — if selectors don't match current UI, test fails gracefully
    // with evidence captured.
    try {
      // Track select (first combobox in form)
      const firstCombobox = page.locator('[role="combobox"]').first();
      if (await firstCombobox.count() > 0) {
        await firstCombobox.click();
        await page.waitForTimeout(300);
        // Try TE option
        const teOption = page.getByRole("option", { name: /title & escrow|\bTE\b/i }).first();
        if (await teOption.count() > 0) {
          await teOption.click();
          await page.waitForTimeout(300);
        } else {
          await page.keyboard.press("Escape");
        }
      }

      // Title / Property address / name fields — try common labels
      const titleField = page
        .getByRole("textbox", { name: /title|property address|deal/i })
        .first();
      if (await titleField.count() > 0) {
        await titleField.fill(`${uatTag} — automated deal creation test`);
      }

      await page.screenshot({ path: ssPath("04-form-filled-attempt"), fullPage: true });

      // DO NOT submit on first run — capture the filled state as evidence.
      // Submission lives in a follow-up UAT run once selectors are confirmed.
      findings.push({
        area: "4-create-audit",
        kind: "note",
        message: `UAT run NOT submitted — filled form captured as evidence. UAT tag: ${uatTag}`,
      });
    } catch (err) {
      findings.push({
        area: "4-create-audit",
        kind: "assertion",
        message: `Form interaction error: ${(err as Error).message}`,
      });
      await page.screenshot({ path: ssPath("04-form-interaction-error"), fullPage: true });
    }
  });

  test("5. Existing deal detail — audit tab evidence (if any deal exists)", async ({ page }) => {
    attachListeners(page, "5-audit-tab");

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Try to click the first deal row if any exist
    const firstRow = page.locator("table tbody tr, [role=row]").first();
    const rowCount = await firstRow.count();
    findings.push({
      area: "5-audit-tab",
      kind: "note",
      message: `Deal rows visible on list: ${rowCount}`,
    });

    if (rowCount === 0) {
      await page.screenshot({ path: ssPath("05-empty-state"), fullPage: true });
      findings.push({
        area: "5-audit-tab",
        kind: "note",
        message: "No deals exist yet — audit-tab test skipped (expected on a fresh environment)",
      });
      return;
    }

    // Navigate into first deal
    try {
      await firstRow.click();
      await page.waitForLoadState("networkidle");
      await page.screenshot({ path: ssPath("05-deal-detail-default-tab"), fullPage: true });

      // Click audit tab
      const auditTab = page.getByRole("tab", { name: /audit/i });
      if (await auditTab.count() > 0) {
        await auditTab.click();
        await page.waitForTimeout(300);
        await page.screenshot({ path: ssPath("05-audit-tab"), fullPage: true });
      }
    } catch (err) {
      findings.push({
        area: "5-audit-tab",
        kind: "assertion",
        message: `Navigation/audit error: ${(err as Error).message}`,
      });
      await page.screenshot({ path: ssPath("05-audit-error"), fullPage: true });
    }
  });
});
