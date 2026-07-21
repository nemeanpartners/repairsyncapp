import axios from "axios";

async function run() {
  try {
    const target = encodeURIComponent('https://www.maxo.com.au/support/api-documentation/api--call-historycdr-documentation');
    const res = await axios.get(`https://api.allorigins.win/raw?url=${target}`);
    console.log(res.data.substring(0, 3000));
  } catch(e) {
    console.log("Error:", e.message);
  }
}
run();
