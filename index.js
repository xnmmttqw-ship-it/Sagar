const puppeteer = require('puppeteer-core');

// ৫ থেকে ১০ সেকেন্ডের মধ্যে যেকোনো র্যান্ডম সময় সিলেক্ট করার ফাংশন
function getRandomDelay(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min) * 1000;
}

async function runBot() {
    console.log("Bot starting...");
    try {
        const browser = await puppeteer.launch({
            executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu'
            ],
            headless: true
        });

        const page = await browser.newPage();
        
        // Professional User-Agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        console.log("Visiting target URL...");
        await page.goto('https://privatecallsms.blogspot.com/2026/11/zdf.html', {
            waitUntil: 'networkidle2',
            timeout: 60000
        });

        // পেজে ঢোকার পর ঠিক ১৫ সেকেন্ড অপেক্ষা করবে
        console.log("Simulating engagement for 15 seconds...");
        await new Promise(resolve => setTimeout(resolve, 15000));

        await browser.close();
        console.log("Session completed successfully.");
    } catch (error) {
        console.error("Error occurred:", error);
    }
}

// ইনফিনিট লুপ যেখানে প্রতি সেশনের মাঝে ৫ থেকে ১০ সেকেন্ডের র্যান্ডম বিরতি থাকবে
async function startLoop() {
    while (true) {
        await runBot();
        
        // ৫ থেকে ১০ সেকেন্ডের মধ্যে র্যান্ডম একটি সময় হিসাব করা হচ্ছে
        const randomWait = getRandomDelay(5, 10);
        console.log(`Waiting for ${randomWait / 1000} seconds before next session...`);
        
        await new Promise(resolve => setTimeout(resolve, randomWait));
    }
}

startLoop();
