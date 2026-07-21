const cheerio = require('cheerio');
const axios = require('axios');

async function go() {
  const urls = [
    'https://mobilemessage.com.au/api-documentation',
    'https://help.mobilemessage.com.au/api/getting-started-with-the-api'
  ];
  for (const u of urls) {
     try {
       const res = await axios.get(u);
       const $ = cheerio.load(res.data);
       console.log("=== URL: ", u, " ===");
       console.log($('body').text().replace(/\s+/g, ' ').substring(0, 2000));
       console.log("--------");
       let authText = "";
       // Try to find sections about auth
       $('*').each((i, el) => {
         const text = $(el).text();
         if (text.toLowerCase().includes('auth') && $(el).is('p, h1, h2, h3, h4, div')) {
            if (text.length > 50 && text.length < 500) {
               authText += text + "\n";
            }
         }
       });
       console.log("AUTH TEXT:", authText.substring(0, 1000));
     } catch (err) {
       console.log("Failed", u, err.message);
     }
  }
}
go();
