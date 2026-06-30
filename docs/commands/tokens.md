<!-- Loaded when: owner types #tokens -->
Purpose: analyse token / model efficiency for the current session and give one concrete verdict + action.

# #tokens

Analyse token/model efficiency: look at the session transcript, then give a CONCRETE verdict covering:
- **new chat vs continue** — should this conversation keep going or start fresh?
- **right model for the task** — is the current model appropriate, or over/under-powered?
- **cache hit rate** — how well is prompt caching working?
- **waste patterns** — where tokens are being burned needlessly.
- **one recommended action** — the single highest-value next step.
