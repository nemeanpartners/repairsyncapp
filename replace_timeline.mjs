import fs from 'fs';

let content = fs.readFileSync('src/components/TicketMasterModal.tsx', 'utf-8');

const replacement1 = `                             {/* Combined Timeline */}
                             {[
                                ...notes.map(n => ({ ...n, timelineType: 'note' })),
                                ...messages.map(m => ({ ...m, timelineType: 'sms' })),
                                ...callLogs.map(c => ({ ...c, timelineType: 'call' }))
                             ]
                             .sort((a, b) => {
                                const aTime = a.created_at?.toDate ? a.created_at.toDate().getTime() : (a.timestamp?.toDate ? a.timestamp.toDate().getTime() : (a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0));
                                const bTime = b.created_at?.toDate ? b.created_at.toDate().getTime() : (b.timestamp?.toDate ? b.timestamp.toDate().getTime() : (b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0));
                                return bTime - aTime;
                             })
                             .map((item, idx) => (`;

content = content.replace(/\{\/\* Combined Timeline \*\/\}[\s\S]*?\.map\(\(item, idx\) => \(/, replacement1);

const replacement2 = `{item.timelineType === 'note' ? (
                                         <div className={\`w-1.5 h-1.5 rounded-full \${item.hidden ? 'bg-amber-400' : 'bg-blue-400'}\`} />
                                      ) : item.timelineType === 'call' ? (
                                         <div className={\`w-1.5 h-1.5 rounded-full \${item.status === 'Missed' ? 'bg-red-400' : 'bg-purple-500'}\`} />
                                      ) : (
                                         <div className={\`w-1.5 h-1.5 rounded-full \${item.type === 'inbound' ? 'bg-green-400' : 'bg-emerald-600'}\`} />
                                      )}`;

content = content.replace(/\{item\.timelineType === 'note' \? \([\s\S]*?bg-emerald-600'\}\`} \/>\s*\)\s*\)\}/, replacement2);

const replacement3 = `<span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                                            {item.timelineType === 'note' ? (item.hidden ? 'Internal Note' : 'Public Note') : item.timelineType === 'call' ? \`Call (\${item.direction})\` : \`SMS (\${item.type})\`}
                                            {' • '}
                                            {item.created_at?.toDate ? format(item.created_at.toDate(), 'MMM d, h:mm a') : (item.timestamp?.toDate ? format(item.timestamp.toDate(), 'MMM d, h:mm a') : (item.createdAt?.toDate ? format(item.createdAt.toDate(), 'MMM d, h:mm a') : 'Recently'))}
                                         </span>`;

content = content.replace(/<span className="text-\[10px\] font-black uppercase tracking-widest text-zinc-400">[\s\S]*?<\/span>/, replacement3);

const replacement4 = `<div className={\`p-3 rounded-2xl text-sm border shadow-sm \${
                                         item.timelineType === 'note' 
                                            ? (item.hidden ? 'bg-amber-50/50 border-amber-100' : 'bg-blue-50/50 border-blue-100')
                                            : item.timelineType === 'call'
                                            ? (item.status === 'Missed' ? 'bg-red-50/50 border-red-100' : 'bg-purple-50/50 border-purple-100')
                                            : (item.type === 'inbound' ? 'bg-white border-zinc-200 shadow-none' : 'bg-zinc-100 border-zinc-200')
                                      }\`}>
                                         {item.timelineType === 'call' ? (
                                            <div>
                                               <p className="font-medium text-xs text-zinc-800">{item.status === 'Missed' ? 'Missed Call' : \`\${item.direction} voice call\`}</p>
                                               {item.notes && <p className="mt-1 text-zinc-600 bg-white/50 p-2 rounded-lg text-xs leading-relaxed">{item.notes}</p>}
                                            </div>
                                         ) : (
                                            item.body || item.text
                                         )}
                                         {item.attachmentUrl && (`

content = content.replace(/<div className=\{\`p-3 rounded-2xl text-sm border shadow-sm \$\{[\s\S]*?\{item\.body \|\| item\.text\}[\s\S]*?\{item\.attachmentUrl && \(/, replacement4);

fs.writeFileSync('src/components/TicketMasterModal.tsx', content);
console.log('done');
