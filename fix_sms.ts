import * as fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf-8');

// For mobileMessage format
content = content.replace(
  /await addDoc\(collection\(db, 'messages'\), \{\s*from: 'system',\s*to: fmt, \/\/ Save the format that worked/g,
  "if (!custom_ref) {\n                    await addDoc(collection(db, 'messages'), {\n                    from: 'system',\n                    to: fmt, // Save the format that worked"
);

// For mobileMessage close block (the one before updateConversationMetadata)
content = content.replace(
  /uid: 'api-server'\s*\}\);\s*await updateConversationMetadata\(customerId, fmt/g,
  "uid: 'api-server'\n                  });\n                  }\n                  await updateConversationMetadata(customerId, fmt"
);

// For repairShopr format
content = content.replace(
  /await addDoc\(collection\(db, 'messages'\), \{\s*from: 'system',\s*to: normalizePhone\(to\),/g,
  "if (!custom_ref) {\n                    await addDoc(collection(db, 'messages'), {\n                    from: 'system',\n                    to: normalizePhone(to),"
);

content = content.replace(
  /uid: 'api-server'\s*\}\);\s*await updateConversationMetadata\(customerId, to/g,
  "uid: 'api-server'\n                  });\n                  }\n                  await updateConversationMetadata(customerId, to"
);


fs.writeFileSync('server.ts', content, 'utf-8');
console.log("Replaced successfully");
