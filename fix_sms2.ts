import * as fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf-8');

content = content.replace(
  "if (!custom_ref) {\\n                    if (!custom_ref) {\\n                    await addDoc",
  "if (!custom_ref) {\\n                    await addDoc"
);

fs.writeFileSync('server.ts', content, 'utf-8');
console.log("Fixed successfully");
