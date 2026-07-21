# RepairSync Enterprise Architecture Audit & Roadmap
This document outlines the architecture analysis, optimization, and enterprise-grade roadmap designed to scale RepairSync to support hundreds of concurrent technicians and millions of real-time messages and state actions with ultra-low latency, minimized Firestore costs, and superb reliability.

---

## 1. Full Enterprise Architecture Audit
### Current State Assessment
- **Frontend Layer:** Built on React 19 + Tailwind CSS + Lucide Icons. Features exist in `/src/features` and components in `/src/components`. State management is split between `useState` props, custom providers, and a basic `ticketStore` / `workflowStore`.
- **Backend Layer:** Node.js Express server running with `tsx` / `esbuild`. Heavy routing files in `/server/routes` (e.g., `mobilemessage.ts` and `repairshopr.ts`) still contain extensive inline database business logic, formatting, external sync orchestration, and routing structures side-by-side.
- **Data Persistence:** Cloud Firestore. Real-time active synchronizations via `onSnapshot` are prone to hydration spikes and heavy reads if client query bounds are not constrained.
- **Search System:** Partially hybrid, but typing lags occur if full collection states are hydrated or non-debounced matching runs repeatedly on the main thread.

### Critical Bottlenecks & Weaknesses
1. **Routing File Bloat:** Logic for message routing, chat updates, and integration mappings resides directly in routing routes (`mobilemessage.ts`, etc.).
2. **Duplicate Realtime Listeners:** Independent components mount their own listeners to the same Firestore collections, causing redundant reads.
3. **Timeline Hydration:** In ticket details, a history of updates is loaded fully on initial render without virtualization, slowing down ticket loads.
4. **Main Worker Typing Lag:** Heavy-weight text indexes and fuzzy scanning inside client UI components cause frame-rate drops.

---

## 2. Backend Decomposition Roadmap
To enable modular scaling, testability, and isolated deployment, the backend is partitioned out of `/server/routes` into independent decoupled layers.

```
/server
  ├── /controllers     # Thin routers parsing headers/params and invoking services
  ├── /services        # Database actions, integrations, business processes
  ├── /transports      # Dedicated message wrappers (SMS, RCS, Carrier hooks)
  ├── /validators      # Strict runtime payloads checks (Zod / custom schema checks)
  └── /jobs            # Async retry mechanisms, cron evaluations, heavy stats processing
```

### Transition Steps
- Move SMS/RCS inbound/outbound triggers from `/server/routes/mobilemessage.ts` to `MessagingService.ts` and `TransportService.ts`.
- Move RepairShopr webhooks logic and sync queues from `/server/routes/repairshopr.ts` to an `IntegrationService.ts`.
- Keep route entry points to under 60 lines of code acting exclusively as request validation and response mapping.

---

## 3. Frontend Decomposition Roadmap
To streamline the frontend bundles and prevent render locks:
- **Feature Encapsulation:** Transition all components to are stored within `/src/features/[feature_name]/components`, with isolated services under `/src/features/[feature_name]/services`.
- **Stateless Views:** Ensure components do not pull `onSnapshot` locally. All real-time data should be channeled through high-level query bounds or cached services.
- **Custom React Hooks:** Wrap standard mutations in isolated custom hooks (`useTicketActions`, `useRosterSettings`) to keep components clean.

---

## 4. Firestore Scaling Redesign
High Firestore bills occur during heavy technician usage when listening to unbounded collections.

### Scoped Collections & Query Bounds
- **Kanban Column Limits:** Constrain the main dashboard listener to show *only* active stages (`diagnosing`, `repairing`, `testing`) within a 14-day updated-at limit. Archive and filter finished states out of default real-time query views.
- **Document Read Optimization:** Avoid collection-wide snaps. Queries must bind `where('assignedTo', '==', currentTechUid)` and limit pagination size (e.g., `limit(15)`).

---

## 5. Realtime Optimisation Strategy
To mitigate rerender storms and hydration spikes:
- **Shared Snapshot Hub:** Direct all real-time events to store caches where listeners are multiplexed.
- **Debounced Rendering:** Queue Firestore snapshot writes into atomic store updates to avoid triggering 10 successive state changes during high-throughput message bursts.
- **Primitive Selector Boundaries:** React components select nested properties (e.g., standard status values) from state containers instead of subscribing to rich object structures.

---

## 6. Enterprise Search Engine Redesign
The current Fuse.js/in-memory searching must be replaced with a high-speed, thread-safe indexing architecture.

```
[Firestore Changes] ──► [Web Worker Indexer] ──► [IndexedDB Local Cache]
                                                       │
                                           [Instant Fuzzy Match UI]
```

- **Lowercase Field Normalization:** Compute indexable arrays like `searchableTerms` on the server during database writes (e.g., `['john', 'doe', 'iphone', '12']`).
- **Web Worker Refinement:** Move fuzzy text evaluation off the browser paint cycle into a standard background thread using HTML5 Web Workers, preventing typing delays.

---

## 7. Mobile-First Technician Workflow Redesign
Optimize for field technicians working on mobile devices:
- **One-Hand UI Zone:** Place essential workflow transitions (Stage Move, Camera Upload, Add Log) within a thumb's reach near the bottom of the viewport.
- **Swipe Actions:** Support horizontal swiping on ticket queues (e.g., Swipe Right to Mark Finished, Swipe Left to Call Client).
- **Reduced Clutter:** Introduce an isolated "Technician Mode" layout that toggles off complex charts, parts invoice totals, and administrative configuration menus.

