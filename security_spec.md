# Phase 0: Payload-First Security TDD

## 1. Data Invariants
- **Message**: A message must have a valid `uid` (sender) and correct `timestamp`. Wait, messages (`crm_messages`) have a `userId` which should match the authenticated user.
- **Contact**: A contact (`contacts`) must be tied to a `uid`? Contacts seem to be synced from RepairShopr, or managed globally? If managed globally by verified users, then any verified user can create/update.
- **Conversation**: Contains a `uid`. Must be managed by the user who owns it? Or is it global for the shop? Usually global but tracks `lastMessageAt`.
- **PartsOrder**: Must have `uid` equal to the user creating it, cannot modify once created, status can be updated.
- **QuoteInquiry**: Public webform. Anyone can create (unauthenticated). Only authenticated staff can read/update (e.g. status).
- **FormConfig**: Only authenticated admins (or any staff?) can read/update.
- **Shift**: Staff scheduling. Authenticated staff can read. Admins can create/update. Or staff can create leave requests.
- **LeaveRequest**: `userId` must match the creator. Only admins can approve (`status` transition).
- **Ticket**: `uid` must verify the staff who created it. Status changes are allowed.

## 2. The "Dirty Dozen" Payloads
1. **Unauthenticated Write**: Creating a ticket without being logged in.
2. **Identity Spoofing**: Creating a `PartsOrder` with a `uid` belonging to someone else.
3. **Array/String Poisoning**: Sending a 1MB string for `Message.text` or `Ticket.subject`.
4. **Update Gap**: Updating a `Ticket` with a phantom field `isAdmin: true` or `paid: true` that bypasses validation.
5. **Terminal State Shielding**: Changing `QuoteInquiry` status to `converted`, then trying to change it back to `new`.
6. **PII Exfiltration**: Unauthenticated user trying to read `QuoteInquiry` containing emails/phones.
7. **Privilege Escalation**: Standard user updating their own role or a `LeaveRequest.status` to `approved`.
8. **Relational Orphan**: Creating a `Ticket` with a non-existent `customer_id`.
9. **Timestamp Fast-Forward**: Creating a `Message` with a future `timestamp`.
10. **Public Unbounded List**: Fetching all `QuoteInquiry` documents without filters (if not careful with index/limits).
11. **Denial of Wallet**: Creating a Ticket with an infinite array of tags.
12. **Ghost Update**: Sending an empty update or a completely different schema to `settings` document.

## 3. The Test Runner
(A complete `firestore.rules.test.ts` file will verify that the DRAFT rules block these payloads.)
