# Screenshot Perfect

Implement exactly the screenshot and nothing else

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/d7fb8529-a325-42af-8d33-ea04d99bcdbd).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## TEA – Tender Execution Agent (frontend only)

Frontend for GREEN DigitALL's UN tender workflow. There is no backend: all data comes
from an in-memory mock store that resets on a full page reload. Use the role switcher in
the top bar to act as the CEO, the Solution Engineering Lead or the Admin.

### For the backend team

| Path | What it is |
| --- | --- |
| `src/types/*.ts` | Every data type (Tender, Approval, AuditEntry, Settings, …). Match these in the API. |
| `src/services/index.ts` | The public data API. Every function is async and typed. Re-implement these as API calls with the same signatures; no UI changes needed. |
| `src/services/store.ts` | Mock-only in-memory state. Delete it when the API exists. |
| `src/mocks/*.ts` | The 8 sample tenders, users, suppliers and settings. |
| `src/lib/workflow.ts` | Workflow rules: gate roles, stage order, version-hash scopes, margin maths. The backend must enforce the same rules. |
| `src/lib/deadline.ts` | Notice deadline → UTC → PNG (UTC+10) conversion. `(GMT h.mm)` means hours and minutes. |
| `src/lib/sha256.ts` | SHA-256 over canonical JSON (sorted keys), used for approval version hashes. |

Rules the backend must keep:

- Each gate has one approver role (`GATE_ROLE`); the AI is never an approver. Every decision needs a reason.
- Each approval stores the SHA-256 of the content in its gate's scope (`gateHash`). When that content changes, the approval becomes `VOIDED` and the tender moves back to the earliest voided gate.
- A decision is refused if the hash the approver saw (`expectedHash`) no longer matches.
- Owner and a different backup owner are required before leaving `DISCOVERED`.
- The person who prepared the package cannot approve G4.
- A requirement cannot be `MET` until a person verifies its quote.
- Outgoing emails stay `PENDING_APPROVAL` until the CEO approves GC; a person sends them.
- Every action writes an audit entry.

Tests: `npm test` (deadline conversion, SHA-256 vectors, role and gate rules).
