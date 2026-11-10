const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

// গিটহাব ইনপুট বা ডিফল্ট ১০ জন ভিজিটর
const TOTAL_VISITORS = parseInt(process.env.VISITOR_COUNT) || 10;

// বিভিন্ন ডিভাইসের User-Agent তালিকা
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
    
    // র‍্যান্ডম ইউজার-এজেন্ট সিলেক্ট
    const randomUA = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

    const browser = await puppeteer.launch({
        headless: true,
        executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--proxy-server=http://gw.dataimpulse.com:10000'
        ]
    });

    const page = await browser.newPage();

    // DataImpulse প্রক্সিতে সেশন আইডি দিয়ে ১০০% ইউনিক আইপি জেনারেট করা
    const randomSessionId = Math.floor(Math.random() * 10000000);
    const proxyUser = `4903c5e423ff85d767de_gr_session-${randomSessionId}`;

    await page.authenticate({
        username: proxyUser,
        password: 'c0615eb1ff9d5fad'
    });

    await page.setUserAgent(randomUA);
    await page.setViewport({ 
        width: randomUA.includes('Mobile') || randomUA.includes('iPhone') ? 375 : 1366, 
        height: randomUA.includes('Mobile') || randomUA.includes('iPhone') ? 667 : 768 
    });

    try {
        console.log(`[Visitor ${visitorIndex + 1}] Visiting target URL with new IP...`);
        await page.goto('https://privatecallsms.blogspot.com/2026/11/zdf.html', { 
            waitUntil: 'networkidle2',
            timeout: 60000 
        });

        // "I am not a robot" বা ক্যাপচা পপআপ চেকিং
        const isRobotPopup = await page.evaluate(() => {
            const text = document.body.innerText || '';
            return text.includes('I am not a robot') || text.includes('Verify you are human') || text.includes('cf-challenge');
        });

        if (isRobotPopup) {
            console.log(`[Visitor ${visitorIndex + 1}] Robot popup detected! Skipping this session...`);
            await browser.close();
            return;
        }

        // ১. ৫ সেকেন্ড স্ক্রোল
        console.log(`[Visitor ${visitorIndex + 1}] Human-like scrolling (5s)...`);
        await humanLikeScroll(page, 5000);

        // ২. "পড়া শুরু করুন" বাটনে ক্লিক
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

// স্ক্রোলিং ফাংশন
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

// সমান্তরালভাবে ভিজিটর রান করানো
async function runVisitorsParallel() {
    console.log(`Starting batch of ${TOTAL_VISITORS} stealth visitors with unique IPs...\n`);
    const tasks = [];
    
    for (let i = 0; i < TOTAL_VISITORS; i++) {
        tasks.push(runSingleVisitor(i));
        await delay(Math.floor(Math.random() * 1500) + 500);
    }

    await Promise.all(tasks);
    console.log(`\nAll ${TOTAL_VISITORS} visitors finished their sessions.`);
}

runVisitorsParallel();
