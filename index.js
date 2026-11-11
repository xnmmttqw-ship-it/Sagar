const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const TOTAL_VISITORS = parseInt(process.env.VISITOR_COUNT) || 50; 
const CONCURRENT_LIMIT = 5; 
const COUNTRY = 'no'; // নরওয়ে কান্ট্রি কোড
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
    console.log(`[Visitor ${visitorNum}] Starting session (Norway Proxy)...`);
    
    const takeScreenshot = (visitorNum === 1 || visitorNum % 10 === 0);

    // নরওয়ে (Norway) প্রক্সি ডিটেইলস
    const proxyHost = 'gw.hproxy.com';
    const proxyPort = '6969';
    const proxyUser = 'oq752bxt5h-country-no'; 
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

        // --- সিকিউরিটি / ১৮+ পপআপ বা ভেরিফিকেশন অটো-ক্লিক হ্যান্ডলিং ---
        await delay(3000);
        const handledPopup = await page.evaluate(() => {
            const allEls = Array.from(document.querySelectorAll('button, a, div, span'));
            const targetBtn = allEls.find(el => {
                const text = el.textContent || '';
                return text.includes('Yes, I\'m over 18') || 
                       text.includes('Verify you are human') || 
                       text.includes('I am not a robot') ||
                       text.includes('Proceed');
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

        // --- সিকিউরিটি পার হওয়ার পর সুনির্দিষ্ট ১৫ মিনিট (900 সেকেন্ড) পেজে অবস্থান ও হিউম্যান-লাইক স্ক্রোলিং ---
        console.log(`[Visitor ${visitorNum}] Security cleared. Staying on page for 15 minutes...`);
        const startTime = Date.now();
        const targetStayTime = 15 * 60 * 1000; // ঠিক ১৫ মিনিট (১৫ মিনিট × ৬০ সেকেন্ড × ১০০০ মিলিভিসেকেন্ড)
        let scrollCount = 0;

        while (Date.now() - startTime < targetStayTime) {
            await page.evaluate(() => window.scrollBy(0, Math.floor(Math.random() * 200) + 100));
            await delay(5000); // ৫ সেকেন্ড বিরতি দিয়ে স্ক্রোল
            await page.evaluate(() => window.scrollBy(0, -150));
            await delay(5000);
            
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
            await delay(5000);
        }

        console.log(`[Visitor ${visitorNum}] Session completed successfully after 15 minutes!`);

    } catch (error) {
        console.error(`[Visitor ${visitorNum}] Error:`, error.message);
    } finally {
        await browser.close();
    }
}

async function runVisitorsPool() {
    console.log(`Starting ${TOTAL_VISITORS} Norway visitors (15 mins stay) | Pool: ${CONCURRENT_LIMIT}\n`);
    
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
