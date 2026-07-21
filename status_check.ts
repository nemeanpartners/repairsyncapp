
import axios from 'axios';

async function check() {
  try {
    const res = await axios.get('http://localhost:3000/api/repairshopr/migrate/status');
    console.log('Migration Status:', JSON.stringify(res.data, null, 2));
  } catch (e: any) {
    console.error('Status check failed:', e.message);
  }
}

check();
