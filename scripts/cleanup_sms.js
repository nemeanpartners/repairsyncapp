/**
 * FIRESTORE SMS DUPLICATION CLEANUP SCRIPT
 * Run this snippet in your Node environment or Google Cloud Function
 * to batch-delete specifically targeted duplicate threads.
 */
const admin = require('firebase-admin');

// Ensure firebase-admin is initialized before calling this script
// admin.initializeApp();
const db = admin.firestore();

async function removeDuplicates(customerId) {
  const snapshot = await db.collection("messages")
    .where("customerId", "==", customerId)
    .orderBy("timestamp", "asc")
    .get();

  let lastMsg = null;
  const batch = db.batch();
  let deleteCount = 0;

  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    if (!data.timestamp) return;

    if (lastMsg &&
        lastMsg.text === data.text && 
        lastMsg.to === data.to &&
        Math.abs(data.timestamp.toMillis() - lastMsg.timestamp.toMillis()) < 5000) {
       // Duplicate detected (within 5 seconds, same text, same number)
       batch.delete(doc.ref);
       deleteCount++;
    } else {
       lastMsg = data;
    }
  });

  if (deleteCount > 0) {
    await batch.commit();
    console.log(`Successfully removed ${deleteCount} duplicate messages for customer ${customerId}`);
  } else {
    console.log('No duplicates found.');
  }
}

// Example usage:
// removeDuplicates('YOUR_CUSTOMER_ID_HERE');
