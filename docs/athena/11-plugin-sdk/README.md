---
status: current
owner: platform
last_verified: 2026-08-09
source_of_truth: true
---

# Volume 11 - Plugin SDK

Athena may eventually support third-party developers through a governed plugin
ecosystem. This is future architecture, not a current production capability.

## Plugin Manifest

```json
{
  "id": "com.example.weather-risk",
  "name": "Weather Risk Advisor",
  "version": "1.0.0",
  "athenaContractVersion": "1.0.0",
  "tools": ["com.example.weather-risk.assessJob"],
  "contextProviders": ["com.example.weather-risk.forecast"],
  "eventsConsumed": ["JobScheduled"],
  "eventsPublished": [],
  "permissions": ["dispatch.manage"],
  "network": { "allowedHosts": ["api.example.com"] },
  "dataUse": { "storesCustomerData": false, "retentionDays": 0 }
}
```

## Extension Points

| Extension | Requirement |
| --- | --- |
| Tool registration | Must use C002 Tool and C003 Tool Result |
| Context providers | Must use C010 and declare freshness/failure behavior |
| Events | Must use C008 and reviewed event subscriptions |
| Permissions | Must request least-privilege existing TradeOS capability keys |
| Telemetry | Must emit C011-compatible redacted telemetry |

## Capability Review

Before install, TradeOS reviews requested permissions, data categories, network
access, event subscriptions, risk class, approval policy, sandboxing, logging,
privacy, support contact, and version compatibility.

## Install And Uninstall Lifecycle

1. Manifest submitted.
2. Automated schema and security checks run.
3. Human or admin review approves capability set.
4. Organization installs plugin and grants capabilities.
5. Registry exposes permitted tools/providers.
6. Telemetry and health are monitored.
7. Updates require compatibility checks.
8. Uninstall revokes credentials, stops providers, disables tools, and preserves
   audit history.

## Trust Boundaries

Plugins cannot bypass Athena policy, TradeOS permissions, RLS, application
services, approval gates, or telemetry. Plugin output is untrusted content until
validated and policy-reviewed.

## Marketplace And Governance

Marketplace governance should include publisher identity, support policy,
security review status, compatibility matrix, data-use disclosure, incident
contact, revocation process, and customer-visible install history.
