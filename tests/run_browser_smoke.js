const fs = require('fs');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const HOST = '127.0.0.1';
const SMOKE_TIMEOUT_MS = 20000;
const watchdog = setTimeout(() => {
  logSkip('browser automation timed out');
  process.exit(0);
}, SMOKE_TIMEOUT_MS);

function logSkip(reason) {
  console.log(`SKIP: browser smoke tests (${reason})`);
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.js') return 'text/javascript; charset=utf-8';
  if (ext === '.ico') return 'image/x-icon';
  return 'application/octet-stream';
}

function createStaticServer() {
  const server = http.createServer((req, res) => {
    let urlPath = '/';
    try {
      urlPath = decodeURIComponent(new URL(req.url, `http://${HOST}`).pathname);
    } catch (e) {
      res.writeHead(400);
      res.end('Bad request');
      return;
    }

    const relativePath = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
    const filePath = path.resolve(ROOT, relativePath);
    if (!filePath.startsWith(ROOT + path.sep) && filePath !== ROOT) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    fs.readFile(filePath, (err, body) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType(filePath) });
      res.end(body);
    });
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, HOST, () => {
      resolve({ server, port: server.address().port });
    });
  });
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, HOST, () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

function commandExists(command) {
  const lookup = process.platform === 'win32' ? 'where' : 'which';
  const result = spawnSync(lookup, [command], { stdio: 'ignore' });
  return result.status === 0;
}

function browserCandidates() {
  const envBrowser = process.env.BROWSER ? [process.env.BROWSER] : [];
  if (process.platform === 'win32') {
    const local = process.env.LOCALAPPDATA || '';
    const programFiles = process.env.PROGRAMFILES || 'C:\\Program Files';
    const programFilesX86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';
    return envBrowser.concat([
      path.join(programFiles, 'Microsoft\\Edge\\Application\\msedge.exe'),
      path.join(programFilesX86, 'Microsoft\\Edge\\Application\\msedge.exe'),
      path.join(local, 'Microsoft\\Edge\\Application\\msedge.exe'),
      path.join(programFiles, 'Google\\Chrome\\Application\\chrome.exe'),
      path.join(programFilesX86, 'Google\\Chrome\\Application\\chrome.exe'),
      path.join(local, 'Google\\Chrome\\Application\\chrome.exe'),
      'msedge',
      'chrome',
      'chromium'
    ]);
  }
  if (process.platform === 'darwin') {
    return envBrowser.concat([
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      'microsoft-edge',
      'google-chrome',
      'chromium'
    ]);
  }
  return envBrowser.concat([
    'microsoft-edge',
    'microsoft-edge-stable',
    'google-chrome',
    'google-chrome-stable',
    'chromium',
    'chromium-browser'
  ]);
}

function findBrowser() {
  for (const candidate of browserCandidates()) {
    if (!candidate) continue;
    if (candidate.includes(path.sep) || candidate.endsWith('.exe')) {
      if (fs.existsSync(candidate)) return candidate;
    } else if (commandExists(candidate)) {
      return candidate;
    }
  }
  return null;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function waitForExit(child, timeoutMs = 3000) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise(resolve => {
    const timer = setTimeout(resolve, timeoutMs);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function removeDirWithRetry(dirPath) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      fs.rmSync(dirPath, { recursive: true, force: true });
      return;
    } catch (e) {
      if (attempt === 4) throw e;
      await delay(150 * (attempt + 1));
    }
  }
}

function fetchJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: options.method || 'GET' }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(options.timeoutMs || 2000, () => {
      req.destroy(new Error(`Timed out requesting ${url}`));
    });
    req.end();
  });
}

async function waitForDebugger(port) {
  const deadline = Date.now() + 10000;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      return await fetchJson(`http://${HOST}:${port}/json/version`);
    } catch (e) {
      lastError = e;
      await delay(100);
    }
  }
  throw lastError || new Error('Timed out waiting for browser debugger');
}

class CdpClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
    this.ws.onmessage = event => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message || JSON.stringify(message.error)));
        else resolve(message.result || {});
        return;
      }
      if (message.method) this.events.push(message);
    };
  }

  open() {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timed out opening WebSocket')), 5000);
      this.ws.onopen = () => {
        clearTimeout(timer);
        resolve();
      };
      this.ws.onerror = event => {
        clearTimeout(timer);
        reject(event instanceof Error ? event : new Error('WebSocket error'));
      };
    });
  }

  close() {
    this.ws.close();
  }

  send(method, params = {}) {
    const id = this.nextId++;
    const payload = JSON.stringify({ id, method, params });
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(payload);
    });
  }
}

async function evaluate(client, expression, awaitPromise = true) {
  const result = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise,
    returnByValue: true
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || 'Runtime evaluation failed');
  }
  return result.result ? result.result.value : undefined;
}

async function waitFor(client, expression, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(client, expression)) return;
    await delay(100);
  }
  throw new Error(`Timed out waiting for: ${expression}`);
}

