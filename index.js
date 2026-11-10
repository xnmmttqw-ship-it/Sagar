const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const TOTAL_VISITORS = parseInt(process.env.VISITOR_COUNT) || 50; 
const CONCURRENT_LIMIT = 5; 
const COUNTRY = (process.env.COUNTRY_CODE || 'ca').toLowerCase().trim(); 
const TARGET_URL = process.env.CAMPAIGN_URL || 'https://auctionr.org/4/5a41eae4c9364b8088fd4ff777a02672'; 

const USER_AGENTS = [
    'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
];

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runSingleVisitor(visitorIndex) {
    const visitorNum = visitorIndex + 1;
    console.log(`[Visitor ${visitorNum}] Starting session (Lite Proxy - Country: ${COUNTRY.toUpperCase()})...`);
    
    const takeScreenshot = (visitorNum === 1 || visitorNum % 10 === 0);

    const proxyHost = 'gw.hproxy.com';
    const proxyPort = '6969';
    const proxyUser = 'oq752bxt5h-country-ca'; 
    const proxyPass = 'drym1t6d71';

    await delay(Math.floor(Math.random() * 2000) + 1000);

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
            '--user-data-dir=/tmp/chrome-user-data-' + Math.random() + '-' + Date.now()
        ].filter(Boolean)
    });

    const page = await browser.newPage();

    await page.authenticate({
        username: proxyUser,
        password: proxyPass
    });

    const randomUA = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    await page.setUserAgent(randomUA);
    await page.setViewport({ 
        width: randomUA.includes('Mobile') || randomUA.includes('iPhone') ? 375 : 1366, 
        height: randomUA.includes('Mobile') || randomUA.includes('iPhone') ? 667 : 768 
    });

    try {
        console.log(`[Visitor ${visitorNum}] Visiting URL: ${TARGET_URL}`);
        await page.goto(TARGET_URL, { 
            waitUntil: 'networkidle0',
            timeout: 60000 
        });

        const isRobotPopup = await page.evaluate(() => {
            const text = document.body.innerText || '';
            return text.includes('I am not a robot') || text.includes('Verify you are human') || text.includes('cf-challenge');
        });

        if (isRobotPopup) {
            console.log(`[Visitor ${visitorNum}] Captcha/Block detected! Skipping...`);
            await browser.close();
            return;
        }

        // --- ১০ থেকে ১৫ সেকেন্ড পেজে অবস্থান ও স্ক্রোলিং ---
        console.log(`[Visitor ${visitorNum}] Staying on page for 10-15 seconds...`);
        const startTime = Date.now();
        const targetStayTime = Math.floor(Math.random() * 5000) + 10000; // ১০ থেকে ১৫ সেকেন্ড র‍্যান্ডম সময়
        let scrollCount = 0;

        while (Date.now() - startTime < targetStayTime) {
            await page.evaluate(() => window.scrollBy(0, Math.floor(Math.random() * 150) + 100));
            await delay(2000);
            await page.evaluate(() => window.scrollBy(0, -100));
            await delay(2000);
            
            scrollCount++;
            if (takeScreenshot && scrollCount === 1) {
                await page.screenshot({ path: `visitor-${visitorNum}-scroll.png`, fullPage: true });
            }
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
            await delay(3000); // ক্লিকের পর ৩ সেকেন্ড অপেক্ষা
        }

        console.log(`[Visitor ${visitorNum}] Session completed successfully!`);

    } catch (error) {
        console.error(`[Visitor ${visitorNum}] Error:`, error.message);
    } finally {
        await browser.close();
    }
}

async function runVisitorsPool() {
    console.log(`Starting ${TOTAL_VISITORS} visitors (10-15s stay) | Pool: ${CONCURRENT_LIMIT}\n`);
    
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
        await delay(1000);
    }

    await Promise.all(workers);
    console.log(`\nAll ${TOTAL_VISITORS} visitors completed their sessions!`);
}

runVisitorsPool();
