const fs = require('fs');
const path = require('path');
const collections = new Set();
function scan(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      scan(fullPath);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const matches = content.match(/collection\(\s*db\s*,\s*['"]([a-zA-Z0-9_]+)['"]\s*\)/g);
      if (matches) {
        matches.forEach(m => {
          const name = m.match(/['"]([a-zA-Z0-9_]+)['"]/)[1];
          collections.add(name);
        });
      }
    }
  }
}
scan('src');
console.log(Array.from(collections).sort().join('\n'));
