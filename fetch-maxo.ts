import axios from "axios";

async function run() {
  try {
    const res = await axios.get('https://www.maxo.com.au/support/api-documentation/api--call-historycdr-documentation', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      }
    });
    console.log(res.data.substring(0, 2000));
  } catch (e) {
    console.error(e.message);
  }
}
run();
