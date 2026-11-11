const puppeteer = require('puppeteer-core');

const TARGET_URL = process.env.CAMPAIGN_URL || 'https://auctionr.org/4/5a41eae4c9364b8088fd4ff777a02672';
const COUNTRIES = process.env.COUNTRIES || 'oq752bxt5h-country-us';
const VISITOR_COUNT = parseInt(process.env.VISITOR_COUNT || '1', 10);
const MAX_DATA_MB = parseFloat(process.env.MAX_DATA_MB || '0.2');

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

    const browser = await puppeteer.launch({
        executablePath: '/usr/bin/google-chrome',
        headless: 'new',
        args: [
            `--proxy-server=http://${proxyHost}:${proxyPort}`,
            '--ignore-certificate-errors',
            '--ignore-certificate-errors-spki-list',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--window-size=375,812'
        ]
    });

    let totalBytesTransferred = 0;
    const sessionStartTime = Date.now();

    try {
        const page = await browser.newPage();
        
        await page.authenticate({
            username: proxyUser,
            password: proxyPass
        });

        await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1');
        await page.setViewport({ width: 375, height: 812, isMobile: true });

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

        // --- স্মার্ট অ্যাডভান্সড সিকিউরিটি / এজ ভেরিফিকেশন হ্যান্ডলার ---
        try {
            console.log(`[Visitor ${visitorNum}] Scanning page for age verification or security popups...`);
            await page.waitForTimeout(3000); 
            
            const clicked = await page.evaluate(() => {
                const elements = Array.from(document.querySelectorAll('button, a, div, span, input[type="button"], input[type="submit"]'));
                const targetKeywords = [
                    'yes', 'continue', 'i am 18', 'i am over 18', '18+', 'enter', 
                    'agree', 'accept', 'verify', 'proceed', 'ok', 'موافق', 'حاب'
                ];

                for (let el of elements) {
                    const text = el.innerText ? el.innerText.trim().toLowerCase() : '';
                    const value = el.value ? el.value.trim().toLowerCase() : '';
                    const matched = targetKeywords.some(keyword => text.includes(keyword) || value.includes(keyword));
                    
                    if (matched && el.offsetParent !== null) {
                        el.click();
                        return { success: true, clickedText: text || value };
                    }
                }
                return { success: false };
            });

            if (clicked && clicked.success) {
                console.log(`[Visitor ${visitorNum}] [SUCCESS] Security/Age popup bypassed! Clicked on: "${clicked.clickedText}"`);
            } else {
                console.log(`[Visitor ${visitorNum}] [INFO] No popup found or already bypassed.`);
            }
        } catch (e) {
            console.log(`[Visitor ${visitorNum}] [INFO] Popup check skipped.`);
        }
        // ----------------------------------------------------------------

        // টেস্টিংয়ের জন্য সর্বোচ্চ সময় ১ মিনিট (৬০ সেকেন্ড) সেট করা হলো
        const targetDurationMs = 60 * 1000; 
        console.log(`[Visitor ${visitorNum}] Session active target: 1 minute for testing...`);

        let screenshotTaken = false;

        while (Date.now() - sessionStartTime < targetDurationMs) {
            const currentMB = totalBytesTransferred / (1024 * 1024);
            if (currentMB > MAX_DATA_MB) {
                console.log(`[Visitor ${visitorNum}] Data limit reached (${currentMB.toFixed(4)} MB)! Exiting...`);
                break;
            }

            const elapsedTime = Date.now() - sessionStartTime;
            if (!screenshotTaken && elapsedTime >= 15000) { // টেস্টের সুবিধार्थে ১৫ সেকেন্ডে স্ক্রিনশট
                console.log(`[Visitor ${visitorNum}] Taking test screenshot...`);
                await page.screenshot({ path: `screenshot_visitor_${visitorNum}_test.png` });
                screenshotTaken = true;
            }

            try {
                const scrollAmount = getRandomInt(100, 300);
                await page.evaluate((scrollVal) => {
                    window.scrollBy({ top: scrollVal, behavior: 'smooth' });
                }, scrollAmount);
            } catch (err) {}

            const pauseTime = getRandomInt(2000, 4000);
            await new Promise(resolve => setTimeout(resolve, pauseTime));
        }

        const totalDurationSec = ((Date.now() - sessionStartTime) / 1000).toFixed(1);
        const finalMB = (totalBytesTransferred / (1024 * 1024)).toFixed(4);
        const finalKB = (totalBytesTransferred / 1024).toFixed(2);

        console.log(`[Visitor ${visitorNum}] [SUCCESS] Test Session completed & Exited!`);
        console.log(`[Visitor ${visitorNum}] -> Total Time on Page: ${totalDurationSec} seconds`);
        console.log(`[Visitor ${visitorNum}] -> Total Data Used: ${finalMB} MB (${finalKB} KB)`);

    } catch (error) {
        const totalDurationSec = ((Date.now() - sessionStartTime) / 1000).toFixed(1);
        const finalMB = (totalBytesTransferred / (1024 * 1024)).toFixed(4);
        console.log(`[Visitor ${visitorNum}] [ERROR] ${error.message} | Time spent: ${totalDurationSec}s | Data Used: ${finalMB} MB`);
    } finally {
        await browser.close();
    }
}

async function main() {
    console.log(`Starting bot execution for test...`);
    await runVisitor(1);
    console.log('Test session finished.');
}

main();
