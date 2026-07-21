const fs = require('fs');
let code = fs.readFileSync('src/components/TicketMasterModal.tsx', 'utf8');

code = code.replace(/<SelectContent>[\s\S]*?<\/SelectContent>\s*<\/Select>\s*<Button onClick=\{\(\) => \{\s*resetState\(\);/g, (match) => {
  return match.replace(/<Button onClick=\{\(\) => \{\s*resetState\(\);/, `{selectedTickets.length > 0 && (
                                 <Button onClick={handleBulkDeleteTickets} variant="destructive" className="h-10 px-4 font-bold shadow-md rounded-xl">
                                   <Trash2 className="w-4 h-4 mr-2" />
                                   Delete ({selectedTickets.length})
                                 </Button>
                               )}
                               <Button onClick={() => {\n                               resetState();`);
});

code = code.replace(/<div className="grid grid-cols-12 gap-4 px-6 py-3 bg-secondary\/30 border-b border-border\/30 text-\[0\.65rem\] font-bold text-muted-foreground uppercase tracking-widest">/g, 
  `<div className="grid grid-cols-12 gap-4 px-6 py-3 bg-secondary/30 border-b border-border/30 text-[0.65rem] font-bold text-muted-foreground uppercase tracking-widest items-center">
                               <div className="col-span-1 flex items-center pr-2">
                                  <Checkbox className="border-muted-foreground/50 data-[state=checked]:bg-primary data-[state=checked]:border-primary" checked={filteredTickets.length > 0 && selectedTickets.length === filteredTickets.length} onCheckedChange={(checked) => { if (checked) setSelectedTickets(filteredTickets.map(t => t.id)); else setSelectedTickets([]); }} />
                               </div>`
);
code = code.replace(/<div className="col-span-2">Job #<\/div>\s*<div className="col-span-4">Subject<\/div>\s*<div className="col-span-3">Customer<\/div>/g, 
  `<div className="col-span-2">Job #</div>
                               <div className="col-span-4">Subject</div>
                               <div className="col-span-2">Customer</div>`
);

code = code.replace(/<div className="divide-y divide-zinc-100">[\s\S]*?allTickets\.filter\([^)]*\)\.map\(t => \(/g, 
  `<div className="divide-y divide-zinc-100">
                               {filteredTickets.map(t => (`
);

code = code.replace(/className="grid grid-cols-12 gap-4 px-6 py-2\.5 items-center hover:bg-primary\/5 transition-colors cursor-pointer group"\s*>/g, 
  `className="grid grid-cols-12 gap-4 px-6 py-2.5 items-center hover:bg-primary/5 transition-colors cursor-pointer group"
                                 >
                                    <div className="col-span-1" onClick={(e) => e.stopPropagation()}>
                                       <Checkbox checked={selectedTickets.includes(t.id)} onCheckedChange={(checked) => { if (checked) setSelectedTickets(prev => [...prev, t.id]); else setSelectedTickets(prev => prev.filter(id => id !== t.id)); }} />
                                    </div>`
);

code = code.replace(/<div className="col-span-3 min-w-0">\s*<div className="flex items-center text-\[0\.75rem\] text-muted-foreground truncate">/g, 
  `<div className="col-span-2 min-w-0">
                                       <div className="flex items-center text-[0.75rem] text-muted-foreground truncate">`
);

fs.writeFileSync('src/components/TicketMasterModal.tsx', code);
console.log('Patched');
