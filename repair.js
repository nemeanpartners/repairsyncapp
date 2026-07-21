import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf-8');

// Find the target to replace:
// from `          {activeView === "settings" && (`
// at line 4768 down to `          {activeView === "user_profile" && (`

const startMarker = '          {activeView === "settings" && (\n            <SettingsView />\n          )}';
const endMarker = '          {activeView === "user_profile" && (';

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex !== -1 && endIndex !== -1) {
  const replacement = `          {activeView === "settings" && (
            <motion.div layoutId="mobileNavIndicator" className="absolute top-1 w-8 h-1 bg-primary rounded-full" />
          )}
          <Settings className="w-5 h-5 flex-shrink-0 mt-1" />
          <span className="text-[9px] font-bold hidden sm:block truncate w-full text-center">Settings</span>
        </Button>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 min-h-0 bg-white pb-20 md:pb-0 relative pt-14 md:pt-0">
        <React.Suspense fallback={<div className="flex-1 flex items-center justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-zinc-300" /></div>}>
          
          {activeView === "dashboard" && <UserDashboard onNavigate={handleNavigate} />}
          {activeView === "tasks" && <TasksView onNavigate={handleNavigate} />}
          {activeView === "crm_contacts" && <ContactsView onNavigate={handleNavigate} onSelectContact={(c) => { setSelectedCustomer(c); handleNavigate("customer_profile"); }} />}
          {activeView === "parts_orders" && <PartsOrdersView onNavigate={handleNavigate} />}
          {activeView === "invoices" && <InvoicesView onNavigate={handleNavigate} onOpenTicket={() => {}} />}
          {activeView === "roster" && <RosterSystem />}
          {activeView === "settings" && <SettingsView />}
          
          {activeView === "messages" && (
            <div className="flex-1 flex items-center justify-center p-8 bg-zinc-50">
              <div className="text-center">
                <MessageSquare className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-zinc-900">Messages</h3>
                <p className="text-sm text-zinc-500 max-w-sm mt-2">Messages UI is undergoing a refactor.</p>
              </div>
            </div>
          )}

          {activeView === "tickets" && (
             <div className="flex-1 flex items-center justify-center p-8 bg-zinc-50">
              <div className="text-center">
                <Wrench className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-zinc-900">Tickets</h3>
                <p className="text-sm text-zinc-500 max-w-sm mt-2">Tickets UI is undergoing a refactor.</p>
              </div>
            </div>
          )}

          {activeView === "customers" && (
             <div className="flex-1 flex items-center justify-center p-8 bg-zinc-50">
              <div className="text-center">
                <Users className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-zinc-900">Customers</h3>
                <p className="text-sm text-zinc-500 max-w-sm mt-2">Customers UI is undergoing a refactor.</p>
              </div>
            </div>
          )}

          {activeView === "customer_profile" && (
            <CustomerProfile 
               customer={selectedCustomer} 
               tickets={tickets.filter(t => t.customer_id === selectedCustomer?.id)} 
               onNavigate={handleNavigate} 
               onSelectTicket={setSelectedTicket} 
               onDraftMessage={setNewMessage} 
               onNewTicket={() => {}} 
               onLogCall={() => {}} 
               onUpdateCustomer={() => {}} 
            />
          )}

`;

  const newContent = content.substring(0, startIndex) + replacement + content.substring(endIndex);
  fs.writeFileSync('src/App.tsx', newContent);
  console.log("Syntax fixed!");
} else {
  console.log("Could not find markers correctly.");
}
