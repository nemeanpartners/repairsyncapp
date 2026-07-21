const { execSync } = require('child_process');
try {
  execSync('git checkout -- src/components/TicketMasterModal.tsx', { stdio: 'inherit' });
  console.log('Restored');
} catch (e) {
  console.log('Failed:', e);
}
