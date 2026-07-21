import { db } from './src/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

async function main() {
    // some tickets might have number as string, some as number
    const q1 = query(collection(db, 'crm_tickets'), where('number', '==', 31116));
    const snap1 = await getDocs(q1);
    
    const q2 = query(collection(db, 'crm_tickets'), where('number', '==', '31116'));
    const snap2 = await getDocs(q2);

    [...snap1.docs, ...snap2.docs].forEach(d => console.log(JSON.stringify({ id: d.id, ...d.data() }, null, 2)));
    process.exit(0);
}
main().catch(console.error);
