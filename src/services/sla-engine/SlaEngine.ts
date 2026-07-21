export interface EscalationResult {
  ticketId: string;
  ticketNumber: string;
  severity: "low" | "medium" | "high" | "critical";
  escalationTrigger: "stalled_repair" | "sla_breach" | "customer_update_delay" | "parts_bottleneck";
  description: string;
  recommendedAction: string;
  actionExecuted: boolean;
}

export class SlaEngine {
  /**
   * Evaluates a single ticket snapshot for SLA escalation risks
   */
  static evaluateEscalationRisk(ticket: any, lastActivityDate: Date): EscalationResult | null {
    if (!ticket) return null;

    const now = new Date();
    const lastActivityTime = lastActivityDate ? lastActivityDate.getTime() : now.getTime();
    const hourDiff = Math.abs(now.getTime() - lastActivityTime) / (1000 * 60 * 60);

    const ticketStatus = String(ticket.status || "").toLowerCase();
    
    // Ignore completed statuses
    if (["completed", "resolved", "ready for pickup", "picked up"].includes(ticketStatus)) {
      return null;
    }

    // 1. Critical SLA Breach Check
    let targetHours = 48;
    if (ticket.priority === "Urgent") targetHours = 4;
    else if (ticket.priority === "High") targetHours = 24;

    const createdTime = ticket.created_at?.toDate ? ticket.created_at.toDate().getTime() : new Date(ticket.created_at || now).getTime();
    const hoursSinceCreation = (now.getTime() - createdTime) / (1000 * 60 * 60);

    if (hoursSinceCreation > targetHours) {
      return {
        ticketId: ticket.id || "",
        ticketNumber: ticket.number || "Unknown",
        severity: "critical",
        escalationTrigger: "sla_breach",
        description: `Passed the standard SLA resolution window of ${targetHours} hours by ${Math.round(hoursSinceCreation - targetHours)}h.`,
        recommendedAction: "Reprioritize automatically to URGENT, notify floor manager, and ping lead technician.",
        actionExecuted: true
      };
    }

    // 2. Stalled Repair (In Progress but no updates in 18 hours)
    if (ticketStatus === "in progress" && hourDiff > 18) {
      return {
        ticketId: ticket.id || "",
        ticketNumber: ticket.number || "Unknown",
        severity: "high",
        escalationTrigger: "stalled_repair",
        description: `Repair marked 'In Progress' is currently idle with zero logged timeline updates for over ${Math.round(hourDiff)}h.`,
        recommendedAction: "Dispatch automated warning note to the bench. Re-balance workload queue.",
        actionExecuted: false
      };
    }

    // 3. Customer Update Delay (No notifications sent in 24 hours of workflow change)
    if (hourDiff > 24) {
      return {
        ticketId: ticket.id || "",
        ticketNumber: ticket.number || "Unknown",
        severity: "medium",
        escalationTrigger: "customer_update_delay",
        description: `Zero active customer message touches or pipeline updates in the last 24h.`,
        recommendedAction: "Proactively draft a predictive SMS updating the status to avoid customer inbound calls.",
        actionExecuted: false
      };
    }

    return null;
  }
}
