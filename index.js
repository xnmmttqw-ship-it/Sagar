const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

const stealth = StealthPlugin();
stealth.enabledEvasions.delete('chrome.app');
stealth.enabledEvasions.delete('iframe.contentWindow');
puppeteer.use(stealth);

// গিটহাব অ্যাকশনস ম্যাট্রিক্স ও প্রতি জবের ভিজিটর কনফিগারেশন
const TOTAL_VISITORS = parseInt(process.env.VISITOR_COUNT) || 10; 
const TARGET_URL = process.env.CAMPAIGN_URL || 'https://auctionr.org/4/5a41eae4c9364b8088fd4ff777a02672'; 
const MAX_DATA_MB = parseFloat(process.env.MAX_DATA_MB) || 0.2; 

const RAW_COUNTRIES = process.env.COUNTRIES || 'us';
const COUNTRY_LIST = RAW_COUNTRIES.split(',').map(c => c.trim().toLowerCase());

const DEVICES_POOL = [
    {
        platform: 'android',
        userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36',
        platformHeader: '"Android"'
    },
    {
        platform: 'android',
        userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36',
        platformHeader: '"Android"'
    },
    {
        platform: 'ios',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
        platformHeader: '"iOS"'
    }
];

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runSingleVisitor(visitorIndex) {
    const visitorNum = visitorIndex + 1;

    const selectedCountry = COUNTRY_LIST[Math.floor(Math.random() * COUNTRY_LIST.length)];
    const selectedDevice = DEVICES_POOL[Math.floor(Math.random() * DEVICES_POOL.length)];

    const randomWidth = Math.floor(Math.random() * (390 - 360 + 1)) + 360;
    const randomHeight = Math.floor(Math.random() * (850 - 800 + 1)) + 800;

    console.log(`[Visitor ${visitorNum}] Starting session -> Country: [${selectedCountry.toUpperCase()}] | Device: [${selectedDevice.platform.toUpperCase()}] | Res: [${randomWidth}x${randomHeight}] | Max Limit: ${MAX_DATA_MB} MB`);

    const proxyHost = 'gw.hproxy.com';
    const proxyPort = '6969';
    const proxyUser = `oq752bxt5h-country-${selectedCountry}`; 
    const proxyPass = 'drym1t6d71';

    let browser;
    let retryCount = 0;
    const maxRetries = 2;

    while (retryCount <= maxRetries) {
        try {
            browser = await puppeteer.launch({
                headless: true,
                executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome',
                args: [
                    `--proxy-server=http://${proxyHost}:${proxyPort}`,
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--disable-gpu',
                    '--disable-infobars',
                    '--window-position=0,0',
                    '--ignore-certificate-errors',
                    '--user-data-dir=/tmp/chrome-user-data-' + visitorNum + '-' + Date.now()
                ].filter(Boolean)
            });
            break;
        } catch (err) {
            retryCount++;
            console.log(`[Visitor ${visitorNum}] Proxy connection failed. Retrying (${retryCount}/${maxRetries})...`);
            if (retryCount > maxRetries) return;
            await delay(3000);
        }
    }

    const page = await browser.newPage();

    await page.authenticate({
        username: proxyUser,
        password: proxyPass
    });

    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
        Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
        
        const getParameterOriginal = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(parameter) {
            if (parameter === 37445) return 'Google Inc. (Qualcomm)';
            if (parameter === 37446) return 'OpenGL ES 3.0 Adreno (TM) 740';
            return getParameterOriginal.apply(this, arguments);
        };
    });

    await page.setRequestInterception(true);
    page.on('request', (interceptedRequest) => {
        const resourceType = interceptedRequest.resourceType();
        if (['image', 'font', 'media', 'stylesheet'].includes(resourceType)) {
            interceptedRequest.abort();
        } else {
            interceptedRequest.continue();
        }
    });

    let totalBytesDownloaded = 0;
    let isDataExceeded = false;

    page.on('response', async (response) => {
        try {
            const buffer = await response.buffer();
            if (buffer) {
                totalBytesDownloaded += buffer.length;
                const currentMB = totalBytesDownloaded / (1024 * 1024);
                
                if (currentMB > MAX_DATA_MB && !isDataExceeded) {
                    isDataExceeded = true;
                }
            }
        } catch (e) {}
    });

    await page.setUserAgent(selectedDevice.userAgent);
    
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="122", "Google Chrome";v="122"',
        'Sec-Ch-Ua-Mobile': '?1',
        'Sec-Ch-Ua-Platform': selectedDevice.platformHeader
    });

    await page.setViewport({ width: randomWidth, height: randomHeight, isMobile: true, hasTouch: true });

    try {
        console.log(`[Visitor ${visitorNum}] Visiting URL: ${TARGET_URL}`);
        await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 60000 });

        await delay(2000);
        const isProxyBlocked = await page.evaluate(() => {
            const text = document.body.innerText || '';
            return text.includes('Anonymous Proxy detected') || text.includes('Access Denied') || text.includes('Blocked');
        });

        if (isProxyBlocked) {
            console.log(`[Visitor ${visitorNum}] Proxy blocked by target site! Exiting session immediately...`);
            await browser.close();
            return;
        }

        // ইউনিভার্সাল পপআপ ও ১৮+ বাইপাস লজিক
        await page.evaluate(() => {
            const allEls = Array.from(document.querySelectorAll('button, a, div, span, input[type="button"], input[type="submit"]'));
            const targetBtn = allEls.find(el => {
                const text = (el.textContent || el.value || '').trim().toLowerCase();
                const positiveKeywords = [
                    'yes', 'agree', 'i agree', 'continue', 'enter', 'proceed', 
                    'over 18', 'i am 18', '18+', 'confirm', 'accept', 'view', 'proceed to site'
                ];
                return positiveKeywords.some(keyword => text === keyword || text.includes(keyword));
            });

            if (targetBtn) {
                targetBtn.click();
            }
        });

        await delay(2500);

        // ৫ মিনিট (৩০০ সেকেন্ড) থেকে ১০ মিনিট (৬০০ সেকেন্ড) রেন্ডম সেশন টাইম
        const minTime = 300000; 
        const maxTime = 600000; 
        const randomStayTime = Math.floor(Math.random() * (maxTime - minTime + 1)) + minTime; 
        console.log(`[Visitor ${visitorNum}] Session active. Target duration: ${(randomStayTime / 1000 / 60).toFixed(2)} minutes...`);
        
        const startTime = Date.now();
        let screenshotTaken = false; // মাত্র ১টি স্ক্রিনশট নেওয়ার জন্য ফ্ল্যাগ

        while (Date.now() - startTime < randomStayTime) {
            if (isDataExceeded) {
                const usedMB = (totalBytesDownloaded / (1024 * 1024)).toFixed(2);
                console.log(`[Visitor ${visitorNum}] Data limit reached (${usedMB} MB > ${MAX_DATA_MB} MB)! Exiting...`);
                try { await page.goBack(); } catch (e) {}
                await browser.close();
                return;
            }

            const elapsedTime = Date.now() - startTime;

            // ঠিক ৩০ সেকেন্ডে মাত্র ১টি স্ক্রিনশট ক্যাপচার করবে
            if (elapsedTime >= 30000 && !screenshotTaken) {
                screenshotTaken = true;
                console.log(`[Visitor ${visitorNum}] Taking 30-second screenshot...`);
                await page.screenshot({ path: `screenshot_visitor_${visitorNum}_30s.png` });
            }

            // রিয়েল হিউম্যান-লাইক স্মুথ স্ক্রোলিং ও রেন্ডম পজ
            await page.evaluate(() => {
                const scrollDirection = Math.random() > 0.1 ? 1 : -1; 
                const scrollDistance = (Math.floor(Math.random() * 200) + 50) * scrollDirection;
                window.scrollBy({ top: scrollDistance, behavior: 'smooth' });
            });

            const randomPause = Math.floor(Math.random() * 5000) + 3000;
            await delay(randomPause);
        }

        try {
            await page.evaluate(() => window.history.back());
            await delay(1000);
        } catch (e) {}

        const totalMB = (totalBytesDownloaded / (1024 * 1024)).toFixed(2);
        console.log(`[Visitor ${visitorNum}] Session completed! Total Data Used: ${totalMB} MB`);

    } catch (error) {
        const totalMB = (totalBytesDownloaded / (1024 * 1024)).toFixed(2);
        console.error(`[Visitor ${visitorNum}] Error (Data used: ${totalMB} MB):`, error.message);
    } finally {
        if (browser) await browser.close();
    }
}

async function runVisitorsPool() {
    console.log(`Starting all ${TOTAL_VISITORS} visitors simultaneously...\n`);
    
    const visitorsPromises = [];
    for (let i = 0; i < TOTAL_VISITORS; i++) {
        visitorsPromises.push(runSingleVisitor(i));
    }
    
    await Promise.all(visitorsPromises);
    console.log(`All ${TOTAL_VISITORS} visitor sessions completed successfully!`);
}

runVisitorsPool();
