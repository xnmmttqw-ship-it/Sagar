const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');
const fs = require('fs');

puppeteer.use(StealthPlugin());

// ───────────── CONFIG ─────────────
const PROXY_HOST = 'gw.hproxy.com';
const PROXY_PORT = 6969;
const PROXY_USER = 'oq752bxt5h';
const PROXY_PASS = 'drym1t6d71';
const COUNTRY    = 'us';                    // বদলাতে চাইলে: gb, ca, au, de
const TZ_FALLBACK = 'America/New_York';

const VISITOR_COUNT  = Math.max(1, parseInt(process.env.VISITOR_COUNT || '5', 10));
const CONCURRENCY    = 2;                   // ubuntu-latest-এ ২ কোর, ২-ই ভালো
const MAX_DATA_MB    = 3;                   // প্রতি ভিজিটে সর্বোচ্চ ডেটা
const SESSION_MIN    = 2;                   // সেশনের সর্বোচ্চ মিনিট
const DIAG           = true;                // টেস্ট শেষে false করুন
const STICKY_CANDIDATES = ['session', 'sid', 'ssid'];
// ──────────────────────────────────

const TARGET_URL = (process.env.CAMPAIGN_URL || '').trim();
if (!TARGET_URL) { console.error('[FATAL] target_url দেওয়া হয়নি'); process.exit(1); }

const sleep = ms => new Promise(r => setTimeout(r, ms));
const randInt = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = a => a[Math.floor(Math.random() * a.length)];

const MODELS = [
  { m: 'Pixel 8 Pro',   w: 412, h: 915, dpr: 2.625,  av: '14', gpu: 'Adreno (TM) 740' },
  { m: 'Pixel 7',       w: 412, h: 915, dpr: 2.625,  av: '13', gpu: 'Adreno (TM) 730' },
  { m: 'SM-S918B',      w: 360, h: 780, dpr: 3,      av: '13', gpu: 'Adreno (TM) 740' },
  { m: 'SM-A546B',      w: 384, h: 854, dpr: 2.8125, av: '13', gpu: 'Adreno (TM) 642L' },
  { m: 'Redmi Note 12', w: 393, h: 873, dpr: 2.75,   av: '13', gpu: 'Adreno (TM) 610' },
  { m: 'moto g(60)',    w: 412, h: 915, dpr: 2.625,  av: '12', gpu: 'Adreno (TM) 619' },
];

const LOG_FILE = 'visitors.jsonl';
const tagged = new WeakSet();
let SESSION_PARAM = null;
let tzPool = null;

const mkUser = cand => `${PROXY_USER}-country-${COUNTRY}_${cand}-${randInt(1e8, 9e8)}`;

function tzOffsetMinutes(tz) {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    const p = Object.fromEntries(dtf.formatToParts(new Date()).map(x => [x.type, x.value]));
    const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
    return Math.round((Date.now() - asUTC) / 60000);
  } catch { return 0; }
}

async function ipInfo(user) {
  const r = await axios.get(
    'http://ip-api.com/json/?fields=status,countryCode,isp,org,timezone,query',
    {
      proxy: {
        protocol: 'http', host: PROXY_HOST, port: PROXY_PORT,
        auth: { username: user, password: PROXY_PASS },
      },
      timeout: 9000,
    }
  );
  if (r.data.status !== 'success') throw new Error('ip-api status fail');
  return r.data;
}

// কোন স্টিকি প্যারামিটার কাজ করে সেটা নিজেই বের করে
async function detectStickyParam() {
  for (const cand of STICKY_CANDIDATES) {
    const user = mkUser(cand);
    try {
      const a = await ipInfo(user);
      const b = await ipInfo(user);
      if (a.query === b.query) {
        SESSION_PARAM = cand;
        tzPool = a.timezone;
        console.log(`[SANITY OK] sticky='${cand}' | ${a.query} | ${a.countryCode} | ${a.isp} | ${a.timezone}`);
        if (a.countryCode.toLowerCase() !== COUNTRY) {
          console.log(`[SANITY][WARN] COUNTRY=${COUNTRY} চাওয়া হলেও আইপি ${a.countryCode}`);
        }
        return true;
      }
      console.log(`[SANITY] '${cand}' স্টিকি নয় (${a.query} != ${b.query})`);
    } catch (e) {
      console.log(`[SANITY] '${cand}' ব্যর্থ: ${e.message}`);
    }
  }
  return false;
}

