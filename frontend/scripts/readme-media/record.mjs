// Records the README GIFs from a running app, on a desktop and on a phone viewport.
//
//   1. Start the backend with an empty Data__Directory, then the frontend (pnpm dev, port 8080).
//   2. sqlite3 <Data__Directory>/trackarr.db < scripts/readme-media/seed.sql
//   3. node scripts/readme-media/record.mjs   (needs ffmpeg; writes ../docs/media/*.gif)
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium, devices } from "@playwright/test";

const BASE_URL = process.env.APP_URL ?? "http://127.0.0.1:8080";
const OUTPUT_DIR = resolve(import.meta.dirname, "../../../docs/media");

const PROFILES = {
  desktop: { options: { viewport: { width: 1280, height: 800 } }, gifWidth: 960 },
  mobile: { options: devices["iPhone 15"], gifWidth: 393 },
};

// Headless video has no pointer, so a dot follows the mouse and flashes on each click or tap.
const POINTER_SCRIPT = `
  window.addEventListener("DOMContentLoaded", () => {
    const dot = document.createElement("div");
    dot.style.cssText = "position:fixed;z-index:2147483647;width:22px;height:22px;margin:-11px 0 0 -11px;" +
      "border-radius:50%;background:rgba(255,255,255,.35);border:2px solid rgba(255,255,255,.9);" +
      "pointer-events:none;transition:transform .15s;left:-50px;top:-50px";
    document.body.appendChild(dot);
    const move = (x, y) => { dot.style.left = x + "px"; dot.style.top = y + "px"; };
    window.addEventListener("mousemove", (e) => move(e.clientX, e.clientY), true);
    window.addEventListener("pointerdown", (e) => {
      move(e.clientX, e.clientY);
      dot.style.transform = "scale(.6)";
      setTimeout(() => (dot.style.transform = "scale(1)"), 180);
    }, true);
  });
`;

async function press(page, locator, mobile) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  if (mobile) {
    await page.mouse.move(x, y);
    await page.waitForTimeout(250);
    await locator.tap();
  } else {
    await page.mouse.move(x, y, { steps: 18 });
    await page.waitForTimeout(250);
    await locator.click();
  }
  await page.waitForTimeout(900);
}

async function openDashboard(page) {
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  const whatsNew = page.getByRole("dialog", { name: "What's New" });
  if (await whatsNew.isVisible().catch(() => false))
    await page.keyboard.press("Escape");
  await page.getByTestId("tracker-card").first().waitFor();
}

const SCENARIOS = {
  async dashboard(page, mobile, ready) {
    await openDashboard(page);
    ready();
    await page.waitForTimeout(2200);
    if (mobile) {
      await page.mouse.wheel(0, 900);
      await page.waitForTimeout(1500);
      await page.mouse.wheel(0, -900);
      await page.waitForTimeout(800);
    }
    await press(page, page.getByTestId("dashboard-view-list"), mobile);
    await page.waitForTimeout(1600);
    await press(page, page.getByRole("button", { name: "Move Seedpool down" }), mobile);
    await page.waitForTimeout(1200);
    await press(page, page.getByRole("button", { name: "Move Seedpool up" }), mobile);
    await page.waitForTimeout(1000);
    await press(page, page.getByTestId("dashboard-view-cards"), mobile);
    await page.waitForTimeout(1800);
  },

  async snapshots(page, mobile, ready) {
    await openDashboard(page);
    ready();
    await page.waitForTimeout(800);
    await press(page, page.getByTestId("tracker-card").first().getByRole("link", { name: "View snapshots" }), mobile);
    await page.waitForTimeout(1200);
    await press(page, page.getByRole("radio", { name: "24 hours" }), mobile);
    await page.waitForTimeout(2000);
    await page.mouse.wheel(0, mobile ? 1400 : 600);
    await page.waitForTimeout(2200);
  },

  async plugins(page, mobile, ready) {
    await page.goto(`${BASE_URL}/plugins`, { waitUntil: "networkidle" });
    ready();
    await page.waitForTimeout(1800);
    await press(page, page.getByRole("button", { name: /Seedpool/ }).first(), mobile);
    await page.waitForTimeout(1200);
    if (mobile)
      await page.getByText("pluginId:").first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(2200);
  },
};

function toGif(video, gif, width, startSeconds) {
  execFileSync("ffmpeg", [
    "-loglevel", "error", "-y", "-ss", startSeconds.toFixed(2), "-i", video,
    "-vf", `fps=12,scale=${width}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`,
    "-loop", "0", gif,
  ]);
}

mkdirSync(OUTPUT_DIR, { recursive: true });
const browser = await chromium.launch();
const only = process.argv.slice(2);

for (const [name, run] of Object.entries(SCENARIOS)) {
  if (only.length > 0 && !only.includes(name))
    continue;

  for (const [profile, { options, gifWidth }] of Object.entries(PROFILES)) {
    const videoDir = mkdtempSync(join(tmpdir(), "trackarr-media-"));
    const startedAt = Date.now();
    let readyAt = startedAt;
    const context = await browser.newContext({
      ...options,
      colorScheme: "dark",
      recordVideo: { dir: videoDir, size: options.viewport },
    });
    await context.addInitScript(POINTER_SCRIPT);
    await context.addInitScript(() => localStorage.setItem("trackarr.dashboard.view-mode", JSON.stringify("cards")));
    const page = await context.newPage();
    // The video starts with the blank page and the first load; the GIF starts once the page is ready.
    await run(page, profile === "mobile", () => (readyAt = Date.now()));
    const video = await page.video().path();
    await context.close();

    const gif = join(OUTPUT_DIR, `${name}-${profile}.gif`);
    toGif(video, `${gif}.tmp.gif`, gifWidth, (readyAt - startedAt) / 1000);
    renameSync(`${gif}.tmp.gif`, gif);
    rmSync(videoDir, { recursive: true, force: true });
    console.log(`wrote ${gif}`);
  }
}

await browser.close();
