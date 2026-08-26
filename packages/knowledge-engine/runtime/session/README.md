# TradeOS Runtime - Session Memory Strategy

This directory manages session states, revision histories, and active estimation contexts for contractors.

---

## 1. Session Memory Structure
For each estimator session, the runtime compiles a session state file:
`runtime/session/session_{sessionId}.json`

### Session State Schema
```json
{
  "sessionId": "uuid-string",
  "contractorId": "uuid",
  "currentState": "AWAITING_SCOPE | ESTIMATING | REVIEW | COMPLETED",
  "conversationState": [
    { "role": "user | assistant", "content": "String text" }
  ],
  "currentEstimate": {
    "matchedAssemblyId": "uuid",
    "matchedCostItems": [
      { "costItemId": "uuid", "quantity": 150.0 }
    ],
    "assumptions": ["Narrow gate access"],
    "missingInformation": ["Need confirmation of fence height"],
    "clarificationQuestions": ["Is the old fence composite or standard wood?"]
  },
  "revisionHistory": [
    { "timestamp": "ISO-Timestamp", "modifiedBy": "User", "field": "quantity", "oldVal": "150", "newVal": "165" }
  ]
}
```

This state is persisted for 30 minutes in the local runtime cache and synced back to the CRM database upon session closing.
