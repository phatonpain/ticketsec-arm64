#!/usr/bin/env node
/**
 * Phase 4 QA — Honesty matrix screenshots + 60-second offline EventLog silence test.
 *
 * Captures live / cached / offline states for the 5 primary views and proves the
 * EventLog does not fabricate entries while the API stays unreachable.
 */
import { Builder, Key } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';
import { mkdir, writeFile } from 'fs/promises';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROOF_DIR = join(__dirname, '..', 'qa', 'proof');

const CHROME_BIN = 'C:/Users/crust/.cache/puppeteer/chrome/win64-150.0.7871.24/chrome-win64/chrome.exe';
const CHROMEDRIVER_PATH = 'D:/chromedriver/win64-150.0.7871.24/chromedriver-win64/chromedriver.exe';

const VIEWS = [
  ['dashboard', 'Dashboard'],
  ['detections', 'Detections'],
  ['threat-analytics', 'ThreatAnalytics'],
  ['model-registry', 'ModelRegistry'],
  ['system-health', 'SystemHealth'],
];

const FABRICATION_PATTERNS = [
  /API reachable/i,
  /API connection restored/i,
  /Inference OK/i,
  /Classification failed/i,
  /Cached performance and classification data loaded/i,
  /Cached ticket snapshot loaded/i,
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForStatus(driver, text, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const pill = await driver.findElement({ css: 'header div[role="button"][tabindex="0"]' });
      const label = await pill.getText();
      if (label.includes(text)) return;
    } catch {}
    await sleep(500);
  }
  throw new Error(`Timed out waiting for status "${text}"`);
}

async function screenshot(driver, name) {
  const file = join(PROOF_DIR, `${name}.png`);
  const data = await driver.takeScreenshot();
  await writeFile(file, data, 'base64');
  console.log(`  screenshot: ${file}`);
  return file;
}

async function openNotifications(driver) {
  const bell = await driver.findElement({ css: 'button[aria-label^="Notifications"]' });
  await bell.click();
  await sleep(400);
}

async function closeNotifications(driver) {
  await driver.actions().sendKeys(Key.ESCAPE).perform();
  await sleep(300);
}

async function readNotificationEntries(driver) {
  const panel = await driver.findElement({ xpath: "//span[text()='Notifications']/following::div[1]" });
  const text = await panel.getText();
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  // The header is "Notifications\nX events"; entries follow.
  const entries = lines.slice(2);
  return { countText: lines[1] || '', entries };
}

function fabricatedCount(entries) {
  return entries.filter(e => FABRICATION_PATTERNS.some(re => re.test(e))).length;
}

function killBackend() {
  console.log('  killing backend on port 8000...');
  try {
    execSync(
      'powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | Where-Object { $_.OwningProcess -and $_.OwningProcess -ne 0 } | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }"',
      { stdio: 'ignore' }
    );
  } catch {}
}

async function main() {
  await mkdir(PROOF_DIR, { recursive: true });

  const options = new chrome.Options();
  options.setChromeBinaryPath(CHROME_BIN);
  options.addArguments(
    '--window-size=1366,768',
    '--force-device-scale-factor=1',
    '--hide-scrollbars',
    '--headless=new',
  );
  const service = new chrome.ServiceBuilder(CHROMEDRIVER_PATH);
  const driver = await new Builder().forBrowser('chrome').setChromeOptions(options).setChromeService(service).build();

  const proof = {
    live: [],
    cached: [],
    offline: [],
    silence: { before: null, after: null, fabricatedBefore: 0, fabricatedAfter: 0, passed: false },
  };

  try {
    // 1. LIVE — navigate each view and wait for the green LIVE pill.
    console.log('\n[live] navigating views with backend up');
    await driver.get('http://localhost:5173/#/dashboard');
    await waitForStatus(driver, 'LIVE');
    for (const [slug, label] of VIEWS) {
      await driver.get(`http://localhost:5173/#/${slug}`);
      await sleep(1200);
      proof.live.push(await screenshot(driver, `live-${label}`));
    }

    // 2. CACHED — kill backend, trigger a health refresh, wait for CACHED.
    console.log('\n[cached] backend killed, cache still warm');
    killBackend();
    await driver.get('http://localhost:5173/#/dashboard');
    await sleep(500);
    await driver.actions().sendKeys('r').perform();
    await waitForStatus(driver, 'CACHED');
    for (const [slug, label] of VIEWS) {
      await driver.get(`http://localhost:5173/#/${slug}`);
      await sleep(1200);
      proof.cached.push(await screenshot(driver, `cached-${label}`));
    }

    // 3. OFFLINE — force a full reload with backend still down (no warm cache).
    console.log('\n[offline] fresh load with backend down');
    await driver.get('http://localhost:5173/#/dashboard');
    await driver.navigate().refresh();
    await waitForStatus(driver, 'API OFFLINE');
    for (const [slug, label] of VIEWS) {
      await driver.get(`http://localhost:5173/#/${slug}`);
      await sleep(1200);
      proof.offline.push(await screenshot(driver, `offline-${label}`));
    }

    // 4. 60-second offline EventLog silence test.
    console.log('\n[silence] 60-second offline EventLog silence test');
    await driver.get('http://localhost:5173/#/dashboard');
    await driver.navigate().refresh();
    await waitForStatus(driver, 'API OFFLINE');
    await openNotifications(driver);
    const before = await readNotificationEntries(driver);
    proof.silence.before = before.entries;
    proof.silence.fabricatedBefore = fabricatedCount(before.entries);
    await screenshot(driver, 'silence-before');
    await closeNotifications(driver);

    console.log('  waiting 60 seconds...');
    await sleep(60000);

    await openNotifications(driver);
    const after = await readNotificationEntries(driver);
    proof.silence.after = after.entries;
    proof.silence.fabricatedAfter = fabricatedCount(after.entries);
    await screenshot(driver, 'silence-after');
    await closeNotifications(driver);

    const newEntries = after.entries.slice(before.entries.length);
    proof.silence.newEntries = newEntries;
    proof.silence.passed = proof.silence.fabricatedAfter === 0;

    console.log('\n=== Honesty matrix summary ===');
    console.log(`Live shots:    ${proof.live.length}`);
    console.log(`Cached shots:  ${proof.cached.length}`);
    console.log(`Offline shots: ${proof.offline.length}`);
    console.log(`Silence:       fabricated before=${proof.silence.fabricatedBefore} after=${proof.silence.fabricatedAfter} newEntries=${newEntries.length} passed=${proof.silence.passed}`);

    await writeFile(join(PROOF_DIR, 'honesty-matrix.json'), JSON.stringify(proof, null, 2));
    console.log(`wrote ${join(PROOF_DIR, 'honesty-matrix.json')}`);

    if (!proof.silence.passed) {
      throw new Error('EventLog silence test failed: fabricated entries detected after 60s offline');
    }
  } finally {
    await driver.quit();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
