import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();

const checks = [
  {
    label: 'Android google-services.json',
    file: path.join(repoRoot, 'android', 'app', 'google-services.json'),
    hint:
      'Download from Firebase Console → Project settings → Your apps → Android (package: com.repairsync.sms).',
  },
  {
    label: 'iOS GoogleService-Info.plist',
    file: path.join(repoRoot, 'ios', 'App', 'App', 'GoogleService-Info.plist'),
    hint:
      'Download from Firebase Console → Project settings → Your apps → iOS (bundle id: com.repairsyncios.sms) and add it to the Xcode project.',
  },
];

let ok = true;
for (const c of checks) {
  const exists = fs.existsSync(c.file);
  if (exists) {
    // eslint-disable-next-line no-console
    console.log(`✅ ${c.label}: ${path.relative(repoRoot, c.file)}`);
  } else {
    ok = false;
    // eslint-disable-next-line no-console
    console.log(`❌ ${c.label}: missing (${path.relative(repoRoot, c.file)})`);
    // eslint-disable-next-line no-console
    console.log(`   ${c.hint}`);
  }
}

process.exit(ok ? 0 : 1);
