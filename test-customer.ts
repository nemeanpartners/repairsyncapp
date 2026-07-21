import { db } from './src/firebase';
import { doc, getDoc } from 'firebase/firestore';

async function main() {
    const cRef1 = doc(db, 'crm_customers', '35913343');
    const cSnap1 = await getDoc(cRef1);
    console.log("Customer string id exists:", cSnap1.exists(), cSnap1.data());

    const cRef2 = doc(db, 'crm_customers', '35913343');
    const cSnap2 = await getDoc(cRef2);
    console.log("Customer num id exists:", cSnap2.exists(), cSnap2.data());

    process.exit(0);
}
main().catch(console.error);
