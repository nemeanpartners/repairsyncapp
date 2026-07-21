import admin from 'firebase-admin';

admin.initializeApp({ projectId: 'gen-lang-client-0477801246' });
const auth = admin.auth();
const db = admin.firestore();

async function setup() {
  try {
    const email = 'server_admin@phonemedic.au';
    const password = 'ServerSecure123!';
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(email);
      console.log('User already exists:', userRecord.uid);
    } catch (e) {
      userRecord = await auth.createUser({
        email,
        password,
        displayName: 'Server Admin',
        emailVerified: true
      });
      console.log('Created user:', userRecord.uid);
    }
    
    await db.collection('users').doc(email).set({
      role: 'admin',
      email: email,
      displayName: 'Server Admin'
    });
    console.log('Assigned admin role.');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
setup();
