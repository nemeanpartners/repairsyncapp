import Fuse from "fuse.js";

let fuseContacts: Fuse<any> | null = null;
let fuseTickets: Fuse<any> | null = null;
let rawContacts: any[] = [];
let rawTickets: any[] = [];

function rebuildIndexes() {
  try {
    fuseContacts = new Fuse(rawContacts, {
      keys: [
        { name: "firstName", weight: 0.3 },
        { name: "lastName", weight: 0.3 },
        { name: "businessName", weight: 0.2 },
        { name: "email", weight: 0.2 },
        { name: "phone", weight: 0.2 },
        { name: "mobile", weight: 0.2 },
        { name: "strippedPhone", weight: 0.2 },
        { name: "searchTermsArray", weight: 0.1 },
      ],
      threshold: 0.4,
    });

    fuseTickets = new Fuse(rawTickets, {
      keys: [
        { name: "number", weight: 0.4 },
        { name: "id", weight: 0.3 },
        { name: "subject", weight: 0.2 },
        { name: "device_imei", weight: 0.1 },
        { name: "device_serial", weight: 0.1 },
        { name: "issueDescription", weight: 0.1 },
        { name: "customer_name", weight: 0.1 },
      ],
      threshold: 0.4,
    });
  } catch (e) {
    console.error("[search.worker] Failed to index:", e);
  }
}

self.onmessage = (event) => {
  const { type, payload } = event.data;

  if (type === "INIT") {
    const { contacts, tickets } = payload;
    rawContacts = contacts || [];
    rawTickets = tickets || [];
    rebuildIndexes();
  } 
  
  else if (type === "UPDATE_ITEMS") {
    const { items, itemType } = payload;
    const targetArray = itemType === "contacts" ? rawContacts : rawTickets;

    items.forEach((newItem: any) => {
      const index = targetArray.findIndex((x: any) => x.id === newItem.id);
      if (index > -1) {
        targetArray[index] = { ...targetArray[index], ...newItem };
      } else {
        targetArray.push(newItem);
      }
    });

    rebuildIndexes();
  } 
  
  else if (type === "DELETE_ITEM") {
    const { id, itemType } = payload;
    const targetArray = itemType === "contacts" ? rawContacts : rawTickets;
    const index = targetArray.findIndex((x: any) => x.id === id);
    if (index > -1) {
      targetArray.splice(index, 1);
      rebuildIndexes();
    }
  } 
  
  else if (type === "SEARCH") {
    const { query, searchId, limitThreshold = 50 } = payload;
    
    let contactMatches: any[] = [];
    let ticketMatches: any[] = [];

    console.log(`[search.worker] Incoming search query: "${query}"`);
    const queryTrimmed = String(query).trim();
    const isNumericOrID = /^\d+$/.test(queryTrimmed) || queryTrimmed.startsWith('#');

    try {
      contactMatches = fuseContacts ? fuseContacts.search(query).map(r => r.item) : [];
      ticketMatches = fuseTickets ? fuseTickets.search(query).map(r => r.item) : [];
    } catch (e) {
      console.error("[search.worker] Fuse match exception:", e);
    }

    // Fallback search logic for phone numbers and ticket IDs
    if (isNumericOrID && queryTrimmed.length > 0) {
      const cleanQuery = queryTrimmed.replace(/\D/g, ''); // Extract numeric part
      const isJustNumber = /^\d+$/.test(cleanQuery) && cleanQuery.length > 0;
      
      const manualTickMatches = rawTickets.filter(t => {
        // Match ticket number or ID string exactly/partially depending on length
        const tNum = String(t.number || '');
        const tId = String(t.id || '');
        return tNum === cleanQuery || tId === cleanQuery || (isJustNumber && tNum.includes(cleanQuery)) || (isJustNumber && tId.includes(cleanQuery));
      });
      
      const manualContactMatches = rawContacts.filter(c => {
        const cp = String(c.phone || '').replace(/\D/g, '');
        const cm = String(c.mobile || '').replace(/\D/g, '');
        const sp = String(c.strippedPhone || '');
        return isJustNumber && ((cp && cp.includes(cleanQuery)) || (cm && cm.includes(cleanQuery)) || (sp && sp.includes(cleanQuery)));
      });
      
      // Unshift to put exact matches at the top, without duplication
      const tSet = new Set(ticketMatches.map(t => t.id));
      manualTickMatches.forEach(t => {
        if (!tSet.has(t.id)) {
          ticketMatches.unshift(t);
          tSet.add(t.id);
        }
      });
      
      const cSet = new Set(contactMatches.map(c => c.id));
      manualContactMatches.forEach(c => {
        if (!cSet.has(c.id)) {
          contactMatches.unshift(c);
          cSet.add(c.id);
        }
      });
    }

    console.log(`[search.worker] Filtered results for "${query}": ${contactMatches.length} contacts, ${ticketMatches.length} tickets`);

    self.postMessage({
      type: "SEARCH_RESULTS",
      searchId,
      results: {
        contactMatches: contactMatches.slice(0, limitThreshold),
        ticketMatches: ticketMatches.slice(0, limitThreshold)
      }
    });
  }
};
