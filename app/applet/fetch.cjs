const fs = require('fs');
const https = require('https');

async function fetchCommit(commitHash) {
  const url = `https://github.com/repairsphonemedicau-stack/repairsync/commit/${commitHash}.patch`;
  console.log('Fetching', url);
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'node.js' } }, (res) => {
      let data = '';
      if (res.statusCode === 301 || res.statusCode === 302) {
        console.log('Redirecting to', res.headers.location);
        https.get(res.headers.location, { headers: { 'User-Agent': 'node.js' } }, (res2) => {
            let data2 = '';
            res2.on('data', chunk => data2 += chunk);
            res2.on('end', () => resolve(data2));
        }).on('error', reject);
        return;
      }
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve(data);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

async function main() {
  try {
    const patch1 = await fetchCommit('6380872');
    fs.writeFileSync('patch1.txt', patch1);
    const patch2 = await fetchCommit('c8c820f');
    fs.writeFileSync('patch2.txt', patch2);
    console.log('Success');
  } catch (e) {
    console.error(e);
  }
}

main();
