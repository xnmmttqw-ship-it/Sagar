const puppeteer = require('puppeteer-core');

const TARGET_URL = process.env.CAMPAIGN_URL || 'https://auctionr.org/4/5a41eae4c9364b8088fd4ff777a02672';
const COUNTRIES = process.env.COUNTRIES || 'oq752bxt5h-country-us';
const VISITOR_COUNT = parseInt(process.env.VISITOR_COUNT || '10', 10);
const MAX_DATA_MB = parseFloat(process.env.MAX_DATA_MB || '0.2'); // লিমিট ০.২ এমবি করা হলো
const MAX_DATA_BYTES = MAX_DATA_MB * 1024 * 1024; 

const proxyHost = 'gw.hproxy.com';
const proxyPort = '6969';
const proxyPass = 'drym1t6d71';

const proxyUsersList = COUNTRIES.split(',').map(c => c.trim());

function getRandomProxyUser() {
    return proxyUsersList[Math.floor(Math.random() * proxyUsersList.length)];
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function runVisitor(visitorNum) {
    const proxyUser = getRandomProxyUser();
    console.log(`[Visitor ${visitorNum}] Starting session -> Proxy User: [${proxyUser}] | Max Limit: ${MAX_DATA_MB} MB`);

    const browser = await puppeteer.launch({
        executablePath: '/usr/bin/google-chrome',
        headless: 'new',
        args: [
            `--proxy-server=http://${proxyHost}:${proxyPort}`,
            '--ignore-certificate-errors',
            '--ignore-certificate-errors-spki-list',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--window-size=375,812',
            '--disable-blink-features=AutomationControlled',
            '--disable-features=IsolateOrigins,site-per-process'
        ]
    });

    let totalBytesTransferred = 0;
    const sessionStartTime = Date.now();

    try {
        const page = await browser.newPage();
        
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
        });

        await page.authenticate({
            username: proxyUser,
            password: proxyPass
        });

        await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1');
        await page.setViewport({ width: 375, height: 812, isMobile: true });

        // --- রিকোয়েস্ট ফিল্টারিং ও ০.২ এমবি কড়া লিমিট ---
        await page.setRequestInterception(true);
        page.on('request', req => {
            if (totalBytesTransferred >= MAX_DATA_BYTES) {
                req.abort();
                return;
            }

            const resourceType = req.resourceType();
            const url = req.url();

            if (
                ['image', 'font', 'stylesheet', 'media', 'manifest'].includes(resourceType) ||
                url.endsWith('.png') || url.endsWith('.jpg') || url.endsWith('.jpeg') || url.endsWith('.gif') || url.endsWith('.css') ||
                url.includes('google-analytics.com') ||
                url.includes('googletagmanager.com') ||
                url.includes('facebook.net') ||
                url.endsWith('.map')
            ) {
                req.abort();
            } else {
                req.continue();
            }
        });

        page.on('response', async res => {
            try {
                const buffer = await res.buffer().catch(() => null);
                if (buffer) {
                    totalBytesTransferred += buffer.length;
                    if (totalBytesTransferred >= MAX_DATA_BYTES) {
                        try { await page.close(); } catch (e) {}
                    }
                }
            } catch (e) {}
        });

        console.log(`[Visitor ${visitorNum}] Visiting URL: ${TARGET_URL}`);
        await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // --- সিকিউরিটি / এজ ভেরিফিকেশন হ্যান্ডলার ---
        try {
            console.log(`[Visitor ${visitorNum}] Scanning page for security/age verification popups...`);
            
            for (let step = 1; step <= 2; step++) {
                if (totalBytesTransferred >= MAX_DATA_BYTES) break;
                await page.waitForTimeout(1500); 
                
                const clickedInfo = await page.evaluate(() => {
                    const elements = Array.from(document.querySelectorAll('button, a, div, span, input[type="button"], input[type="submit"]'));
                    const targetKeywords = [
                        'yes', 'continue', 'i am 18', 'i am over 18', '18+', 'enter', 
                        'agree', 'accept', 'verify', 'proceed', 'ok', 'موافق', 'حاب', 'human', 'Access', 'i agree'
                    ];

                    for (let el of elements) {
                        const text = el.innerText ? el.innerText.trim().toLowerCase() : '';
                        const value = el.value ? el.value.trim().toLowerCase() : '';
                        const ariaLabel = el.getAttribute('aria-label') ? el.getAttribute('aria-label').toLowerCase() : '';
                        
                        const matched = targetKeywords.some(keyword => text.includes(keyword) || value.includes(keyword) || ariaLabel.includes(keyword));
                        
                        if (matched && el.offsetParent !== null) {
                            el.click();
                            return { success: true, text: text || value || ariaLabel };
                        }
                    }
                    return { success: false };
                });

                if (clickedInfo && clickedInfo.success) {
                    console.log(`[Visitor ${visitorNum}] [SUCCESS] Step ${step}: Popup bypassed! Clicked: "${clickedInfo.text}"`);
                }
            }
        } catch (e) {}

        const targetDurationMs = 30 * 1000; 
        console.log(`[Visitor ${visitorNum}] Session active target: 30 seconds...`);

        while (Date.now() - sessionStartTime < targetDurationMs) {
            if (totalBytesTransferred >= MAX_DATA_BYTES) {
                console.log(`[Visitor ${visitorNum}] 0.2 MB Data limit reached! Exiting...`);
                break;
            }

            try {
                const scrollAmount = getRandomInt(100, 200);
                await page.evaluate((scrollVal) => {
                    window.scrollBy({ top: scrollVal, behavior: 'smooth' });
                }, scrollAmount);
            } catch (err) {}

            await new Promise(resolve => setTimeout(resolve, 3000));
        }

        const totalDurationSec = ((Date.now() - sessionStartTime) / 1000).toFixed(1);
        const finalMB = (totalBytesTransferred / (1024 * 1024)).toFixed(4);
        const finalKB = (totalBytesTransferred / 1024).toFixed(2);

        console.log(`[Visitor ${visitorNum}] [SUCCESS] Session completed & Exited!`);
        console.log(`[Visitor ${visitorNum}] -> Total Time on Page: ${totalDurationSec} seconds`);
        console.log(`[Visitor ${visitorNum}] -> Total Data Used: ${finalMB} MB (${finalKB} KB)`);

    } catch (error) {
        const totalDurationSec = ((Date.now() - sessionStartTime) / 1000).toFixed(1);
        const finalMB = (totalBytesTransferred / (1024 * 1024)).toFixed(4);
        console.log(`[Visitor ${visitorNum}] [INFO] Session ended. Time: ${totalDurationSec}s | Data Used: ${finalMB} MB`);
    } finally {
        await browser.close();
    }
}

async function main() {
    console.log(`Starting bot execution for ${VISITOR_COUNT} visitors (Strict 0.2 MB Limit)...`);
    
    for (let i = 1; i <= VISITOR_COUNT; i++) {
        console.log(`Launching Visitor ${i}...`);
        runVisitor(i).catch(err => console.log(`Visitor ${i} failed: ${err.message}`));
        await new Promise(resolve => setTimeout(resolve, 3000));
    }
}

main();
