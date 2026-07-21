import axios from "axios";
import * as fs from "fs";

async function run() {
  try {
    const target = encodeURIComponent('https://www.maxo.com.au/support/api-documentation/api--call-historycdr-documentation');
    const res = await axios.get(`https://api.allorigins.win/raw?url=${target}`);
    fs.writeFileSync("dump.html", res.data);
    console.log("dumped");
  } catch(e) {
    console.log("Error:", e.message);
  }
}
run();
