# RepairSync Enterprise System Document
## Revision 18: Full Architectural Audit, Decomposition Roadmap, and Hardening Blueprint

---

## 1. FULL ENTERPRISE ARCHITECTURE AUDIT

### Frontend Systems
*   **Component Sizings and Overhead**: React components in `/src/pages` (e.g., `TicketDetails.tsx`, `CustomerPortalView.tsx`) are loaded with multi-stage rendering logic, mixing chat timelines, status transitions, and attachments.
*   **Render Trees and Rerender Cycles**: Rerenders propagate down from raw parent listeners when collections change. Subscribing to full lists (e.g., `crm_tickets`) triggers costly UI redraws.
*   **Virtualization Gaps**: Key lists such as Messages, Ticket Activities, Customer Timelines, and Kanban Cards do not use rendering limits on large datasets, causing DOM nodes to grow linearly ($O(N)$) and choke mobile browsers.
*   **State Coordination**: High use of local state structures and missing memoization causes cascading repaints upon typing or action toggles.

### Backend Infrastructure
*   **Service Boundary Integrity**: The server currently routes requests through thin layers inside `server/routes`, but some integration endpoints still contain core transformation logic.
*   **Transport Multi-Plexing**: Messaging currently checks provider states directly. A unified, carrier-safe transport registry with standard delivery semantics is needed.
*   **Query and Listener Optimization**: Multiple parallel open-snapshot hooks are initialized by the client. On large customer bases, this creates redundant Firestore read transactions.

---

## 2. BACKEND DECOMPOSITION ROADMAP

```
[Incoming Payload] 
       │
       ▼
 [API Controllers] ──► [Queue & Scheduler Service] ──► [Priority Thread Workers]
       │
       ▼
[Unified Services] (Workflow, Messaging, SLA, Search, Presence)
       │
       ▼
[Transport Layers Match] (SMS, Email, RCS Provider, push, in-app)
```

To prevent route files in `/server/routes` from turning into business logic monoliths, this roadmap defines the separation into pristine Single Responsibility (SRP) units.

### Phase 2.1: Transition Router to Thin Controllers
*   **Validation**: Add Zod validation schemas directly at the Express middleware entry point (`server/middleware/validate.ts`).
*   **Routing**: Controllers in `/server/controllers` must only capture input parameters and return JSON payloads.
*   **Separation**: Strip database operations (`getDoc`, `addDoc`) out of routers and bundle them into isolated services.

### Phase 2.2: Establish Unified Service Repositories
*   **MessagingService**: Wraps SMS operations, template parsing, and carrier status updates.
*   **WorkflowService**: Maintains the state machine for repairs, category checklist processing, stages, and Xero sync signals.
*   **SlaService**: Assesses document tracking timestamps against predefined SLA targets in background jobs.

---

## 3. FRONTEND DECOMPOSITION ROADMAP

To reduce cognitive load and prevent bundle bloating, massive functional pages must be broken down into clean feature slices under `/src/features/`.

```
/src/features/
  ├── [featureName]/
  │     ├── components/    # Dumb UI representation, pure props
  │     ├── hooks/         # Feature state hooks, data subscription, pagination
  │     ├── services/      # Local transformations, analytical computations
  │     ├── store/         # Zustand sub-states, client actions
  │     ├── types/         # Domain-specific typescript interfaces
  │     └── validators/    # Frontend input validation rules (Zod)
```

### Deconstructed Targets
1.  **TicketDetails**: Split into `TicketChecklist`, `TicketDeviceStatus`, `TicketMessagingContainer`, and `TicketTimeline`.
2.  **CustomerProfile**: Deconstruct into `CustomerHeaderCard`, `CustomerTicketsList`, and `CustomerCommunicationHistory`.
3.  **RosterSystem**: Move scheduler charts, shift toggles, and technician assignments into `/src/features/roster`.

---

## 4. FIRESTORE SCALING REBUILD

```
         Traditional Subscription (UNBOUNDED)
         [Client Component] ──(Full List Subscription)──► [Firestore Collection] (O(N) Read Fees)

         Optimized Cursor Subscription (BOUNDED)
         [Client Component] ──(Query + limits + Cursor)──► [Firestore Index] (Fixed O(1) Cache Hits)
```

### Actionable Directives
1.  **Scoped Listeners**: Replace universal collection snapshot subscriptions with precise filters:
    ```typescript
    query(collection(db, "crm_tickets"), where("assigned_to", "==", currentUserId), limit(30))
    ```
