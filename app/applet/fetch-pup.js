const puppeteer = require('puppeteer');

(async () => {
  try {
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.goto('https://www.maxo.com.au/support/api-documentation/api--call-historycdr-documentation', { waitUntil: 'domcontentloaded' });
    const content = await page.evaluate(() => document.body.innerText);
    console.log(content.substring(0, 3000));
    await browser.close();
  } catch (error) {
    console.error(error);
  }
})();
