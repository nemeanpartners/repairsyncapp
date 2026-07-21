const axios = require('axios');

async function go() {
  const urls = [
    'https://mobilemessage.com.au/api-documentation',
    'https://help.mobilemessage.com.au/api/getting-started-with-the-api'
  ];
  for (const u of urls) {
     try {
       const res = await axios.get(u);
       const text = res.data;
       console.log("=== URL: ", u, " ===");
       
       let index = text.indexOf('auth');
       while (index !== -1) {
           console.log("---");
           console.log(text.substring(index - 100, index + 300).replace(/\n/g, ' '));
           index = text.indexOf('auth', index + 100);
       }
     } catch (err) {
       console.log("Failed", u, err.message);
     }
  }
}
go();
