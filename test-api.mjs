const axios = require('axios');
const username = process.env.SMS_USER;
const password = process.env.SMS_PASS;

async function testMobileMessageApi() {
  const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
  console.log("Testing with username:", username);

  const endpoints = [
    { url: 'https://api.mobilemessage.com.au/v1/send.json', method: 'post', data: { to: '0400000000', message: 'test' } },
    { url: 'https://api.mobilemessage.com.au/v1/messages', method: 'post', data: { to: '0400000000', body: 'test' } },
    { url: 'https://api.mobilemessage.com.au/v1/messages/send', method: 'post', data: { to: '0400000000', message: 'test' } },
    { url: 'https://api.mobilemessage.com.au/send-sms.json', method: 'post', query: { username, password, to: '0400000000', message: 'test' } },
    { url: 'https://mobilemessage.com.au/api/send', method: 'post', data: { to: '0400000000', message: 'test' } }
  ];

  for(const ep of endpoints) {
    try {
      console.log(`Trying ${ep.url}...`);
      let res;
      if (ep.query) {
         res = await axios.post(ep.url + "?" + new URLSearchParams(ep.query).toString());
      } else {
         res = await axios.post(ep.url, ep.data, { headers: { Authorization: authHeader } });
      }
      console.log(`Success ${ep.url}:`, res.status);
    } catch(err) {
      console.log(`Failed ${ep.url}:`, err.response?.status, err.response?.data);
    }
  }
}

testMobileMessageApi();