2.  **State Revalidation**: Leverage temporary memory stores (Zustand) to reuse data across views.
3.  **Metadata Cache**: Rely on lightweight documents with minimal key footprints for real-time counters instead of fetching complete document trees.

---

## 5. REAL-TIME OPTIMIZATION STRATEGY

Firestore reads and client processing latency will be reduced through targeted caching and atomic batching.

```
Incoming Update ──► Caching Engine (Memory Cache Match) ──► Stale-While-Revalidate Trigger
                          │
                          └──► State Synchronizer (React Memo Comparison) ──► UI Repaint
```

*   **Deduplication**: Prevent redundant active subscriptions by maintaining an in-memory client-side listener registry.
*   **Offloading**: Move calculation heavy actions (e.g., date transformation, status aggregation) to background web workers or local memoization states using React `useMemo`.

---

## 6. ENTERPRISE SEARCH ENGINE REDESIGN

```
[Search Input] ──► Debounced Refinement Input
                        │
                        ├─► 1. Exact Match Scan (Normalized Indexes)
                        ├─► 2. Sharded Range Prefix Scan (Firestore \uf8ff)
                        └─► 3. Local Fuzzy Cache Filtering (Fuse.js)
```

### Key Optimizations
*   **Normalized Database Fields**: Ensure indexing pipelines create lowercase structures on write:
    *   `normalizedName` (lowercased combination of name and business name)
    *   `strippedPhone` (pure digit representation for accurate lookup match)
*   **Hybrid Search Execution**: Use high-speed exact matching via range prefix scans on Firestore first, with fuzzy fallback using a local search index on memory.

---

## 7. MOBILE TECHNICIANOS REDESIGN

```
┌─────────────────────────────────────────┐
│              TECHNICIAN OS              │
├─────────────────────────────────────────┤
│ [ Active Job ]   #1242  [ In Progress ] │
│ Priority: High        SLA: 4 Hours Left │
├─────────────────────────────────────────┤
│ Quick Action Hub:                       │
│ ┌──────────┐ ┌──────────┐ ┌───────────┐ │
│ │  Camera  │ │   SMS    │ │ Add Note  │ │
│ └──────────┘ └──────────┘ └───────────┘ │
└─────────────────────────────────────────┘
```

The TechnicianOS UI removes management features and presents an action-oriented workflow designed for single-handed use on mobile devices.

### UX Architecture Actions
*   **Fluid Transitions**: Integrate bottom navigation overlays and floating responsive control actions for quick actions.
*   **Sticky Hub**: Keep persistent actions (such as adding a repair update, capturing photos, changing status) floating at the bottom within thumb-reach.

---

## 8. WORKFLOW ENGINE ARCHITECTURE

```
[State Transition Triggered]
             │
             ▼
     [WorkflowEngine] ──► [SLA Status Validator] ──► [Escalation Dispatcher]
             │
             ▼
  [Database Synchronizer] ──► [Xero/Automation Webhook]
```

A centralized engine manages and validates all ticket transitions to ensure workflow consistency across pages.

*   **WorkflowEngine**: Handles complex stage progression rules with explicit validation.
*   **SlaEngine**: Continuously tracks time-in-stage metrics, flashing visual indicators on aging tickets.
*   **AssignmentEngine**: Auto-allocates open tickets to available technicians based on skills and relative caseload.

---

## 9. STATE MANAGEMENT REDESIGN

```
                      [Zustand Central Store]
                      /          │          \
                     /           │           \
[Tickets Sub-Slice]      [Messaging Sub-Slice]   [UI Interaction State]
```

### Store Consolidation
*   Introduce high-performance slices in Zustand to isolate state mutations.
*   Remove local component storage drilling, and wrap subscriptions directly in stable selectors:
    ```typescript
    const tickets = useTicketStore(state => state.activeTickets);
    ```

---

## 10. MESSAGING ARCHITECTURE REDESIGN

```
                    [Unified Messaging Gateway]
                    /            │            \
      [RCS Channel]         [SMS Channel]        [In-App Team Chat]
```

The system manages unified messaging through a central adapter layer rather than custom route targets.

### Gateway Services
*   **Carrier Capability Resolver**: Automatically selects the best route (RCS vs SMS) based on delivery profiles.
*   **Dynamic Read Indicators**: Evaluates timestamp flags to dispatch accurate read and typing statuses.

---

## 11. TIMELINE VIRTUALIZATION STRATEGY

