import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf-8');

// For replace 1: Desktop Inbox button
content = content.replace(
  `                  handleNavigate('messages');
                  setShowArchived(false);
                  setShowYourTurnOnly(false);
                  setShowNeedsReplyOnly(false);
                  setShowUrgentOnly(false);`,
  `                  handleNavigate('messages');
                  setShowArchived(false);
                  setShowYourTurnOnly(false);
                  setShowNeedsReplyOnly(false);
                  setShowUrgentOnly(false);
                  setSelectedCustomer(null);
                  setSelectedTicket(null);`
);

// For replace 2: Desktop Your Turn
content = content.replace(
  `                  handleNavigate('messages');
                  setShowArchived(false);
                  setShowYourTurnOnly(true);
                  setShowNeedsReplyOnly(false);
                  setShowUrgentOnly(false);`,
  `                  handleNavigate('messages');
                  setShowArchived(false);
                  setShowYourTurnOnly(true);
                  setShowNeedsReplyOnly(false);
                  setShowUrgentOnly(false);
                  setSelectedCustomer(null);
                  setSelectedTicket(null);`
);

// For replace 3: Desktop Urgent
content = content.replace(
  `                  handleNavigate('messages');
                  setShowArchived(false);
                  setShowYourTurnOnly(false);
                  setShowNeedsReplyOnly(false);
                  setShowUrgentOnly(true);`,
  `                  handleNavigate('messages');
                  setShowArchived(false);
                  setShowYourTurnOnly(false);
                  setShowNeedsReplyOnly(false);
                  setShowUrgentOnly(true);
                  setSelectedCustomer(null);
                  setSelectedTicket(null);`
);

// For replace 4: Desktop Archived
content = content.replace(
  `                handleNavigate('messages');
                setShowArchived(true);
                setShowYourTurnOnly(false);
                setShowNeedsReplyOnly(false);
                setShowUrgentOnly(false);`,
  `                handleNavigate('messages');
                setShowArchived(true);
                setShowYourTurnOnly(false);
                setShowNeedsReplyOnly(false);
                setShowUrgentOnly(false);
                setSelectedCustomer(null);
                setSelectedTicket(null);`
);


// For replace 5: Mobile Inbox
content = content.replace(
  `          handleNavigate('messages');
          setShowArchived(false);
          setShowYourTurnOnly(false);
          setShowNeedsReplyOnly(false);
          setShowUrgentOnly(false);`,
  `          handleNavigate('messages');
          setShowArchived(false);
          setShowYourTurnOnly(false);
          setShowNeedsReplyOnly(false);
          setShowUrgentOnly(false);
          setSelectedCustomer(null);
          setSelectedTicket(null);`
);

// For replace 6: Mobile Your Turn
content = content.replace(
  `          handleNavigate('messages');
          setShowArchived(false);
          setShowYourTurnOnly(true);
          setShowNeedsReplyOnly(false);
          setShowUrgentOnly(false);`,
  `          handleNavigate('messages');
          setShowArchived(false);
          setShowYourTurnOnly(true);
          setShowNeedsReplyOnly(false);
          setShowUrgentOnly(false);
          setSelectedCustomer(null);
          setSelectedTicket(null);`
);

// For replace 7: Mobile Archived
content = content.replace(
  `          handleNavigate('messages');
          setShowArchived(true);
          setShowYourTurnOnly(false);
          setShowNeedsReplyOnly(false);
          setShowUrgentOnly(false);`,
  `          handleNavigate('messages');
          setShowArchived(true);
          setShowYourTurnOnly(false);
          setShowNeedsReplyOnly(false);
          setShowUrgentOnly(false);
          setSelectedCustomer(null);
          setSelectedTicket(null);`
);

// For replace 8: CmdK
content = content.replaceAll(
  `onClick={() => { handleNavigate('messages'); setIsCmdKOpen(false); }}`,
  `onClick={() => { handleNavigate('messages'); setIsCmdKOpen(false); setSelectedCustomer(null); setSelectedTicket(null); }}`
);

fs.writeFileSync('src/App.tsx', content);
console.log('done');
