const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
  });
}

walkDir('src', function(filePath) {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
    let content = fs.readFileSync(filePath, 'utf-8');
    if(content.includes('/v2')) {
      if(filePath.includes('SpellChecker')) return;
      let updated = content.replace(/'\/v2\//g, "'/")
                           .replace(/`\/v2\//g, "`/")
                           .replace(/'\/v2'/g, "'/'")
                           .replace(/"\/v2\//g, "\"/")
                           .replace(/"\/v2"/g, "\"/\"");
      fs.writeFileSync(filePath, updated);
      console.log('Updated', filePath);
    }
  }
});
