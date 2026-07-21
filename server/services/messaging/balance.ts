import axios from 'axios';

let cachedBalance: any = null;
let lastBalanceFetch: number = 0;

export async function getMobileMessageBalance() {
  const username = process.env.MOBILE_MESSAGE_USERNAME;
  const password = process.env.MOBILE_MESSAGE_PASSWORD;

  if (!username || !password) {
    return { credit_balance: null };
  }

  if (cachedBalance !== null && Date.now() - lastBalanceFetch < 300000) {
    return { credit_balance: cachedBalance };
  }

  const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');

  const balanceEndpoints = [
    { url: 'https://api.mobilemessage.com.au/v1/account', headers: { 'Authorization': authHeader } },
    { url: 'https://api.mobilemessage.com.au/simple/get-balance.php', params: { api_username: username, api_password: password } }
  ];

  let lastBalanceErr = null;
  let rateLimited = false;

  for (const endpoint of balanceEndpoints) {
    try {
      console.log(`[SMS Service] Trying balance endpoint: ${endpoint.url}`);
      const response = await axios.get(endpoint.url, {
        headers: endpoint.headers,
        params: endpoint.params
      });

      cachedBalance = response.data.credit_balance || response.data.balance || (response.data.data ? response.data.data.balance : 0);
      lastBalanceFetch = Date.now();
      return {
        credit_balance: cachedBalance,
        description: "Remaining SMS credits. Each credit represents 1 SMS up to 160 characters."
      };
    } catch (inner: any) {
      const errData = inner.response?.data || inner.message;
      lastBalanceErr = errData;
      if (inner.response?.status === 429 || JSON.stringify(errData).includes("Rate exceeded")) {
        rateLimited = true;
        break;
      }
    }
  }

  if (rateLimited) {
    lastBalanceFetch = Date.now();
    if (cachedBalance === null) cachedBalance = "Rate Limited";
    return { credit_balance: cachedBalance === "Rate Limited" ? null : cachedBalance };
  }

  throw new Error(typeof lastBalanceErr === 'string' ? lastBalanceErr : 'Balance fetch failed');
}
