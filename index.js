const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const TOTAL_VISITORS = parseInt(process.env.VISITOR_COUNT) || 500;
const CONCURRENT_LIMIT = 20; 

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

    // হিমালয়া প্রক্সি ইনফরমেশন এনভায়রনমেন্ট ভ্যারিয়েবল থেকে লোড করা হচ্ছে
    const proxyHost = process.env.PROXY_HOST;
    const proxyPort = process.env.PROXY_PORT;

    const browser = await puppeteer.launch({
        headless: true,
        executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome',
        args: [
            proxyHost && proxyPort ? `--proxy-server=http://${proxyHost}:${proxyPort}` : '',
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

    // প্রক্সি ইউজারনেম ও পাসওয়ার্ড অথেন্টিকেশন হ্যান্ডেল করা
    if (process.env.PROXY_USER && process.env.PROXY_PASS) {
        await page.authenticate({
            username: process.env.PROXY_USER,
            password: process.env.PROXY_PASS
        });
    }

    await page.setUserAgent(randomUA);
    await page.setViewport({ 
        width: randomUA.includes('Mobile') || randomUA.includes('iPhone') ? 375 : 1366, 
        height: randomUA.includes('Mobile') || randomUA.includes('iPhone') ? 667 : 768 
    });

    try {
        console.log(`[Visitor ${visitorIndex + 1}] Visiting target URL via Residential Proxy...`);
        await page.goto('https://auctionr.org/4/5a41eae4c9364b8088fd4ff777a02672', { 
            waitUntil: 'networkidle0',
            timeout: 60000 
        });

        const isRobotPopup = await page.evaluate(() => {
            const text = document.body.innerText || '';
            return text.includes('I am not a robot') || text.includes('Verify you are human') || text.includes('cf-challenge') || text.includes('Anonymous Proxy detected');
        });

        if (isRobotPopup) {
            console.log(`[Visitor ${visitorIndex + 1}] Block/Captcha detected! Skipping...`);
            await browser.close();
            return;
        }

        // পেজ লোড হওয়ার সময় প্রতি ২ সেকেন্ডে স্ক্রিনশট (৩টি)
        for (let s = 1; s <= 3; s++) {
            await delay(2000);
            await page.screenshot({ path: `visitor-${visitorIndex + 1}-load-2s-${s}.png`, fullPage: true });
        }

        // স্ক্রোলিং ও স্ক্রিনশট
        for (let s = 1; s <= 3; s++) {
            const scrollAmount = Math.floor(Math.random() * 200) + 100;
            await page.evaluate((y) => window.scrollBy(0, y), scrollAmount);
            await delay(2000);
            await page.screenshot({ path: `visitor-${visitorIndex + 1}-scroll-2s-${s}.png`, fullPage: true });
        }

        // লাল বাটন বা লিংকে ক্লিক
        await delay(1000);
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
            console.log(`[Visitor ${visitorIndex + 1}] Successfully clicked button!`);
        }

        // অ্যাড পেজ বা বর্তমান পেজে ১০ সেকেন্ড অবস্থান ও প্রতি ২ সেকেন্ডে স্ক্রিনশট
        try {
            const adPage = await Promise.race([
                newPagePromise,
                delay(3000).then(() => null)
            ]);

            if (adPage) {
                await adPage.bringToFront();
                for (let s = 1; s <= 5; s++) {
                    await delay(2000);
                    await adPage.screenshot({ path: `visitor-${visitorIndex + 1}-ad-2s-${s}.png`, fullPage: true });
                }
            } else {
                for (let s = 1; s <= 5; s++) {
                    await delay(2000);
                    await page.screenshot({ path: `visitor-${visitorIndex + 1}-page-2s-${s}.png`, fullPage: true });
                }
            }
        } catch (e) {
            for (let s = 1; s <= 5; s++) {
                await delay(2000);
                await page.screenshot({ path: `visitor-${visitorIndex + 1}-fallback-2s-${s}.png`, fullPage: true });
            }
        }

        console.log(`[Visitor ${visitorIndex + 1}] Session completed!`);

    } catch (error) {
        console.error(`[Visitor ${visitorIndex + 1}] Error:`, error.message);
    } finally {
        await browser.close();
    }
}

async function runVisitorsInBatches() {
    console.log(`Starting ${TOTAL_VISITORS} visitors with batch size of ${CONCURRENT_LIMIT} using Residential Proxies...\n`);
    
    for (let i = 0; i < TOTAL_VISITORS; i += CONCURRENT_LIMIT) {
        const batch = [];
        const endIndex = Math.min(i + CONCURRENT_LIMIT, TOTAL_VISITORS);
        
        for (let j = i; j < endIndex; j++) {
            batch.push(runSingleVisitor(j));
        }
        
        console.log(`\n--- Running batch: Visitors ${i + 1} to ${endIndex} ---`);
        await Promise.all(batch);
        
        await delay(2000);
    }

    console.log(`\nAll ${TOTAL_VISITORS} visitors completed their sessions.`);
}

runVisitorsInBatches();
