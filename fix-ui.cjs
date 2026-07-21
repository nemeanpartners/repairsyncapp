const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      const original = content;

      // Typography & Badges
      content = content.replace(/text-\[10px\]\s+font-black/g, 'text-xs font-semibold');
      content = content.replace(/text-\[10px\]\s+font-bold/g, 'text-xs font-medium');
      content = content.replace(/text-\[10px\]/g, 'text-xs');
      content = content.replace(/tracking-widest/g, 'tracking-wide');

      // Distracting Looping Animations
      content = content.replace(/animate-\[pulse_2s_ease-in-out_infinite\]/g, '');
      content = content.replace(/animate-\[pulse_3s_ease-in-out_infinite\]/g, '');

      // Harsh Error/Urgency States
      content = content.replace(/ring-2 ring-red-500 bg-red-50/g, 'border border-red-300 bg-red-50');
      content = content.replace(/bg-red-500 text-white/g, 'bg-red-50 text-red-600 border border-red-200');

      // Inconsistent Border Radii
      content = content.replace(/rounded-\[2\.5rem\]/g, 'rounded-2xl');
      content = content.replace(/rounded-3xl/g, 'rounded-2xl');

      // Custom Scrollbar Overrides
      content = content.replace(/\bcustom-scrollbar\b/g, '');
      content = content.replace(/\[&::-webkit-scrollbar[^\]]*\]:[^\s>"]+/g, '');
      content = content.replace(/\[scrollbar-width:none\]/g, '');
      content = content.replace(/\[-ms-overflow-style:none\]/g, '');
      content = content.replace(/\[scrollbar-width:thin\]/g, '');
      content = content.replace(/\[&::-webkit-scrollbar\]:hidden/g, '');

      // Focus Rings
      content = content.replace(/focus:ring-2 focus:ring-primary\/20/g, 'focus:ring-0 focus:border-zinc-300');
      content = content.replace(/focus:ring-2 focus:ring-emerald-500/g, 'focus:ring-0 focus:border-zinc-300');
      content = content.replace(/focus-visible:ring-primary\/20/g, 'focus-visible:ring-0 focus-visible:border-zinc-300');
      content = content.replace(/focus-visible:ring-2/g, '');

      // Custom Select Dropdowns (Inline SVG Hacks)
      content = content.replace(/\bappearance-none\b/g, '');
      content = content.replace(/style={{ backgroundImage:\s*'url\("data:image\/svg\+xml;[^}]*}}\s*/g, '');

      // Also clean up any empty style={{}} that might remain
      content = content.replace(/style={{\s*}}/g, '');

      if (content !== original) {
        fs.writeFileSync(fullPath, content);
        console.log(`Updated ${fullPath}`);
      }
    }
  }
}

processDir(path.join(__dirname, 'src'));
