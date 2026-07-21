const axios = require('axios');

async function go() {
  const urls = [
    'https://mobilemessage.com.au/api-documentation',
  ];
  for (const u of urls) {
     try {
       const res = await axios.get(u);
       const text = res.data;
       
       let index = text.toLowerCase().indexOf('simple api');
       while (index !== -1) {
           console.log("---");
           console.log(text.substring(index - 100, index + 1000).replace(/\n/g, ' '));
           index = text.toLowerCase().indexOf('simple api', index + 100);
       }
     } catch (err) {
       console.log("Failed", u, err.message);
     }
  }
}
go();
