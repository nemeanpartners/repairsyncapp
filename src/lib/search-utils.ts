
import { collection, getDocs, doc, writeBatch, Firestore } from 'firebase/firestore';

export function normalizeString(str: string): string {
  if (!str) return '';
  return str.toLowerCase().trim();
}

export function stripPhone(phone: string): string {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
}

export function getSearchTokens(data: any): string[] {
  const tokens = new Set<string>();
  
  const fields = [
    data.firstname,
    data.lastname,
    data.fullname,
    data.business_name,
    data.email,
    data.phone,
    data.mobile,
    data.device_serial,
    data.device_imei,
    data.number?.toString()
  ];

  fields.forEach(f => {
    if (f) {
      const val = normalizeString(String(f));
      // Split by spaces and punctuation
      val.split(/[\s\-_.\/@]+/).forEach(t => {
        if (t.length > 0) tokens.add(t);
      });
      // Add full string without spaces for phone/serial
      if (val.match(/\d/)) {
        tokens.add(val.replace(/\s+/g, ''));
      }
    }
  });

  return Array.from(tokens);
}

export function generateSearchableString(data: any): string {
  return getSearchTokens(data).join(' ');
}


export async function performIndexRebuild(
  db: Firestore, 
  onProgress: (progress: number) => void
): Promise<void> {
  const snap = await getDocs(collection(db, 'crm_customers'));
  const total = snap.docs.length;
  let count = 0;
  
  for (let i = 0; i < snap.docs.length; i += 100) {
    const batch = writeBatch(db);
    const chunk = snap.docs.slice(i, i + 100);
    
    chunk.forEach(d => {
      const data = d.data();
      batch.update(doc(db, 'crm_customers', d.id), {
        normalizedName: normalizeString(`${data.firstname || ''} ${data.lastname || ''}`),
        strippedPhone: stripPhone(data.mobile || data.phone || ''),
        searchContent: generateSearchableString(data),
        updated_at: data.updated_at || new Date().toISOString()
      });
    });
    
    await batch.commit();
    count += chunk.length;
    onProgress(Math.round((count / total) * 100));
  }
}
