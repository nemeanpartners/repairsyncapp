const http = require('http');
http.get('http://localhost:3000/api/debug/crm-customers?id=33736327', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log(JSON.parse(data)[0].tickets));
});
