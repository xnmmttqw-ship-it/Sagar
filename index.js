const puppeteer =- require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const TOTAL_VISITORS = parseInt(process.env.VISITOR_COUNT) || 50; 
const CONCURRENT_LIMIT = 5; // সবসময় একসাথে সর্বোচ্চ ৫ জন একটিভ থাকবে

const USER_AGENTS = [
    'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Linux; Android 13; Redmi Note 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 11; OnePlus 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0',
    'Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
];

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runSingleVisitor(visitorIndex) {
    const visitorNum = visitorIndex + 1;
    console.log(`[Visitor ${visitorNum}] Starting session...`);
    
    // শুধু ১, ১০, ২০, ৩০, ৪০, ৫০... এই নাম্বারগুলোর জন্য স্ক্রিনশট তোলার শর্ত
    const takeScreenshot = (visitorNum === 1 || visitorNum % 10 === 0);

    // হিমালয়া প্রক্সি ইনফরমেশন সরাসরি কোডের ভেতরে বসানো
    const proxyHost = 'premium.hproxy.com';
    const proxyPort = '9000';
    const proxyUser = 'hproxy_16o3tblbl7xi-type-residential-country-us';
    const proxyPass = '625ae9b4-1138-45b0-9bcd-80fcca6c67b3';

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

    // প্রক্সি ইউজারনেম ও পাসওয়ার্ড অথেন্টিকেশন
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
        console.log(`[Visitor ${visitorNum}] Visiting target URL via Residential Proxy...`);
        await page.goto('https://auctionr.org/4/5a41eae4c9364b8088fd4ff777a02672', { 
            waitUntil: 'networkidle0',
            timeout: 60000 
        });

        const isRobotPopup = await page.evaluate(() => {
            const text = document.body.innerText || '';
            return text.includes('I am not a robot') || text.includes('Verify you are human') || text.includes('cf-challenge') || text.includes('Anonymous Proxy detected');
        });

        if (isRobotPopup) {
            console.log(`[Visitor ${visitorNum}] Block/Captcha detected! Skipping...`);
            await browser.close();
            return;
        }

        // --- মূল পেজে ৩০ সেকেন্ড অবস্থান ও আপ-ডাউন স্ক্রোলিং ---
        console.log(`[Visitor ${visitorNum}] Staying on main page & scrolling for ~30 seconds...`);
        const mainStartTime = Date.now();
        let scrollCount = 0;

        while (Date.now() - mainStartTime < 30000) {
            await page.evaluate(() => window.scrollBy(0, 300));
            await delay(2500);
            await page.evaluate(() => window.scrollBy(0, -200));
            await delay(2500);
            
            scrollCount++;
            if (takeScreenshot && scrollCount <= 3) {
                await page.screenshot({ path: `visitor-${visitorNum}-main-scroll-${scrollCount}.png`, fullPage: true });
            }
        }

        // --- বাটন বা লিংকে ক্লিক করার অংশ ---
        const newPagePromise = new Promise(resolve => browser.once('target', async target => {
            const newPage = await target.page();
            resolve(newPage);
        }));

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
            console.log(`[Visitor ${visitorNum}] Successfully clicked button!`);
        } else {
            console.log(`[Visitor ${visitorNum}] Button not found, continuing session...`);
        }

        // --- পরবর্তী পেজে গিয়ে ১৫ সেকেন্ড আপ-ডাউন স্ক্রোলিং ---
        try {
            const adPage = await Promise.race([
                newPagePromise,
                delay(4000).then(() => null)
            ]);

            const targetPage = adPage || page;
            if (adPage) {
                await adPage.bringToFront();
                console.log(`[Visitor ${visitorNum}] Switched to new target/ad page.`);
            }

            console.log(`[Visitor ${visitorNum}] Staying on destination page & scrolling for 15 seconds...`);
            const subStartTime = Date.now();
            let subScrollCount = 0;

            while (Date.now() - subStartTime < 15000) {
                await targetPage.evaluate(() => window.scrollBy(0, 350));
                await delay(2500);
                await targetPage.evaluate(() => window.scrollBy(0, -250));
                await delay(2500);

                subScrollCount++;
                if (takeScreenshot && subScrollCount <= 2) {
                    await targetPage.screenshot({ path: `visitor-${visitorNum}-destination-scroll-${subScrollCount}.png`, fullPage: true });
                }
            }

        } catch (e) {
            console.log(`[Visitor ${visitorNum}] Navigation handling finished with fallback time.`);
            await delay(15000);
        }

        console.log(`[Visitor ${visitorNum}] Session completed successfully!`);

    } catch (error) {
        console.error(`[Visitor ${visitorNum}] Error [Visitor ${visitorNum}]:`, error.message);
    } finally {
        await browser.close();
    }
}

async function runVisitorsPool() {
    console.log(`Starting ${TOTAL_VISITORS} visitors with dynamic rolling limit of ${CONCURRENT_LIMIT}...\n`);
    
    let currentIndex = 0;
    const workers = [];

    // একটি করে ভিজিটর নিয়ে কাজ করবে এবং শেষ হওয়া মাত্র কিউ থেকে পরের জন ঢুকে পড়বে
    async function worker() {
        while (currentIndex < TOTAL_VISITORS) {
            const visitorIndex = currentIndex++;
            await runSingleVisitor(visitorIndex);
        }
    }

    // একসাথে নির্দিষ্ট সংখ্যক (৫টি) ওয়ার্কার বা স্লট চালু করা হলো
    for (let i = 0; i < Math.min(CONCURRENT_LIMIT, TOTAL_VISITORS); i++) {
        workers.push(worker());
    }

    // সব ভিজিটরের কাজ শেষ হওয়া পর্যন্ত অপেক্ষা করবে
    await Promise.all(workers);

    console.log(`\nAll ${TOTAL_VISITORS} visitors completed their sessions successfully!`);
}

runVisitorsPool();
