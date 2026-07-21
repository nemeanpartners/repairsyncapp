import axios from 'axios';

async function trigger() {
  try {
    const res = await axios.post('http://localhost:3000/api/repairshopr/migrate');
    console.log('Migration Triggered:', res.data);
  } catch (e) {
    console.error('Trigger Failed:', e.message);
  }
}

trigger();
