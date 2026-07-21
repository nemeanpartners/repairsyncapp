# RepairSync v2 Architecture Redesign plan

## Core Objectives
1. Migrate from a bloated Modal-based architecture to a Route-based layout
2. Implement modern split-panel UX for the ticket page
3. Reduce Firebase reads and heavy renders
4. Introduce a fast, Linear-esque Kanban board structure
5. Setup the foundation for AI integrations and Technician workflow modes

## Ticket Lifecycle Redesign
**Stages:**
- `new` (New Intake)
- `diagnosing` (Awaiting / Diagnosing)
- `quote_approval` (Awaiting Quote Approval)
- `parts_waiting` (Awaiting Parts)
- `repairing` (In Repair)
- `testing` (QC)
- `ready` (Ready for Pickup)
- `completed` (Completed)
- `warranty` (Warranty Return)
- `unrepairable` (Dead Device / BER)

## Component Hierarchy & Directory Roles
```
/src/pages/
   AppShell.tsx         // Contains left sidebar, global topbar, layout wrapper
   TicketQueue.tsx      // The Kanban board & list views
   TicketDetails.tsx    // The new split-screen ticket panel 
/src/components/
  /layout/
     Sidebar.tsx
     TopHeader.tsx
  /tickets/
     KanbanColumn.tsx
     TicketCard.tsx
     QuickActionsPopover.tsx
/src/hooks/
   useTickets.ts        // Extracted Firestore logic to enable memoized fetching and pagination
```

## State Management & Firestore Strategies
- Move large `useStates` from `App.tsx` down into specialized hooks (e.g. `useTicketData(ticketId)`).
- Implement infinite scrolling where lists are displayed instead of pulling all documents (`startAfter`, `limit`).
- Introduce localized context bounds (`TicketViewContext`) so updates to one ticket's "parts" don't re-render the whole pipeline.

## Implementation Steps
1. Create `ARCHITECTURE.md`. (Done)
2. Bootstrap the new `AppShell` routing context utilizing `react-router-dom` `<Routes> / <Route>`.
3. Create the `useTickets` hook.
4. Implement the Kanban board skeleton.
5. Create the Split-Panel `TicketDetails` layout component.
6. Swap the HashRouter in `main.tsx` to mount `AppV2` while providing fallback capabilities.
