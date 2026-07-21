import admin from 'firebase-admin';

try {
  admin.initializeApp({
    projectId: 'gen-lang-client-0477801246'
  });
  console.log("App initialized.");
  const db = admin.firestore();
  db.collection('crm_customers').limit(1).get().then(snap => {
    console.log("Admin OK! Docs:", snap.size);
    process.exit(0);
  }).catch(e => {
    console.error("Admin error:", e.message);
    process.exit(1);
  });
} catch(e) {
  console.error("Init Error:", e);
  process.exit(1);
}
