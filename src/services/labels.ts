export interface LabelState {
  label: string;
  source: "system" | "manual" | "hybrid";
  dismissed: boolean;
  dismissedAt?: string | null;
  dismissedBy?: string | null;
  snoozeUntil?: string | null;
  reapplyAfterEventId?: string | null;
}

export class LabelEngine {
  /**
   * Dismiss/manual-remove a label. Sets dismissed flag and metadata.
   */
  static dismissLabel(labels: LabelState[], labelName: string, userId: string = "operator", snoozeUntil?: string, reapplyAfterEventId?: string): LabelState[] {
    const list = labels || [];
    const exists = list.some(l => l.label === labelName);
    if (!exists) {
      // Add as dismissed so that subsequent automated actions know it has been dismissed
      return [
        ...list,
        {
          label: labelName,
          source: "system",
          dismissed: true,
          dismissedAt: new Date().toISOString(),
          dismissedBy: userId,
          snoozeUntil: snoozeUntil || null,
          reapplyAfterEventId: reapplyAfterEventId || null
        }
      ];
    }
    return list.map(l => {
      if (l.label === labelName) {
        return {
          ...l,
          dismissed: true,
          dismissedAt: new Date().toISOString(),
          dismissedBy: userId,
          snoozeUntil: snoozeUntil || null,
          reapplyAfterEventId: reapplyAfterEventId || null
        };
      }
      return l;
    });
  }

  /**
   * Applies a label, respecting manual dismissals and snoozing.
   */
  static applyLabel(labels: LabelState[], labelName: string, source: "system" | "manual" | "hybrid" = "system", eventId?: string): LabelState[] {
    const list = labels || [];
    const existing = list.find(l => l.label === labelName);
    if (existing) {
      if (existing.dismissed) {
        if (source === "manual") {
          // Manual always overrides
          return list.map(l => {
            if (l.label === labelName) {
              return {
                ...l,
                dismissed: false,
                dismissedAt: null,
                dismissedBy: null,
                snoozeUntil: null,
                reapplyAfterEventId: null,
                source: "manual"
              };
            }
            return l;
          });
        }
        
        // System or hybrid application: check if we should reapply
        let shouldReapply = false;
        
        if (existing.snoozeUntil) {
          if (new Date() >= new Date(existing.snoozeUntil)) {
            shouldReapply = true;
          }
        }
        
        if (existing.reapplyAfterEventId && eventId && existing.reapplyAfterEventId !== eventId) {
          shouldReapply = true;
        }

        if (shouldReapply) {
           return list.map(l => {
             if (l.label === labelName) {
               return {
                 ...l,
                 dismissed: false,
                 dismissedAt: null,
                 dismissedBy: null,
                 snoozeUntil: null,
                 reapplyAfterEventId: null,
                 source
               };
             }
             return l;
           });
        }

        return list; // Do not overwrite user dismissal!
      }
      return list;
    }

    return [
      ...list,
      {
        label: labelName,
        source,
        dismissed: false,
        dismissedAt: null,
        dismissedBy: null,
        snoozeUntil: null,
        reapplyAfterEventId: null
      }
    ];
  }

  /**
   * Forcefully applies/re-triggers a label (even if dismissed), e.g., on manual action or new customer inbound message.
   */
  static forceReapplyLabel(labels: LabelState[], labelName: string, source: "system" | "manual" | "hybrid" = "system"): LabelState[] {
    const list = labels || [];
    return [
      ...list.filter(l => l.label !== labelName),
      {
        label: labelName,
        source,
        dismissed: false,
        dismissedAt: null,
        dismissedBy: null
      }
    ];
  }

  /**
   * Hard-removes a label from the array.
   */
  static removeLabel(labels: LabelState[], labelName: string): LabelState[] {
    const list = labels || [];
    return list.filter(l => l.label !== labelName);
  }

  /**
   * Helper to check if a specific label is active (i.e. present and NOT dismissed)
   */
  static isLabelActive(labels: LabelState[], labelName: string): boolean {
    const list = labels || [];
    const item = list.find(l => l.label === labelName);
    return !!item && !item.dismissed;
  }
}