```
                Viewport Virtual Window Frame (Fixed Size)
┌───────────────────────────────────────────────────────────────┐
│ [Rendered Message Doc 41] (Visible in viewport)               │
│ [Rendered Message Doc 42] (Visible in viewport)               │
│ [Rendered Message Doc 43] (Visible in viewport)               │
└───────────────────────────────────────────────────────────────┘
      Virtualized Offset buffers (Non-rendered memory lists)
```

By virtualizing timelines, the system maintains a responsive interface even with thousands of entries.

*   **react-window Implementation**: Mounts and updates only visible messages, keeping the active DOM footprint lightweight.
*   **Staggered Layouts**: Groups activities, chat threads, and updates dynamically.

---

## 12. BACKEND SERVICE ARCHITECTURE

To optimize system resources, backend routes operate purely as thin routers that delegate heavy processing to services.

```
/server/services/
  │
  ├── MessagingService.ts    # Delivery, templating, and provider failover
  ├── WorkflowService.ts     # Repairs, steps, status transitions
  ├── SearchService.ts       # Query tokens, prefix matches
  └── QueueService.ts        # SMS queuing, webhook retries, task scheduling
```

---

## 13. QUERY OPTIMIZATION RECOMMENDATIONS

Ensure Firestore operates with optimal indexes to prevent latency on large datasets.

### Required Database Composite Indexes
1.  **Collection**: `crm_tickets`
    *   `assignedTo` (Ascending) | `status` (Ascending) | `updated_at` (Descending)
2.  **Collection**: `crm_tickets`
    *   `customer_id` (Ascending) | `created_at` (Descending)
3.  **Collection**: `messages`
    *   `customerId` (Ascending) | `timestamp` (Descending)

---

## 14. VIRTUALIZATION IMPLEMENTATION PLAN

*   **Target Sites**: Messages panel, Ticket lists, Contacts grid.
*   **Implementation**: Integrate `react-window` and `react-virtualized-auto-sizer` for responsive, performant scroll containers.

---

## 15. ENTERPRISE SETTINGS HARDENING

*   *Validation*: Secure settings modifications using Firestore rule-based guards.
*   *Auditing*: Log changes with a structure detailing the user ID, timestamp, variable changed, and values.

---

## 16. RCS TRANSPORT ARCHITECTURE REDESIGN

*   Enforce a reliable transport structure using structured delivery reports.
*   Allow rich metadata updates for attachments, verified brand chips, and quick-reply action blocks.

---

## 17. PERFORMANCE ENGINEERING ROADMAP

```
[Optimization Checklist]
  ├─► React.memo on high-update nodes (Message bubble, user status)
  ├─► Lazy loading on modals and auxiliary settings pages
  ├─► useMemo on list filters and Fuse instances
  └─► Skeleton placeholders to prevent visual layout shifts
```

---

## 18. OFFLINE-FIRST STRATEGY

*   Enable Firestore offline persistence.
*   Process UI writes instantly via optimistic updates, syncing automatically when connectivity is restored.

---

## 19. OBSERVABILITY STRATEGY

*   Structured Server Logging: Output structured JSON logs with diagnostic fields (`requestId`, `executionTime`, `severity`).
*   Client Telemetry: Surface explicit error payloads for Firestore permission issues.

---

## 20. SCALABILITY STRATEGY

*   Handle high database loads through cursor pagination.
*   Enforce structural size limits on arrays to stay within document storage constraints.

---

## 21. FULL STAGED ENTERPRISE STABILIZATION ROADMAP

```
┌──────────────────────────┐    ┌──────────────────────────┐    ┌──────────────────────────┐
│ STAGE 1: CORE STABILITY  │ ──►│ STAGE 2: WORKFLOW & UX   │ ──►│ STAGE 3: SCALE HARDENING │
└──────────────────────────┘    └──────────────────────────┘    └──────────────────────────┘
 * Apply virtualized lists       * Deploy robust search          * Hardened security profiles
 * Optimize queries & models     * Optimize mobile OS mode       * Observability metrics
```

---

## System Hardening Audit Verification

We evaluate each system collection against key attack vectors to protect the database against unauthorized access.

| Collection Path | Identity Spoofing | State Shortcutting | Resource Poisoning |
| :--- | :--- | :--- | :--- |
| `/crm_tickets` | Protected by owner id binding | Checked by state engine validation | Restricted via type size constraints |
| `/crm_customers` | Locked to authenticated user | N/A | Validated against structured keys |
| `/messages` | Sender ID bound to system lookup | N/A | Enforced field length limits |