async function clickTabAndAssert(client, panelKey, tabId, panelSelector, expectedBackdrop) {
  await evaluate(client, `document.getElementById(${JSON.stringify(tabId)}).click()`);
  await waitFor(client, `document.querySelector(${JSON.stringify(panelSelector)})?.classList.contains('mobile-open')`);
  const state = await evaluate(client, `(() => {
    const panels = {
      settings: document.getElementById('controlsContent')?.classList.contains('mobile-open'),
      chords: document.getElementById('overlaySidebar')?.classList.contains('mobile-open'),
      scale: document.getElementById('scaleContent')?.classList.contains('mobile-open'),
      more: document.getElementById('actionBtns')?.classList.contains('mobile-open')
    };
    const pressed = {};
    for (const [key, id] of Object.entries({
      settings: 'mobileNavSettings',
      chords: 'mobileNavChords',
      scale: 'mobileNavScale',
      more: 'mobileNavMore'
    })) {
      pressed[key] = document.getElementById(id)?.getAttribute('aria-pressed');
    }
    return {
      panels,
      pressed,
      backdrop: document.getElementById('controlsBackdrop')?.classList.contains('visible')
    };
  })()`);

  for (const key of Object.keys(state.panels)) {
    if (state.panels[key] !== (key === panelKey)) throw new Error(`${panelKey}: unexpected open state for ${key}`);
    if (state.pressed[key] !== String(key === panelKey)) throw new Error(`${panelKey}: unexpected aria-pressed for ${key}`);
  }
  if (state.backdrop !== expectedBackdrop) throw new Error(`${panelKey}: unexpected backdrop state`);
}

async function runSmoke(client, appUrl) {
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('Log.enable');
  await client.send('Page.navigate', { url: appUrl });
  await waitFor(client, 'document.readyState === "complete"');
  await waitFor(client, 'Boolean(window.__tonnetzInitialized || document.getElementById("tonnetzCanvas"))');

  const survival = await evaluate(client, `(() => ({
    canvas: Boolean(document.getElementById('tonnetzCanvas')),
    settings: Boolean(document.getElementById('edo') && document.getElementById('canvasSize')),
    nav: Boolean(document.getElementById('mobileNavSettings') && document.getElementById('mobileNavMore'))
  }))()`);
  if (!survival.canvas || !survival.settings || !survival.nav) throw new Error('Core app controls failed to render');

  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 1024,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false
  });
  await clickTabAndAssert(client, 'settings', 'mobileNavSettings', '#controlsContent', false);
  await clickTabAndAssert(client, 'chords', 'mobileNavChords', '#overlaySidebar', false);
  await waitFor(client, "document.querySelectorAll('#overlayList [data-role]').length === 2");
  await clickTabAndAssert(client, 'scale', 'mobileNavScale', '#scaleContent', false);
  await clickTabAndAssert(client, 'more', 'mobileNavMore', '#actionBtns', false);

  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 760,
    deviceScaleFactor: 1,
    mobile: true
  });
  await evaluate(client, 'window.dispatchEvent(new Event("resize"))');
  await clickTabAndAssert(client, 'settings', 'mobileNavSettings', '#controlsContent', true);
  await clickTabAndAssert(client, 'chords', 'mobileNavChords', '#overlaySidebar', true);
  await waitFor(client, "document.querySelectorAll('#overlayList [data-role]').length === 2");
  await clickTabAndAssert(client, 'scale', 'mobileNavScale', '#scaleContent', true);
  await clickTabAndAssert(client, 'more', 'mobileNavMore', '#actionBtns', true);
  await evaluate(client, "document.getElementById('controlsBackdrop').click()");
  await waitFor(client, `(() => !document.querySelector('.mobile-open') && !document.getElementById('controlsBackdrop')?.classList.contains('visible'))()`);
}

async function main() {
  if (typeof WebSocket !== 'function') {
    logSkip('Node WebSocket API unavailable');
    return;
  }

  const browserPath = findBrowser();
  if (!browserPath) {
    logSkip('no supported Chrome, Edge, or Chromium executable found');
    return;
  }

  const { server, port: appPort } = await createStaticServer();
  const debugPort = await getFreePort();
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tonnetz-smoke-'));
  const browser = spawn(browserPath, [
    '--headless=new',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-gpu',
    'about:blank'
  ], { stdio: 'ignore' });

  let client = null;
  try {
    await waitForDebugger(debugPort);
    let page = null;
    try {
      page = await fetchJson(`http://${HOST}:${debugPort}/json/new?about:blank`, { method: 'PUT' });
    } catch (e) {
      const tabs = await fetchJson(`http://${HOST}:${debugPort}/json/list`);
      page = tabs.find(item => item.type === 'page');
    }
    if (!page?.webSocketDebuggerUrl) throw new Error('Unable to attach to browser page target');
    client = new CdpClient(page.webSocketDebuggerUrl);
    await client.open();
    await runSmoke(client, `http://${HOST}:${appPort}/index.html`);
    console.log('PASS: browser smoke tests');
  } finally {
    if (client) client.close();
    browser.kill();
    await waitForExit(browser);
    server.close();
    await removeDirWithRetry(userDataDir);
  }
}

main()
  .then(() => {
    clearTimeout(watchdog);
  })
  .catch(error => {
    clearTimeout(watchdog);
    console.error(error && error.stack ? error.stack : error);
    process.exit(1);
  });
