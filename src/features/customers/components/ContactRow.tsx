import React from 'react';
import { Phone, Mail, ChevronRight, MessageSquare, Loader2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

interface ContactRowProps {
  index: number;
  style: React.CSSProperties;
  contact: any;
  isSelected: boolean;
  onToggleSelect: (id: string, checked: boolean) => void;
  onSelectContact?: (contact: any) => void;
  onNavigate: (view: string, id?: string) => void;
}

export const ContactRow = React.memo(({ index, style, contact: c, isSelected, onToggleSelect, onSelectContact, onNavigate }: ContactRowProps) => {
  if (!c) return <div style={style} className="flex items-center justify-center border-b border-zinc-100"><Loader2 className="w-4 h-4 animate-spin text-zinc-300" /></div>;

  return (
    <div 
      style={style} 
      onClick={() => onSelectContact && onSelectContact(c)}
      className="flex items-center px-3 border-b border-zinc-100 hover:bg-zinc-50 transition-colors group cursor-pointer"
    >
      <div className="w-[48px] shrink-0" onClick={e => e.stopPropagation()}>
         <Checkbox
          checked={isSelected}
          onCheckedChange={(checked) => onToggleSelect(c.id || c.customerId, !!checked)}
          className="w-4 h-4"
        />
      </div>
      
      <div className="flex-1 min-w-0 pr-4">
         <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500 font-bold text-xs border border-zinc-200 uppercase">
              {(c.firstName || c.firstname || c.first_name)?.[0] || ''}{(c.lastName || c.lastname || c.last_name)?.[0] || ''}
            </div>
            <div className="min-w-0 flex flex-col">
               <span className="text-sm font-bold text-zinc-900 truncate uppercase">
                 {c.firstName || c.firstname || c.first_name} {c.lastName || c.lastname || c.last_name} {(c.businessName || c.business_name || c.business_then_name) && <span className="text-xs text-zinc-400 font-normal ml-1">({c.businessName || c.business_name || c.business_then_name})</span>}
               </span>
               <span className="text-xs text-zinc-500 truncate lg:hidden">{c.phone || c.mobile || 'No Phone'}</span>
            </div>
         </div>
      </div>

      <div className="hidden lg:flex flex-1 min-w-0 pr-4">
         <div className="flex flex-col">
            <span className="text-[11px] font-mono text-zinc-600 flex items-center gap-1">
               <Phone className="w-3 h-3 text-zinc-300" />
               {c.phone || c.mobile || '--'}
            </span>
            <span className="text-xs text-zinc-400 flex items-center gap-1">
               <Mail className="w-3 h-3 text-zinc-300" />
               {c.email || '--'}
            </span>
         </div>
      </div>

      <div className="w-[100px] md:w-[150px] shrink-0 flex items-center gap-2 justify-end">
         <div className="flex items-center gap-1">
            <div 
              role="button"
              onClick={(e) => {
                e.stopPropagation();
                window.location.href = `tel:${c.phone || c.mobile}`;
              }}
              className="p-2 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all cursor-pointer"
              title="Call"
            >
              <Phone className="w-4 h-4" />
            </div>
            <div 
              role="button"
              onClick={(e) => {
                e.stopPropagation();
                onNavigate('messages', c.id || c.customerId);
              }}
              className="p-2 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all cursor-pointer"
              title="Message"
            >
              <MessageSquare className="w-4 h-4" />
            </div>
            <div 
              role="button"
              onClick={(e) => {
                 e.stopPropagation();
                 onNavigate('orders', c.id || c.customerId);
              }}
              className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-all cursor-pointer"
              title="View Jobs"
            >
              <ChevronRight className="w-4 h-4" />
            </div>
         </div>
      </div>
    </div>
  );
});
