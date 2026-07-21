import axios from 'axios';

async function test() {
  try {
    const res = await axios.post('http://127.0.0.1:3000/api/webhooks/repairshopr/new-ticket', {
      ticket: {
        id: 123,
        number: "30723",
        customer: {
          firstname: "Joe",
          mobile: "0412345678"
        }
      }
    });
    console.log(res.status, res.data);
  } catch(e) {
    console.error(e);
  }
}
test();
