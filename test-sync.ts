import { getRecentTickets } from "./server/services/repairshoprService.js";
import { getServerAuthPromise } from "./server/firebase.js";

async function run() {
  try {
    await getServerAuthPromise();
    console.log("Logged in");
    const res = await getRecentTickets(process.env.REPAIRSHOPR_SUBDOMAIN || "", process.env.REPAIRSHOPR_API_KEY || "");
    console.log(res);
    process.exit(0);
  } catch(e: any) {
    console.error("Error:", e);
    process.exit(1);
  }
}
run();
