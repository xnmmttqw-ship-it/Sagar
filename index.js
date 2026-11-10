const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

// গিটহাব ইনপুট বা ডিফল্ট ১০ জন ভিজিটর
const TOTAL_VISITORS = parseInt(process.env.VISITOR_COUNT) || 10;

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
            '--disable-infobars',
            '--window-position=0,0',
            '--ignore-certificate-errors',
            '--user-data-dir=/tmp/chrome-user-data-' + Math.random() + '-' + Date.now(),
            '--proxy-server=http://gw.dataimpulse.com:10000'
        ]
    });

    const page = await browser.newPage();

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
        await page.goto('https://auctionr.org/4/5a41eae4c9364b8088fd4ff777a02672', { 
            waitUntil: 'networkidle0',
            timeout: 60000 
        });


        const isRobotPopup = await page.evaluate(() => {
            const text = document.body.innerText || '';
            return text.includes('I am not a robot') || text.includes('Verify you are human') || text.includes('cf-challenge');
        });

        if (isRobotPopup) {
            console.log(`[Visitor ${visitorIndex + 1}] Robot popup detected! Skipping this session...`);
            await browser.close();
            return;
        }

        // অ্যাড লোড হওয়ার সময় প্রতি ২ সেকেন্ডে স্ক্রিনশট (মোট ৬ সেকেন্ডে ৩টি)
        console.log(`[Visitor ${visitorIndex + 1}] Taking screenshots every 2s while waiting for ads...`);
        for (let s = 1; s <= 3; s++) {
            await delay(2000);
            await page.screenshot({ path: `visitor-${visitorIndex + 1}-load-2s-${s}.png`, fullPage: true });
        }

        // মানবিকভাবে স্ক্রোল করার সময় প্রতি ২ সেকেন্ডে স্ক্রিনশট
        console.log(`[Visitor ${visitorIndex + 1}] Human-like scrolling with screenshots every 2s...`);
        for (let s = 1; s <= 3; s++) {
            const scrollAmount = Math.floor(Math.random() * 200) + 100;
            await page.evaluate((y) => window.scrollBy(0, y), scrollAmount);
            await delay(2000);
            await page.screenshot({ path: `visitor-${visitorIndex + 1}-scroll-2s-${s}.png`, fullPage: true });
        }

        // লাল বাটনে ক্লিক
        console.log(`[Visitor ${visitorIndex + 1}] Clicking the red button...`);
        await delay(1000);

        const newPagePromise = new Promise(resolve => browser.once('target', async target => {
            const newPage = await target.page();
            resolve(newPage);
        }));

        const clicked = await page.evaluate(() => {
            const allEls = Array.from(document.querySelectorAll('a, button, div, span'));
            const target = allEls.find(el => el.textContent && el.textContent.includes('পড়া শুরু করুন'));
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

        // অ্যাড পেজ বা নতুন ট্যাবে গিয়ে প্রতি ২ সেকেন্ডে স্ক্রিনশট (মোট ১০ সেকেন্ডে ৫টি)
        try {
            const adPage = await Promise.race([
                newPagePromise,
                delay(3000).then(() => null)
            ]);

            if (adPage) {
                console.log(`[Visitor ${visitorIndex + 1}] Ad page detected! Capturing screenshot every 2s for 10s...`);
                await adPage.bringToFront();
                
                for (let s = 1; s <= 5; s++) {
                    await delay(2000);
                    await adPage.screenshot({ path: `visitor-${visitorIndex + 1}-ad-2s-${s}.png`, fullPage: true });
                }
            } else {
                console.log(`[Visitor ${visitorIndex + 1}] Capturing screenshot every 2s on current page for 10s...`);
                for (let s = 1; s <= 5; s++) {
                    await delay(2000);
                    await page.screenshot({ path: `visitor-${visitorIndex + 1}-page-2s-${s}.png`, fullPage: true });
                }
            }
        } catch (e) {
            console.log(`[Visitor ${visitorIndex + 1}] Ad timer notice:`, e.message);
            for (let s = 1; s <= 5; s++) {
                await delay(2000);
                await page.screenshot({ path: `visitor-${visitorIndex + 1}-fallback-2s-${s}.png`, fullPage: true });
            }
        }

        console.log(`[Visitor ${visitorIndex + 1}] Session completed successfully!`);

    } catch (error) {
        console.error(`[Visitor ${visitorIndex + 1}] Error:`, error.message);
    } finally {
        await browser.close();
    }
}

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
