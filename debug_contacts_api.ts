
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config({ override: true });

async function debug() {
  const subdomain = process.env.REPAIRSHOPR_SUBDOMAIN;
  const apiKey = process.env.REPAIRSHOPR_API_KEY;
  if (!subdomain || !apiKey) {
    console.error('Missing config');
    return;
  }

  try {
    const resp = await axios.get(`https://${subdomain}.repairshopr.com/api/v1/contacts`, {
       params: { page: 1 },
       headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    console.log('Contacts found:', resp.data.contacts?.length || 0);
    if (resp.data.contacts?.length > 0) {
      console.log('Sample contact:', JSON.stringify(resp.data.contacts[0], null, 2));
    }
  } catch (e: any) {
    console.error('Error fetching contacts:', e.response?.status || e.message);
  }
}

debug();
