import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { source, destination, verifyFiles } from './parity.mjs';

const servers = [];
async function serve(root, port, token) {
  const child = spawn(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'),
    '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: root, env: { ...process.env, VITE_MAPBOX_ACCESS_TOKEN: token },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  servers.push(child);
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  const url = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 100; attempt++) {
    assert.equal(child.exitCode, null, `Vite stopped: ${output}`);
    try { if ((await fetch(url)).ok) return url; } catch { /* Starting up. */ }
    await new Promise(done => setTimeout(done, 100));
  }
  throw new Error(`Vite did not start: ${output}`);
}

async function capture(page, id) {
  const panel = page.getByTestId(id);
  await panel.waitFor({ state: 'visible' });
  return panel.evaluate(element => ({
    text: element.innerText,
    controls: Array.from(element.querySelectorAll('input,select,button')).map(control => ({
      tag: control.tagName, text: control.textContent,
      label: control.getAttribute('aria-label'), value: control.value,
      checked: control.checked, disabled: control.disabled,
    })),
    colors: Array.from(element.querySelectorAll('[style]')).map(node => node.getAttribute('style')),
    width: Math.round(element.getBoundingClientRect().width),
  }));
}

async function exercise(browser, url, viewport, mode) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  // Real Chromium/WebGL and the real application; deterministic external
  // services avoid requiring provider credentials or live rainfall changes.
  await page.route('**/*', async route => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.hostname === '127.0.0.1') return route.continue();
    if (mode === 'map' && requestUrl.pathname.includes('/styles/v1/')) {
      return route.fulfill({ json: { version: 8, sources: {}, layers: [
        { id: 'background', type: 'background', paint: { 'background-color': '#eef0ed' } },
      ] } });
    }
    return route.fulfill({ status: 503, body: 'Migration test: external service unavailable' });
  });
  try {
    await page.goto(`${url}/#map`);
    await page.getByRole('heading', { name: 'BahaRoute', exact: true }).waitFor();
    if (mode === 'missing-key') {
      const snapshot = await capture(page, 'config-incomplete');
      assert.equal(await page.getByTestId('map-container').count(), 0);
      assert.deepEqual(errors, []);
      return [snapshot];
    }
    await page.getByTestId('map-container').waitFor();
    // Map controls now collapse behind the menu at both viewport sizes.
    await page.getByTestId('controls-menu-button').click();
    if (mode === 'provider-failure') {
      const snapshot = await capture(page, 'error-message');
      await page.getByTestId('layers-button').click();
      const layers = await capture(page, 'layers-panel');
      assert.deepEqual(errors, []);
      return [snapshot, layers];
    }
    await page.getByTestId('loading-indicator').waitFor({ state: 'hidden' });
    await page.getByTestId('layers-button').click();
    await page.getByTestId('layer-checkbox-floodSusceptibility').check();
    await page.keyboard.press('Escape');
    await page.getByTestId('historical-explore').waitFor();
    assert.equal(await page.locator('canvas.mapboxgl-canvas').count(), 1);
    const snapshots = [await capture(page, 'historical-explore')];
    assert.equal(await page.getByTestId('ncr-high').innerText(), '708');
    await page.getByTestId('explore-area-select').selectOption('city');
    const cities = page.getByTestId('explore-city-select');
    const city = await cities.locator('option').nth(1).getAttribute('value');
    await cities.selectOption(city);
    await page.getByTestId('explore-city-summary').waitFor();
    snapshots.push(await capture(page, 'historical-explore'));
    await page.getByTestId('explore-area-select').selectOption('barangay');
    const barangays = page.getByTestId('explore-barangay-select');
    const barangay = await barangays.locator('option').nth(1).getAttribute('value');
    await barangays.selectOption(barangay);
    await page.getByTestId('explore-barangay-risk').waitFor();
    snapshots.push(await capture(page, 'historical-explore'));
    await page.getByTestId('explore-risk-select').selectOption('High');
    snapshots.push(await capture(page, 'historical-explore'));
    await page.getByTestId('breadcrumb-ncr').click();
    assert.equal(await cities.count(), 0);
    snapshots.push(await capture(page, 'historical-explore'));
    await page.getByTestId('layers-button').click();
    await page.getByTestId('map-context-nearby').check();
    snapshots.push(await capture(page, 'layers-panel'));
    await page.keyboard.press('Escape');
    assert.equal(await page.getByTestId('layers-button').getAttribute('aria-expanded'), 'false');
    await page.getByTestId('layers-button').click();
    await page.getByTestId('layer-checkbox-floodSusceptibility').uncheck();
    await page.keyboard.press('Escape');
    await page.getByTestId('route-search-panel').waitFor();
    await page.getByRole('combobox', { name: 'From', exact: true }).fill('PITX');
    await page.getByTestId('place-suggestions').getByRole('button').first().click();
    await page.getByRole('combobox', { name: 'To', exact: true }).fill('SM Mall of Asia');
    await page.getByTestId('place-suggestions').getByRole('button').first().click();
    await page.getByTestId('route-compare-panel').waitFor();
    snapshots.push(await capture(page, 'route-compare-panel'));
    const cards = page.locator('[data-testid^="route-card-"]');
    assert.ok(await cards.count() >= 1, 'Bundled PITX–MOA route is available offline');
    await cards.last().click();
    assert.equal(await cards.last().getAttribute('aria-checked'), 'true');
    snapshots.push(await capture(page, 'selected-route-status'));
    await page.getByRole('button', { name: 'Back to search', exact: true }).click();
    snapshots.push(await capture(page, 'route-search-panel'));
    assert.deepEqual(errors, [], 'No unhandled browser errors');
    return snapshots;
  } finally {
    await context.close();
  }
}

let browser;
try {
  console.log(`PASS: ${await verifyFiles()} application files have identical SHA-256 hashes.`);
  browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-webgl'] });
  for (const [index, mode] of ['map', 'missing-key', 'provider-failure'].entries()) {
    const token = mode === 'missing-key' ? '' : 'pk.migration-test';
    const sourceUrl = await serve(source, 5190 + index * 2, token);
    const targetUrl = await serve(destination, 5191 + index * 2, token);
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      const expected = await exercise(browser, sourceUrl, viewport, mode);
      const actual = await exercise(browser, targetUrl, viewport, mode);
      assert.deepEqual(actual, expected, `${mode} browser behavior must match at ${viewport.width}px`);
      console.log(`PASS: ${mode} source/destination browser parity at ${viewport.width}px.`);
    }
  }
} finally {
  await browser?.close();
  for (const child of servers) child.kill('SIGTERM');
}