async function healthyProxy() {
  for (let t = 0; t < 3; t++) {
    const user = mkUser(SESSION_PARAM);
    try {
      const d = await ipInfo(user);
      if (d.countryCode.toLowerCase() !== COUNTRY) {
        console.log(`[PROXY] country mismatch ${d.countryCode}`);
        continue;
      }
      if (/hosting|datacenter|amazon|digitalocean|microsoft|ovh|contabo/i.test(`${d.isp} ${d.org}`)) {
        console.log(`[PROXY] datacenter: ${d.isp}`);
        continue;
      }
      console.log(`[PROXY OK] ${d.query} | ${d.countryCode} | ${d.isp}`);
      return { user, tz: d.timezone || tzPool || TZ_FALLBACK, ok: true };
    } catch (e) {
      console.log(`[PROXY FAIL] ${e.message}`);
    }
  }
  console.log('[PROXY][WARN] প্রি-চেক ব্যর্থ — এগোচ্ছি');
  return { user: mkUser(SESSION_PARAM), tz: tzPool || TZ_FALLBACK, ok: false };
}

function referer() {
  const r = Math.random();
  if (r < 0.60) return undefined;
  if (r < 0.84) return 'https://www.google.com/';
  if (r < 0.93) return 'https://m.facebook.com/';
  if (r < 0.97) return 'https://t.co/';
  return 'https://www.instagram.com/';
}

async function humanSwipe(page, sx, sy, ex, ey) {
  try {
    await page.touchscreen.tap(sx, sy);
    await sleep(randInt(70, 180));
    const steps = randInt(14, 26);
    for (let i = 1; i <= steps; i++) {
      const p = i / steps;
      const bend = Math.sin(p * Math.PI) * randInt(-6, 6);
      await page.mouse.move(sx + (ex - sx) * p + bend, sy + (ey - sy) * p + randInt(-2, 2));
      await sleep(randInt(18, 55));
    }
  } catch {}
}

