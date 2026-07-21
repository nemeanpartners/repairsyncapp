// SLA Engine monitors wait times and SLA statuses

export interface SLAStatus {
  isBreached: boolean;
  timeRemaining?: number;
  breachedBy?: number;
  label: string;
  color: string;
}

export class TicketSLAEngine {
  static calculateSLA(ticket: any): SLAStatus {
    if (!ticket?.created_at) return { isBreached: false, label: 'Unknown', color: 'text-zinc-500' };

    // Placeholder logic for SLA checking
    // Typical repairing SLA might be 48 hours. Let's base it on priority or status.
    const createdDate = ticket.created_at?.toDate ? ticket.created_at.toDate() : new Date(ticket.created_at);
    const now = new Date();
    
    let targetHours = 48; // default 48h
    if (ticket.priority === 'Urgent') targetHours = 4;
    else if (ticket.priority === 'High') targetHours = 24;

    const targetDate = new Date(createdDate.getTime() + targetHours * 60 * 60 * 1000);
    const isBreached = now > targetDate;

    if (ticket.status === 'Resolved' || ticket.status === 'Completed' || ticket.status === 'Ready for Pickup') {
       return { isBreached: false, label: 'SLA Met', color: 'text-emerald-500' };
    }

    if (isBreached) {
       const msBreached = now.getTime() - targetDate.getTime();
       const hoursBreached = Math.floor(msBreached / (1000 * 60 * 60));
       return { 
         isBreached: true, 
         breachedBy: hoursBreached, 
         label: `Breached by ${hoursBreached}h`, 
         color: 'text-rose-500' 
       };
    } else {
       const msRemaining = targetDate.getTime() - now.getTime();
       const hoursRemaining = Math.floor(msRemaining / (1000 * 60 * 60));
       return { 
         isBreached: false, 
         timeRemaining: hoursRemaining, 
         label: `${hoursRemaining}h remaining`, 
         color: 'text-amber-500' 
       };
    }
  }
}
