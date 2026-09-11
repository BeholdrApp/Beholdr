# ADR 0004: Deployment profiles

Status: Accepted design; implementation deferred. Date: 2026-09-11. Tracks #4 and #13.

## Decision

The platform will provide two profiles using the same components and code:

| Profile | Placement | Initial backend defaults |
| --- | --- | --- |
| distributed | Management cluster and N monitored clusters | External stores |
| standalone | One namespace in one cluster | Bundled stores, single replicas |

Each backing service must eventually be independently selectable as bundled
or external (#14). `stalkr` exists in both profiles. It sends OTLP to local
Service DNS in standalone and the management ingress in distributed. Folding
its collector back into the control plane for standalone is rejected because
it would create a divergent production code path.

N=1 hides unnecessary cluster navigation rather than introducing a separate
domain model. Non-.NET OTLP instrumentation and alternate notification
providers must be first-class configurations, not custom forks.

## Delivery and verification

Current work is limited to Beholdr itself and its isolated local demo.
Infrastructure provisioning, including Terraform, is deferred. The demo's
synthetic Source is a test fixture, not the standalone deployment profile.

Both future profiles must run installation, discovery, telemetry, readiness
and failure/recovery checks in CI before this implementation is considered
complete. Issue #4 remains open until those checks in #13 exist. No production
or scale claim follows from the demo or from recording this decision.