---

## 8. Workflow Engine Architecture
Centralize business rules, status loops, and automation triggers:

```
[Event Trigger] ──► [WorkflowRulesEvaluator] ──► [Auto-Assignment]
                                                          │
                                                [Xero Integration Push]
                                                          │
                                                 [SLA Timer Registered]
```

- **Transition Rules:** Ensure stages follow correct workflows (e.g., cannot mark 'ready for pickup' from 'new' without passing through 'diagnosing' / 'QC').
- **Escalation Triggers:** Automatically reassign stale tickets or ping supervisors when a timer exceeds defined SLA limits.

---

## 9. State Management Redesign
Consolidate inconsistent distributed local react states into a single unified reactive container.
- **Zustand Core Store:** Manage tickets, queues, user preferences, and message states in a single atomic store.
- **Transient UI State:** Use lightweight, local `useState` only for transient control states (e.g., toggle drop-down dropdowns, active inputs, etc.).

---

## 10. Messaging Architecture Redesign
Transition RepairSync from a basic typing visualizer into an enterprise-ready messaging service.
- **Transport Abstraction:** Design a standard unified payload structure that supports carrier fallback (RCS -> SMS -> Email) automatically based on recipient handset capability.
- **Delivery Confirmation:** Hook Twilio / carrier callbacks to store status keys (`sent`, `delivered`, `seen`) live in the thread view.

---

## 11. Timeline Virtualization Strategy
Ticket details pages load hundreds of historical logs, custom notes, and customer interactions, creating a critical performance bottleneck.
- **Virtual Elements (`react-window`):** Dynamically render only visible elements within the immediate scroll area.
- **Chunked Logs Loading:** Fetch logs in pages of 20 elements, appending older logs dynamically as the user scrolls back in time.

---

## 12. Backend Service Architecture
Decompose the Express server into specialized structural classes:
1. **`MessagingService`**: Coordinates carrier gateways, delivery states, and conversational templates.
2. **`TicketWorkflowService`**: Handles safe transition verification, status changes, and technician assignment.
3. **`SearchService`**: Triggers full-text indexing, normalized token generation, and fuzzy matches.
4. **`XeroService`**: Handles automated parts accounting, recurring hire agreements, and queue handling.

---

## 13. Query Optimisation Recommendations
Every firestore query must navigate performance paths efficiently:
- **Composite Indexes**: Declare explicit composite indexes for combinations used frequently (e.g., `status_createdAt`, `assignedTo_priority`).
- **Field Selectivity**: Use projection where possible so clients pull sparse models containing descriptive fields without heavy attachments.

---

## 14. Virtualization Implementation Plan
- Integrate `react-window` or `@tanstack/react-virtual` in:
  1. Ticket Kanban columns lists
  2. Chat Threads message feeds
  3. Client list tables
- Use dynamic sizing heights to cleanly wrap multi-line text descriptions, notes, and attachment media blocks.

---

## 15. Enterprise Settings Hardening
Provide granular enterprise controls:
- **Secure Key Encapsulation**: Strictly hide all external API keys behind system environment configurations.
- **Role Permissions Guard**: Set up real role attributes (`staff`, `manager`, `technician`) on user profiles, enforced both on client pages and inside `firestore.rules`.
- **Autosave Engine**: Commit changes made to settings seamlessly with debounced writes, indicating "Saved" or "Syncing" via inline state badges.

---

## 16. RCS Transport Architecture Redesign
Upgrade visual animations to a programmatic carrier transport:
- **RBM Direct Integration**: Send rich card media, location prompts, and quick-reply option chips to supported RCS handsets.
- **Typing Presence Events**: Exchange typing status real-time via state channels to increase conversational fidelity.

---

## 17. Performance Engineering Roadmap
- **Component Memoization (`React.memo`)**: Seal static ticket cards, labels, and sidebar links to avoid global render propagation.
- **Deferred Attachments Load**: Render placeholders for ticket image logs and request image blocks dynamically when they enter the layout bounds.

---

## 18. Offline-First Strategy
- **Client Cache Integration**: Configure the Firestore offline persistence engine within `/src/firebase.ts`.
- **Optimistic Actions Queue**: Cache technician writes (e.g., ticket status moves, notes additions) locally when network drops. Queue these actions to apply seamlessly when connection restores.

---

## 19. Scalability Recommendations
- **Document Size Boundaries**: Separate image uploads, binary PDFs, or large log summaries out of the main Ticket document space into localized sub-collections.
- **Periodic Index Pruning**: Archive client-side local cache index bounds periodically to prevent memory bloating.

---

## 20. Full Staged Enterprise Stabilisation Roadmap
1. **Phase 1: Backend Decomposition** - Separate `mobilemessage.ts` and `repairshopr.ts` routes into isolated controllers and services.
2. **Phase 2: State & Performance Consolidation** - Integrate virtualization in deep scrolls, centralize tickets and messages inside Zustand.
3. **Phase 3: Search Engine Refit** - Normalize field indexing and offload fuzzy search to optimized background queues.
4. **Phase 4: Mobile-First UX Refinement** - Optimize the bottom zone for mobile technicians, rendering clean workflow-first action hubs.
