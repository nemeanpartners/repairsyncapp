const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  try {
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    
    // Check if it's public
    await page.goto('https://github.com/repairsphonemedicau-stack/repairsync/commit/6380872.patch', { waitUntil: 'domcontentloaded' });
    const content = await page.evaluate(() => document.body.innerText);
    fs.writeFileSync('patch1.txt', content);
    console.log('Fetched patch 1, length:', content.length);
    
    await page.goto('https://github.com/repairsphonemedicau-stack/repairsync/commit/c8c820f.patch', { waitUntil: 'domcontentloaded' });
    const content2 = await page.evaluate(() => document.body.innerText);
    fs.writeFileSync('patch2.txt', content2);
    console.log('Fetched patch 2, length:', content2.length);

    await browser.close();
  } catch (error) {
    console.error(error);
  }
})();
