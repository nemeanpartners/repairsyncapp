import http from 'http';
http.get('http://localhost:3000/src/main.tsx', (res) => {
  let data = '';
  res.on('data', c => data+=c);
  res.on('end', () => console.log("main.tsx:", data.substring(0, 300)));
});
