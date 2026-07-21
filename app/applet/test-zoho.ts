import axios from 'axios';

async function test(url: string) {
  try {
    await axios.get(url);
    console.log(url, "Success?!");
  } catch(e: any) {
    console.log(url, e.response?.status);
  }
}

async function run() {
  await test('https://mail.zoho.com/api/v1/accounts');
  await test('https://mail.zoho.com/api/accounts');
}
run();
