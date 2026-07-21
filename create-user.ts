import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const auth = getAuth(app);
const db = getFirestore(app, config.firestoreDatabaseId);

async function create() {
  try {
    const user = await createUserWithEmailAndPassword(auth, 'server_admin@phonemedic.au', 'ServerSecure123!');
    console.log('Created user:', user.user.uid);
    await setDoc(doc(db, 'users', 'server_admin@phonemedic.au'), {
      role: 'admin',
      email: 'server_admin@phonemedic.au',
      displayName: 'Server Admin'
    });
    console.log('Admin role assigned');
    process.exit(0);
  } catch(e: any) {
    console.error(e.message);
    if(e.message.includes('email-already-in-use')) {
      await setDoc(doc(db, 'users', 'server_admin@phonemedic.au'), {
        role: 'admin',
        email: 'server_admin@phonemedic.au',
        displayName: 'Server Admin'
      });
      console.log('Admin role updated');
      process.exit(0);
    } else {
      process.exit(1);
    }
  }
}
create();
