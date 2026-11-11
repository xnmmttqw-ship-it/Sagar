const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

const stealth = StealthPlugin();
stealth.enabledEvasions.delete('chrome.app');
stealth.enabledEvasions.delete('iframe.contentWindow');
puppeteer.use(stealth);

const TOTAL_VISITORS = parseInt(process.env.VISITOR_COUNT) || 1; 
const TARGET_URL = process.env.CAMPAIGN_URL || 'https://auctionr.org/4/5a41eae4c9364b8088fd4ff777a02672'; 
const MAX_DATA_MB = parseFloat(process.env.MAX_DATA_MB) || 0.2; 

const RAW_COUNTRIES = process.env.COUNTRIES || 'no';
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

    // ডাইনামিক এন্ট্রি ডিলে (৩ থেকে ৫ সেকেন্ড)
    const startDelay = Math.floor(Math.random() * 3000) + 3000;
    await delay(startDelay);

    const selectedCountry = COUNTRY_LIST[Math.floor(Math.random() * COUNTRY_LIST.length)];
    const selectedDevice = DEVICES_POOL[Math.floor(Math.random() * DEVICES_POOL.length)];

    // ডাইনামিক ভিউপোর্ট ভ্যারিয়েশন
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
                    '--user-data-dir=/tmp/chrome-user-data-' + Math.random() + '-' + Date.now()
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

    // হার্ডওয়্যার কনকারেন্সি ও ফিঙ্গারপ্রিন্ট স্পুফিং
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

    // আল্ট্রা ডাটা সেভার মোড (নিখুঁতভাবে শুধু হেভি ফাইল ব্লক করা)
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

    // রিয়েল-টাইম ডাটা ট্র্যাকিং এবং ০.২ MB লিমিট এনফোর্সমেন্ট
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
        'Accept-Language': selectedCountry === 'no' ? 'no-NO,no;q=0.9,en-US;q=0.8,en;q=0.7' : 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="122", "Google Chrome";v="122"',
        'Sec-Ch-Ua-Mobile': '?1',
        'Sec-Ch-Ua-Platform': selectedDevice.platformHeader
    });

    await page.setViewport({ width: randomWidth, height: randomHeight, isMobile: true, hasTouch: true });

    try {
        console.log(`[Visitor ${visitorNum}] Visiting URL: ${TARGET_URL}`);
        await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 60000 });

        await delay(3000);
        const isProxyBlocked = await page.evaluate(() => {
            const text = document.body.innerText || '';
            return text.includes('Anonymous Proxy detected') || text.includes('Access Denied') || text.includes('Blocked');
        });

        if (isProxyBlocked) {
            console.log(`[Visitor ${visitorNum}] Proxy blocked by target site! Exiting session immediately...`);
            await browser.close();
            return;
        }

        // পপআপ বাইপাস
        await page.evaluate(() => {
            const allEls = Array.from(document.querySelectorAll('button, a, div, span'));
            const targetBtn = allEls.find(el => {
                const text = el.textContent || '';
                return text.includes('Yes, I\'m over 18') || 
                       text.includes('Verify you are human') || 
                       text.includes('I am not a robot') ||
                       text.includes('Proceed') ||
                       text.includes('Enter');
            });
            if (targetBtn) targetBtn.click();
        });

        // সেশন টাইম র‍্যান্ডমাইজেশন (৪ থেকে ৫ মিনিট)
        const randomStayMinutes = Math.floor(Math.random() * (300000 - 240000 + 1)) + 240000; 
        console.log(`[Visitor ${visitorNum}] Session active. Target duration: ${(randomStayMinutes / 60000).toFixed(1)} mins (Max Limit: ${MAX_DATA_MB} MB)...`);
        
        const startTime = Date.now();

        while (Date.now() - startTime < randomStayMinutes) {
            if (isDataExceeded) {
                const usedMB = (totalBytesDownloaded / (1024 * 1024)).toFixed(2);
                console.log(`[Visitor ${visitorNum}] Data limit reached (${usedMB} MB > ${MAX_DATA_MB} MB)! Automatically backing out...`);
                
                try { await page.goBack(); } catch (e) {}
                await delay(1000);
                await browser.close();
                return;
            }

            // রেন্ডম স্ক্রোলিং এবং টাচ/ক্লিক সিমুলেশন
            await page.evaluate(() => {
                window.scrollBy(0, Math.floor(Math.random() * 200) + 50);
                
                if (Math.random() > 0.5) {
                    const randomElements = document.querySelectorAll('p, span, div, a');
                    if (randomElements.length > 0) {
                        const randomEl = randomElements[Math.floor(Math.random() * randomElements.length)];
                        if (randomEl) {
                            randomEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                        }
                    }
                }
            });

            await delay(Math.floor(Math.random() * 3000) + 5000); // ৫ থেকে ৮ সেকেন্ড প্রাকৃতিক বিরতি
        }

        // ন্যাচারাল এক্সিট
        try {
            await page.evaluate(() => window.history.back());
            await delay(2000);
        } catch (e) {}

        const totalMB = (totalBytesDownloaded / (1024 * 1024)).toFixed(2);
        console.log(`[Visitor ${visitorNum}] Session completed naturally! Total Data Used: ${totalMB} MB`);

    } catch (error) {
        const totalMB = (totalBytesDownloaded / (1024 * 1024)).toFixed(2);
        console.error(`[Visitor ${visitorNum}] Error (Data used: ${totalMB} MB):`, error.message);
    } finally {
        if (browser) await browser.close();
    }
}

async function runVisitorsPool() {
    console.log(`Starting ${TOTAL_VISITORS} visitors with Pro-Level Human Protections & Random Res...\n`);
    for (let i = 0; i < TOTAL_VISITORS; i++) {
        runSingleVisitor(i);
    }
}

runVisitorsPool();
