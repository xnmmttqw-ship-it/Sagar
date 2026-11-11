const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

const stealth = StealthPlugin();
stealth.enabledEvasions.delete('chrome.app');
stealth.enabledEvasions.delete('iframe.contentWindow');
puppeteer.use(stealth);

const TOTAL_VISITORS = parseInt(process.env.VISITOR_COUNT) || 50; 
const CONCURRENT_LIMIT = 5; 
const TARGET_URL = process.env.CAMPAIGN_URL || 'https://auctionr.org/4/5a41eae4c9364b8088fd4ff777a02672'; 

const USER_AGENTS = [
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 13; Pixel 7 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36'
];

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runSingleVisitor(visitorIndex) {
    const visitorNum = visitorIndex + 1;
    console.log(`[Visitor ${visitorNum}] Starting session (Norway Proxy)...`);

    const proxyHost = 'gw.hproxy.com';
    const proxyPort = '6969';
    const proxyUser = 'oq752bxt5h-country-no'; 
    const proxyPass = 'drym1t6d71';

    await delay(Math.floor(Math.random() * 3000) + 1000);

    const browser = await puppeteer.launch({
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
            '--lang=no-NO,no;q=0.9,en-US;q=0.8,en;q=0.7',
            '--user-data-dir=/tmp/chrome-user-data-' + Math.random() + '-' + Date.now()
        ].filter(Boolean)
    });

    const page = await browser.newPage();

    await page.authenticate({
        username: proxyUser,
        password: proxyPass
    });

    let totalBytesDownloaded = 0;
    page.on('response', async (response) => {
        try {
            const buffer = await response.buffer();
            if (buffer) {
                totalBytesDownloaded += buffer.length;
            }
        } catch (e) {}
    });

    const randomUA = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    await page.setUserAgent(randomUA);
    
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'no-NO,no;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'Sec-Ch-Ua-Mobile': '?1',
        'Sec-Ch-Ua-Platform': '"Android"'
    });

    await page.setViewport({ 
        width: 375, 
        height: 812,
        isMobile: true,
        hasTouch: true
    });

    try {
        console.log(`[Visitor ${visitorNum}] Visiting URL: ${TARGET_URL}`);
        await page.goto(TARGET_URL, { 
            waitUntil: 'networkidle2',
            timeout: 60000 
        });

        // --- প্রক্সি ডিটেক্ট বা ব্লক চেক লজিক ---
        await delay(3000);
        const isProxyBlocked = await page.evaluate(() => {
            const text = document.body.innerText || '';
            return text.includes('Anonymous Proxy detected') || text.includes('Access Denied') || text.includes('Blocked');
        });

        if (isProxyBlocked) {
            console.log(`[Visitor ${visitorNum}] Proxy detected/blocked by target site! Exiting session immediately...`);
            await browser.close();
            return;
        }

        // --- সিকিউরিটি বা ১৮+ পপআপ অটো-ক্লিক হ্যান্ডলিং ---
        const handledPopup = await page.evaluate(() => {
            const allEls = Array.from(document.querySelectorAll('button, a, div, span'));
            const targetBtn = allEls.find(el => {
                const text = el.textContent || '';
                return text.includes('Yes, I\'m over 18') || 
                       text.includes('Verify you are human') || 
                       text.includes('I am not a robot') ||
                       text.includes('Proceed') ||
                       text.includes('Enter');
            });
            if (targetBtn) {
                targetBtn.click();
                return true;
            }
            return false;
        });

        if (handledPopup) {
            console.log(`[Visitor ${visitorNum}] Verification / Age popup bypassed successfully!`);
            await delay(4000); 
        }

        // --- ৫ মিনিট পেজে অবস্থান ও স্ক্রোলিং ---
        console.log(`[Visitor ${visitorNum}] Security cleared. Staying on page for 5 minutes...`);
        const startTime = Date.now();
        const targetStayTime = 5 * 60 * 1000; // ৫ মিনিট (৩০০ সেকেন্ড)

        while (Date.now() - startTime < targetStayTime) {
            await page.evaluate(() => window.scrollBy(0, Math.floor(Math.random() * 250) + 100));
            await delay(6000);
            await page.evaluate(() => window.scrollBy(0, -150));
            await delay(6000);
        }

        // --- টার্গেট লিংকে ক্লিক লজিক ---
        const clicked = await page.evaluate(() => {
            const allEls = Array.from(document.querySelectorAll('a, button, div, span'));
            const target = allEls.find(el => el.textContent && (el.textContent.includes('পড়া শুরু করুন') || el.textContent.includes('Click') || el.textContent.includes('Proceed')));
            if (target) {
                target.click();
                return true;
            }
            return false;
        });

        if (clicked) {
            console.log(`[Visitor ${visitorNum}] Successfully clicked target element.`);
            await delay(5000);
        }

        // --- শেষ পেজের স্ক্রিনশট নেওয়া ---
        await page.screenshot({ path: `visitor-${visitorNum}-final-page.png`, fullPage: true });
        console.log(`[Visitor ${visitorNum}] Final page screenshot captured successfully!`);

        const totalMB = (totalBytesDownloaded / (1024 * 1024)).toFixed(2);
        console.log(`[Visitor ${visitorNum}] Session completed! Total Proxy Data Used: ${totalMB} MB`);

    } catch (error) {
        const totalMB = (totalBytesDownloaded / (1024 * 1024)).toFixed(2);
        console.error(`[Visitor ${visitorNum}] Error (Data used: ${totalMB} MB):`, error.message);
    } finally {
        await browser.close();
    }
}

async function runVisitorsPool() {
    console.log(`Starting ${TOTAL_VISITORS} Norway visitors (Anti-Proxy-Block + 5 mins stay + Final Screenshot) | Pool: ${CONCURRENT_LIMIT}\n`);
    
    let currentIndex = 0;
    const workers = [];

    async function worker() {
        while (currentIndex < TOTAL_VISITORS) {
            const visitorIndex = currentIndex++;
            await runSingleVisitor(visitorIndex);
        }
    }

    for (let i = 0; i < Math.min(CONCURRENT_LIMIT, TOTAL_VISITORS); i++) {
        workers.push(worker());
        await delay(2000);
    }

    await Promise.all(workers);
    console.log(`\nAll ${TOTAL_VISITORS} visitors completed their sessions!`);
}

runVisitorsPool();
