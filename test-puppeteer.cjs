const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('requestfailed', request => {
    console.log(`PAGE REQUEST FAILED: ${request.url()} - ${request.failure()?.errorText || 'Unknown'}`);
  });
  
  await page.goto('http://127.0.0.1:3000');
  await new Promise(r => setTimeout(r, 2000));
  
  const rootHtml = await page.evaluate(() => document.getElementById('root').outerHTML);
  console.log(rootHtml.substring(0, 5000));
  
  await browser.close();
})();
