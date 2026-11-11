const puppeteer = require('puppeteer-core');

// কনফিগারেশন ও এনভায়রনমেন্ট ভ্যারিয়েবল
const TARGET_URL = process.env.CAMPAIGN_URL || 'https://auctionr.org/4/5a41eae4c9364b8088fd4ff777a02672';
const COUNTRIES = process.env.COUNTRIES || 'oq752bxt5h-country-us';
const VISITOR_COUNT = parseInt(process.env.VISITOR_COUNT || '10', 10);
const MAX_DATA_MB = parseFloat(process.env.MAX_DATA_MB || '0.2'); // ডাটা লিমিট কঠোরভাবে ০.২০ এমবি

// প্রক্সি কনফিগারেশন
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

    // ব্রাউজার লঞ্চ করার সময় শুধু হোস্ট ও পোর্ট দেওয়া হলো (সিকিউরিটি ও প্রক্সি ফেইলিওর এড়াতে)
    const browser = await puppeteer.launch({
        executablePath: '/usr/bin/google-chrome',
        headless: 'new',
        args: [
            `--proxy-server=http://${proxyHost}:${proxyPort}`,
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--window-size=375,812'
        ]
    });

    try {
        const page = await browser.newPage();
        
        // অত্যন্ত গুরুত্বপূর্ণ: সরাসরি ব্রাউজারে প্রক্সি ইউজারনেম ও পাসওয়ার্ড অথেন্টিকেট করা
        await page.authenticate({
            username: proxyUser,
            password: proxyPass
        });

        // মোবাইল ইউজার এজেন্ট ও ভিউপোর্ট সেটআপ
        await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1');
        await page.setViewport({ width: 375, height: 812, isMobile: true });

        // ডাটা অপ্টিমাইজেশন ও রিসোর্স ব্লকিং
        let totalBytesTransferred = 0;
        await page.setRequestInterception(true);
        page.on('request', req => {
            const resourceType = req.resourceType();
            const url = req.url();

            if (
                ['image', 'font', 'stylesheet', 'media', 'manifest'].includes(resourceType) ||
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
                }
            } catch (e) {}
        });

        console.log(`[Visitor ${visitorNum}] Visiting URL: ${TARGET_URL}`);
        await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

        const targetDurationMinutes = (Math.random() * (10 - 5) + 5).toFixed(2);
        const targetDurationMs = targetDurationMinutes * 60 * 1000;
        console.log(`[Visitor ${visitorNum}] Session active for ${targetDurationMinutes} minutes...`);

        const startTime = Date.now();
        let screenshotTaken = false;

        while (Date.now() - startTime < targetDurationMs) {
            const currentMB = totalBytesTransferred / (1024 * 1024);
            if (currentMB > MAX_DATA_MB) {
                console.log(`[Visitor ${visitorNum}] Data limit reached (${currentMB.toFixed(2)} MB)! Exiting...`);
                break;
            }

            const elapsedTime = Date.now() - startTime;
            if (!screenshotTaken && elapsedTime >= 30000) {
                console.log(`[Visitor ${visitorNum}] Taking 30-second screenshot...`);
                await page.screenshot({ path: `screenshot_visitor_${visitorNum}_30s.png` });
                screenshotTaken = true;
            }

            try {
                const scrollAmount = getRandomInt(100, 350);
                await page.evaluate((scrollVal) => {
                    window.scrollBy({ top: scrollVal, behavior: 'smooth' });
                }, scrollAmount);
            } catch (err) {}

            const pauseTime = getRandomInt(3000, 8000);
            await new Promise(resolve => setTimeout(resolve, pauseTime));
        }

        console.log(`[Visitor ${visitorNum}] Session completed successfully.`);

    } catch (error) {
        console.log(`[Visitor ${visitorNum}] Error: ${error.message}`);
    } finally {
        await browser.close();
    }
}

async function main() {
    console.log(`Starting bot execution for ${VISITOR_COUNT} visitors...`);
    const promises = [];
    for (let i = 1; i <= VISITOR_COUNT; i++) {
        promises.push(runVisitor(i));
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    await Promise.all(promises);
    console.log('All visitor sessions finished.');
}

main();
