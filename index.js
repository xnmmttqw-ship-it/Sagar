const puppeteer = require('puppeteer-core');

async function runBot() {
    console.log("Bot starting...");
    
    // ব্রাউজার লঞ্চ করা (গিটহাব অ্যাকশনস বা লিনাক্স এনভায়রনমেন্টের জন্য উপযুক্ত কনফিগারেশন)
    const browser = await puppeteer.launch({
        headless: true,
        executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu'
        ]
    });

    const page = await browser.newPage();
    
    // মোবাইল ভিউপোর্ট সেট করা (যাতে আপনার স্ক্রিনশটের মতো মোবাইল লেআউট বা লাল বাটনটি পারফেক্ট পায়)
    await page.setViewport({ width: 375, height: 667 });

    try {
        console.log("Visiting target URL...");
        // আপনার টার্গেট ব্লগ ইউআরএল
        await page.goto('https://privatecallsms.blogspot.com/2026/11/zdf.html', { 
            waitUntil: 'networkidle2',
            timeout: 60000 
        });

        // ১. পেজে ঢোকার পর প্রথম ৫ সেকেন্ড ওপর-নিচে স্ক্রোল করা
        console.log("Scrolling for 5 seconds before click...");
        await autoScroll(page, 5000);

        // ২. লাল লেখায় ("পড়া শুরু করুন") ক্লিক করা
        console.log("Clicking the red button...");
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
            console.log("Successfully clicked the red button!");
        } else {
            console.log("Red button not found, continuing...");
        }

        // ৩. ক্লিক করার পর আরও ৫ সেকেন্ড ওপর-নিচে স্ক্রোল করা
        console.log("Scrolling for 5 seconds after click...");
        await autoScroll(page, 5000);

        console.log("Session completed successfully.");

    } catch (error) {
        console.error("Error occurred:", error);
    } finally {
        await browser.close();
    }
}

// নির্দিষ্ট সময় ধরে ওপর-নিচে স্ক্রোল করার ফাংশন
async function autoScroll(page, durationMs) {
    const startTime = Date.now();
    while (Date.now() - startTime < durationMs) {
        await page.evaluate(() => {
            window.scrollBy(0, 300);
        });
        await new Promise(resolve => setTimeout(resolve, 1000)); // ১ সেকেন্ড বিরতি দিয়ে স্ক্রোল
        await page.evaluate(() => {
            window.scrollBy(0, -150);
        });
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}

// ইনফিনিট লুপ ও র্যান্ডম বিরতি (৫ থেকে ১০ সেকেন্ড)
async function mainLoop() {
    while (true) {
        await runBot();
        const randomDelay = Math.floor(Math.random() * 6000) + 5000; // ৫ থেকে ১০ সেকেন্ড র্যান্ডম বিরতি
        console.log(`Waiting for ${randomDelay / 1000} seconds before next session...\n`);
        await new Promise(resolve => setTimeout(resolve, randomDelay));
    }
}

mainLoop();
