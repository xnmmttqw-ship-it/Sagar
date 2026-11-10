const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// স্টিলথ প্লাগইন এনাবল করা (যাতে ক্লাউডফ্লেয়ার বা রোবট পপআপ না আসে)
puppeteer.use(StealthPlugin());

// ১০টি ভিন্ন ডিভাইসের User-Agent তালিকা
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
    console.log(`[Visitor ${visitorIndex + 1}] Starting session...`);
    const randomUA = USER_AGENTS[visitorIndex % USER_AGENTS.length];

    const browser = await puppeteer.launch({
        headless: true,
        executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--proxy-server=http://gw.dataimpulse.com:10000' // HTTP প্রক্সি ব্যবহার করা হয়েছে (এরর ফিক্সড)
        ]
    });

    const page = await browser.newPage();

    // DataImpulse প্রক্সি ইউজারনেম ও পাসওয়ার্ড অথেন্টিকেশন
    await page.authenticate({
        username: '4903c5e423ff85d767de_gr',
        password: 'c0615eb1ff9d5fad'
    });

    await page.setUserAgent(randomUA);
    await page.setViewport({ 
        width: randomUA.includes('Mobile') || randomUA.includes('iPhone') ? 375 : 1366, 
        height: randomUA.includes('Mobile') || randomUA.includes('iPhone') ? 667 : 768 
    });

    try {
        console.log(`[Visitor ${visitorIndex + 1}] Visiting target URL...`);
        await page.goto('https://privatecallsms.blogspot.com/2026/11/zdf.html', { 
            waitUntil: 'networkidle2',
            timeout: 60000 
        });

        // "I am not a robot" বা ক্যাপচা পপআপ চেकिंग
        const isRobotPopup = await page.evaluate(() => {
            const text = document.body.innerText || '';
            return text.includes('I am not a robot') || text.includes('Verify you are human') || text.includes('cf-challenge');
        });

        if (isRobotPopup) {
            console.log(`[Visitor ${visitorIndex + 1}] Robot popup detected! Skipping this session...`);
            await browser.close();
            return;
        }

        // ১. মানুষের মতো ৫ সেকেন্ড স্ক্রোল
        console.log(`[Visitor ${visitorIndex + 1}] Human-like scrolling (5s)...`);
        await humanLikeScroll(page, 5000);

        // ২. লাল লেখায় ("পড়া শুরু করুন") ক্লিক করা
        console.log(`[Visitor ${visitorIndex + 1}] Clicking the red button...`);
        await delay(Math.floor(Math.random() * 1500) + 500);

        const clicked = await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('a, button, div, span'));
            const target = elements.find(el => el.textContent && el.textContent.includes('পড়া শুরু করুন'));
            if (target) {
                target.click();
                return true;
            }
            return false;
        });

        if (clicked) {
            console.log(`[Visitor ${visitorIndex + 1}] Successfully clicked red button!`);
        } else {
            console.log(`[Visitor ${visitorIndex + 1}] Red button not found.`);
        }

        // ৩. ক্লিকের পর আরও ৫ সেকেন্ড স্ক্রোল
        console.log(`[Visitor ${visitorIndex + 1}] Post-click scrolling (5s)...`);
        await humanLikeScroll(page, 5000);

        console.log(`[Visitor ${visitorIndex + 1}] Session completed!`);

    } catch (error) {
        console.error(`[Visitor ${visitorIndex + 1}] Error:`, error.message);
    } finally {
        await browser.close();
    }
}

// মানুষের মতো স্ক্রোলিং ফাংশন
async function humanLikeScroll(page, durationMs) {
    const startTime = Date.now();
    while (Date.now() - startTime < durationMs) {
        const scrollAmount = Math.floor(Math.random() * 200) + 100;
        await page.evaluate((y) => window.scrollBy(0, y), scrollAmount);
        await delay(Math.floor(Math.random() * 800) + 400);

        if (Math.random() > 0.6) {
            await page.evaluate(() => window.scrollBy(0, -80));
            await delay(500);
        }
    }
}

// ১০ জন ভিজিটর একসাথে রান করানো
async function runTenVisitorsParallel() {
    console.log("Starting batch of 10 stealth visitors with proxy...\n");
    const tasks = [];
    
    for (let i = 0; i < 10; i++) {
        tasks.push(runSingleVisitor(i));
        await delay(Math.floor(Math.random() * 1500) + 500);
    }

    await Promise.all(tasks);
    console.log("\nAll 10 visitors finished their sessions.");
}

runTenVisitorsParallel();
