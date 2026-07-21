
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

async function checkZoho() {
  const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (!fs.existsSync(firebaseConfigPath)) {
    console.log('Firebase config missing');
    return;
  }
  
  const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

  const snap = await getDoc(doc(db, 'crm_integrations', 'zoho'));
  if (snap.exists()) {
    console.log('Zoho integration found in database.');
    console.log('Data:', JSON.stringify(snap.data(), null, 2));
  } else {
    console.log('Zoho integration NOT found. You need to click "Connect Zoho" first.');
  }
  
  console.log('Environment constants:');
  console.log('ZOHO_CLIENT_ID:', process.env.ZOHO_CLIENT_ID ? 'SET' : 'MISSING');
  console.log('ZOHO_CLIENT_SECRET:', process.env.ZOHO_CLIENT_SECRET ? 'SET' : 'MISSING');
  console.log('ZOHO_REGION:', process.env.ZOHO_REGION);
  console.log('ZOHO_REDIRECT_URI:', process.env.ZOHO_REDIRECT_URI);
}

checkZoho();
