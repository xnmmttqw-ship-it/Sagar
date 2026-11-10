const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const TOTAL_VISITORS = 20; // মোট ২০ জন ভিজিটর
const CONCURRENT_LIMIT = 5; // একবারে মাত্র ৫ জন ব্রাউজার চলবে (প্রক্সি সেফ)
const COUNTRY = 'ca'; 
const TARGET_URL = 'https://auctionr.org/4/5a41eae4c9364b8088fd4ff777a02672'; 

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runSingleVisitor(visitorIndex) {
    const visitorNum = visitorIndex + 1;
    console.log(`[Visitor ${visitorNum}] Starting session...`);
    
    const takeScreenshot = (visitorNum === 1 || visitorNum % 10 === 0);

    const browser = await puppeteer.launch({
        headless: true,
        executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome',
        args: [
            `--proxy-server=http://premium.hproxy.com:9000`,
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--user-data-dir=/tmp/chrome-' + Math.random()
        ]
    });

    const page = await browser.newPage();
    await page.authenticate({
        username: `hproxy_16o3tblbl7xi-type-residential-country-${COUNTRY}`,
        password: '625ae9b4-1138-45b0-9bcd-80fcca6c67b3'
    });

    try {
        await page.goto(TARGET_URL, { waitUntil: 'networkidle0', timeout: 60000 });
        console.log(`[Visitor ${visitorNum}] Page loaded successfully!`);

        // ৩০ সেকেন্ড স্ক্রোলিং
        const startTime = Date.now();
        while (Date.now() - startTime < 30000) {
            await page.evaluate(() => window.scrollBy(0, 200));
            await delay(3000);
            if (takeScreenshot) {
                await page.screenshot({ path: `visitor-${visitorNum}.png`, fullPage: true });
            }
        }
    } catch (error) {
        console.error(`[Visitor ${visitorNum}] Error:`, error.message);
    } finally {
        await browser.close();
    }
}

async function runPool() {
    let index = 0;
    const workers = [];
    async function worker() {
        while (index < TOTAL_VISITORS) {
            const current = index++;
            await runSingleVisitor(current);
            await delay(2000); // প্রতি ভিজিটরের মাঝে ২ সেকেন্ড বিরতি
        }
    }
    for (let i = 0; i < CONCURRENT_LIMIT; i++) {
        workers.push(worker());
    }
    await Promise.all(workers);
    console.log("All visitors finished!");
}

runPool();