async function runVisitor(n) {
  const p = await healthyProxy();

  const dev = pick(MODELS);
  const seed = randInt(1, 2147483647);
  const screenH = dev.h;
  const viewH = dev.h - randInt(84, 132);
  const tzOff = tzOffsetMinutes(p.tz);

  const proxyUrl = `http://${encodeURIComponent(p.user)}:${encodeURIComponent(PROXY_PASS)}@${PROXY_HOST}:${PROXY_PORT}`;

  const start = Date.now();
  let bytes = 0;
  let capped = false;
  let browser;
  let page;
  const shots = [];

  try {
    browser = await puppeteer.launch({
      executablePath: '/usr/bin/google-chrome',
      headless: 'new',
      args: [
        `--proxy-server=${proxyUrl}`,
        '--ignore-certificate-errors',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-ipc-flooding-protection',
        '--force-webrtc-ip-handling-policy=disable_non_proxied_udp',
        '--mute-audio',
        '--lang=en-US',
        '--no-default-browser-check',
        '--no-pings',
        `--window-size=${dev.w},${viewH}`,
      ],
    });

    const major = (await browser.version()).split('.')[0].replace(/\D/g, '') || '130';
    const ua = `Mozilla/5.0 (Linux; Android ${dev.av}; ${dev.m}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Mobile Safari/537.36`;

    page = await browser.newPage();
    tagged.add(page);
    await page.authenticate({ username: p.user, password: PROXY_PASS }).catch(() => {});
    await page.setUserAgent({ userAgent: ua, acceptLanguage: 'en-US,en;q=0.9' });
    await page.setViewport({
      width: dev.w, height: viewH,
      deviceScaleFactor: dev.dpr, isMobile: true, hasTouch: true,
    });
    await page.emulateTimezone(p.tz).catch(() => {});

    await page.evaluateOnNewDocument((cfg) => {
      const native = f => { f.toString = () => 'function () { [native code] }'; return f; };
      const def = (obj, k, v) => Object.defineProperty(obj, k, { get: () => v, configurable: true });

      def(navigator, 'maxTouchPoints', 5);
      def(navigator, 'platform', 'Linux armv8l');
      def(navigator, 'hardwareConcurrency', 8);
      def(navigator, 'deviceMemory', 8);
      def(navigator, 'language', 'en-US');
      def(navigator, 'languages', ['en-US', 'en']);

      Date.prototype.getTimezoneOffset = native(function () { return cfg.tzOff; });

      def(screen, 'width', cfg.sw);
      def(screen, 'height', cfg.sh);
      def(screen, 'availWidth', cfg.sw);
      def(screen, 'availHeight', cfg.sh - 48);
      def(window, 'outerWidth', cfg.sw);
      def(window, 'outerHeight', cfg.sh);
      def(window, 'devicePixelRatio', cfg.dpr);

      const charging = Math.random() < 0.25;
      navigator.getBattery = native(() => Promise.resolve({
        charging,
        chargingTime: charging ? 600 + Math.random() * 4000 : Infinity,
        dischargingTime: charging ? Infinity : 2400 + Math.random() * 11000,
        level: charging ? 0.3 + Math.random() * 0.68 : 0.18 + Math.random() * 0.7,
      }));

      def(navigator, 'connection', {
        effectiveType: '4g', rtt: Math.round(35 + Math.random() * 55),
        downlink: 6 + Math.random() * 12, saveData: false,
      });

      const hash = k => {
        let h = cfg.seed;
        for (let i = 0; i < k.length; i++) h = (Math.imul(h, 31) + k.charCodeAt(i)) | 0;
        return (((h >>> 8) & 1023) / 1023) - 0.5;
      };
      const origGetContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, attrs) {
        const ctx = origGetContext.call(this, type, attrs);
        if (type === '2d' && ctx && !ctx.__noised) {
          ctx.__noised = true;
          const origFill = ctx.fillText;
          ctx.fillText = function (txt, x, y, ...rest) {
            const key = String(txt) + '|' + Math.round(x) + '|' + Math.round(y);
            return origFill.call(this, txt, x + hash(key) * 0.04, y + hash(key + 'y') * 0.04, ...rest);
          };
        }
        return ctx;
      };
      HTMLCanvasElement.prototype.getContext.toString = native(function () {});

      const patchGL = (proto) => {
        if (!proto) return;
        const orig = proto.getParameter;
        proto.getParameter = native(function (param) {
          if (param === 37445) return 'Qualcomm';
          if (param === 37446) return cfg.gpu;
          return orig.call(this, param);
        });
      };
      patchGL(window.WebGLRenderingContext && WebGLRenderingContext.prototype);
      patchGL(window.WebGL2RenderingContext && WebGL2RenderingContext.prototype);

      def(document, 'hidden', false);
      def(document, 'visibilityState', 'visible');
    }, { tzOff, sw: dev.w, sh: screenH, dpr: dev.dpr, seed, gpu: dev.gpu });

    await page.setRequestInterception(true);
    page.on('request', req => {
      const t = req.resourceType();
      const u = req.url();
      const tight = bytes > MAX_DATA_BYTES * 0.8;
      const kill =
        capped ||
        ['manifest', 'prefetch', 'ping', 'csp_report'].includes(t) ||
        /google-analytics|googletagmanager|hotjar|clarity\.ms|facebook\.net|doubleclick|\.map(\?|$)/i.test(u) ||
        (tight && ['image', 'media', 'font'].includes(t));
      (kill ? req.abort() : req.continue()).catch(() => {});
    });
    page.on('response', async res => {
      try {
        const b = await res.buffer();
        if (b) {
          bytes += b.length;
          if (bytes >= MAX_DATA_BYTES) capped = true;
        }
      } catch {}
    });

    const ref = referer();
    console.log(`[${n}] goto | ref=${ref || 'direct'} | tz=${p.tz} | ${dev.m}`);
    await page.goto(TARGET_URL, {
      waitUntil: 'domcontentloaded', timeout: 45000, referer: ref,
    }).catch(e => console.log(`[${n}] goto: ${e.message}`));

    if (DIAG) {
      const d = await page.evaluate(async () => {
        try { return await (await fetch('https://ipinfo.io/json')).json(); } catch { return null; }
      }).catch(() => null);
      const jstz = await page.evaluate(
        () => Intl.DateTimeFormat().resolvedOptions().timeZone + '/' + new Date().getTimezoneOffset()
      ).catch(() => '?');
      console.log(`[${n}] DIAG ${JSON.stringify(d)} | tzJs=${jstz}`);
    }

    await sleep(randInt(2500, 5000));

    for (let s = 0; s < 3; s++) {
      const hit = await page.evaluate(() => {
        const kw = ['yes', 'continue', 'i am 18', '18+', 'enter', 'agree', 'accept', 'verify', 'proceed', 'ok', 'access'];
        for (const el of document.querySelectorAll('button, a, div, span, input[type="button"], input[type="submit"]')) {
          const txt = ((el.innerText || '') + (el.value || '') + (el.getAttribute('aria-label') || '')).trim().toLowerCase();
          if (txt && kw.some(k => txt.includes(k)) && el.offsetParent !== null) {
            el.click();
            return txt.slice(0, 40);
          }
        }
        return null;
      }).catch(() => null);
      if (hit) console.log(`[${n}] popup: ${hit}`);
      await sleep(randInt(1400, 2600));
    }

    await page.mouse.move(randInt(70, dev.w - 70), randInt(180, viewH - 200), { steps: randInt(6, 16) }).catch(() => {});
    await sleep(randInt(350, 1100));
    await humanSwipe(page, randInt(140, 220), randInt(viewH - 350, viewH - 200), randInt(140, 220), randInt(220, 360));
    await sleep(randInt(300, 900));
    await page.mouse.click(randInt(120, dev.w - 120), randInt(240, viewH - 200)).catch(() => {});

    for (let i = 0; i < 10; i++) {
      await sleep(500);
      const extras = (await browser.pages()).filter(pg => !tagged.has(pg));
      if (extras.length) {
        for (const ep of extras) {
          tagged.add(ep);
          await ep.authenticate({ username: p.user, password: PROXY_PASS }).catch(() => {});
          console.log(`[${n}] popunder: ${ep.url().slice(0, 90)}`);
          await sleep(randInt(12000, 20000));
          const f = `screenshot_pop_${n}_${Date.now()}.png`;
          await ep.screenshot({ path: f }).catch(() => {});
          shots.push(f);
          await ep.close().catch(() => {});
        }
        break;
      }
    }

    const targetMs = randInt(40, Math.max(75, SESSION_MIN * 60)) * 1000;
    let mainShot = false;
    while (Date.now() - start < targetMs && !capped) {
      await page.evaluate(
        v => window.scrollBy({ top: v, behavior: 'smooth' }),
        randInt(110, 380) * (Math.random() > 0.15 ? 1 : -1)
      ).catch(() => {});
      if (Math.random() < 0.15) {
        await page.mouse.move(randInt(60, dev.w - 60), randInt(200, viewH - 150), { steps: 9 }).catch(() => {});
      }
      if (!mainShot && Date.now() - start > 9000) {
        mainShot = true;
        const f = `screenshot_main_${n}.png`;
        await page.screenshot({ path: f }).catch(() => {});
        shots.push(f);
      }
      await sleep(randInt(3500, 9000));
    }

    console.log(`[${n}] done | ${((Date.now() - start) / 1000).toFixed(0)}s | ${(bytes / 1048576).toFixed(3)} MB${capped ? ' | capped' : ''}`);
  } catch (e) {
    console.log(`[${n}] ERROR ${e.message} | ${((Date.now() - start) / 1000).toFixed(0)}s`);
  } finally {
    fs.appendFileSync(LOG_FILE, JSON.stringify({
      n, ts: new Date().toISOString(), proxy: p.user, proxy_ok: p.ok,
      tz: p.tz, ua: dev.m, secs: Math.round((Date.now() - start) / 1000),
      mb: +(bytes / 1048576).toFixed(3), shots, capped,
    }) + '\n');
    await browser?.close().catch(() => {});
  }
}

(async () => {
  console.log(`[MASTER] ${VISITOR_COUNT} visitors | concurrency ${CONCURRENCY} | max ${MAX_DATA_MB}MB`);
  fs.writeFileSync(LOG_FILE, '');

  if (!(await detectStickyParam())) {
    SESSION_PARAM = 'session';
    console.log(`[SANITY][WARN] কোনো স্টিকি প্যারাম টিকেনি, '${SESSION_PARAM}' দিয়ে চালাচ্ছি — IP ঘুরবে`);
  }

  let ptr = 1;
  const worker = async () => {
    while (ptr <= VISITOR_COUNT) {
      const n = ptr++;
      await Promise.race([runVisitor(n), sleep((SESSION_MIN * 60 + 200) * 1000)]);
      await sleep(randInt(800, 2600));
    }
  };

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, VISITOR_COUNT) }, worker));
  console.log('[MASTER] finished');
  process.exit(0);
})();
