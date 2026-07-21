import axios from 'axios';

async function ping() {
  try {
    const res = await axios.post('http://localhost:3000/api/webhooks/maxotel', {
      from: '0455420041',
      to: '0733681772',
      duration: '60',
      status: 'Completed'
    });
    console.log('Status:', res.status);
    console.log('Data:', res.data);
  } catch (e: any) {
    console.error('Error:', e.response?.data || e.message);
  }
}
ping();
