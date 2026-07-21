import fs from 'fs';

const files = [
  'server/routes/mobilemessage.ts',
  'server/services/messaging.ts',
  'server/services/repairshoprService.ts',
  'server.ts',
  'xeroSyncEngine.ts',
  'src/components/HireContractsView.tsx'
];

for (const file of files) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/, apiSecret: SERVER_SECRET/g, '');
    content = content.replace(/apiSecret: SERVER_SECRET,\s*/g, '');
    content = content.replace(/apiSecret: SERVER_SECRET\s*/g, '');
    
    // specifically for server.ts and xeroSyncEngine.ts and HireContractsView.tsx
    // to remove the wrapper functions entirely if they just do { ...data }
    // Actually let's just let it be `{ ...data }` for now, it's harmless.
    // Or let's replace the wrapper functions.
    content = content.replace(/const SERVER_SECRET = 'server_b9f8e7d6x5y4z3w2';/g, '');

    fs.writeFileSync(file, content);
  }
}
console.log('Done');
