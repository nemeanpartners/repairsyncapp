const http = require('http');
http.get('http://localhost:3000/api/crm/customers/search?q=123', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log(data));
});
