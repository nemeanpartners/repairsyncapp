import { execSync } from 'child_process';
try {
  execSync('git -c safe.directory=/app/applet checkout -- src/components/TicketMasterModal.tsx', { stdio: 'inherit' });
  console.log('Restored');
} catch (e) {
  console.log('Failed:', e.message);
}
