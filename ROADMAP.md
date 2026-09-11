# Beholdr roadmap

How Beholdr gets from a single-cluster read-only observer to a modular
observability platform, and which repository each piece lives in.

Execution detail for the current observer lives in
[PRODUCTION_BACKLOG.md](PRODUCTION_BACKLOG.md). This document covers the
architecture and the sequencing.

The founding decisions are recorded in [ADR 0001](docs/adr/0001-ingestion-and-storage-ownership.md),
[ADR 0002](docs/adr/0002-repository-and-component-boundaries.md),
[ADR 0003](docs/adr/0003-ports-and-adapters.md) and
[ADR 0004](docs/adr/0004-deployment-profiles.md). Profile implementation and
infrastructure provisioning remain deferred while the Beholdr application is
developed and tested independently.

## Components

Six components, three repositories.

| Component | Repository | Runs in | Responsibility |
| --- | --- | --- | --- |
| `beholdr` | [Beholdr](https://github.com/BeholdrApp/Beholdr) | management cluster | Control plane, API, UI, incidents, configuration, cluster management |
| `gaze` | [Beholdr](https://github.com/BeholdrApp/Beholdr) | management cluster | OTLP ingestion, tenancy, external probing |
| `lair` | [Beholdr](https://github.com/BeholdrApp/Beholdr) | *(library)* | Storage and query ports for metrics, logs and traces |
| `omen` | [Beholdr](https://github.com/BeholdrApp/Beholdr) | management cluster | Alert normalization, entity resolution, notification delivery |
| `stalkr` | [stalkr](https://github.com/BeholdrApp/stalkr) | every monitored cluster | Cluster discovery, health collection, telemetry forwarding |
| `net-spectatr` | [net-spectatr](https://github.com/BeholdrApp/net-spectatr) | monitored .NET apps | OpenTelemetry distribution for .NET |

### Why three repositories and not six

A separate repository is justified by a different **audience**, **language**, or
**upgrade schedule** — not by a different Deployment.

`stalkr` and `net-spectatr` clear that bar: they run on infrastructure Beholdr's
operators do not control, and must stay compatible across versions nobody can
force anyone to upgrade. `gaze`, `omen` and `lair` all ship to the management
cluster on the same schedule and would be upgraded together anyway.

Three repositories means **two** compatibility contracts to maintain instead of
the six-plus a full split would create. Component separation is cheap;
repository separation costs version negotiation, and only those two boundaries
pay for it.

Independent buildability, testing, containerization and Helm deployment are all
achieved inside the monorepo with separate `cmd/`, Dockerfiles, charts and
path-filtered CI. That requirement does not force a repository split.

Recorded in [#2](https://github.com/BeholdrApp/Beholdr/issues/2), with
promotion triggers for splitting later.

## Design commitments

**Standards at every boundary.** The architecture has exactly three external
coupling points and all three are standards: **OTLP in** (`gaze`), the
**Prometheus HTTP API out** (`lair`), and the **Alertmanager webhook** (`omen`).
New environments plug into standards, not into Beholdr protocols — which is
what makes adding a language or swapping a backend a configuration exercise
rather than a fork.

**Ports and adapters, defined by use case.** Every external backend sits behind
a port shaped by what Beholdr needs, not by what the backend offers. Adapters
declare capabilities and the UI degrades rather than erroring. Two
implementations per port from the start, because one implementation hides the
leaks. A shared conformance suite is what makes the ports real.
([#3](https://github.com/BeholdrApp/Beholdr/issues/3),
[#8](https://github.com/BeholdrApp/Beholdr/issues/8),
[#11](https://github.com/BeholdrApp/Beholdr/issues/11))

**Don't rebuild the commodity.** Rule evaluation belongs to the Mimir ruler.
Grouping, dedup, silences and inhibition belong to Alertmanager. OTLP receiving,
batching and backpressure belong to the OpenTelemetry Collector.
Auto-instrumentation belongs to the upstream OTel SDKs. Beholdr builds entity
resolution, correlation, and the operator experience on top.

**Single-cluster is N=1, not a mode.** Two CI-tested deployment profiles —
`distributed` and `standalone` — sharing one set of components and one set of
code paths. `stalkr` exists in both; in `standalone` it pushes to in-cluster
Service DNS instead of a remote ingress, and that is the only difference.
([#4](https://github.com/BeholdrApp/Beholdr/issues/4),
[#13](https://github.com/BeholdrApp/Beholdr/issues/13))

**Query access stays bounded.** `lair` exposes named, bounded queries. It is
never a passthrough for arbitrary PromQL, and unrestricted user-supplied query
access remains a non-goal.

## Milestones

### [v0.3.0 — Observer hardening](https://github.com/BeholdrApp/Beholdr/milestone/1)

Close the remaining P0 blockers on what exists today. No new architecture.

- [#5](https://github.com/BeholdrApp/Beholdr/issues/5) collector health and metric availability under failure
- [#6](https://github.com/BeholdrApp/Beholdr/issues/6) supply-chain hardening
- [#7](https://github.com/BeholdrApp/Beholdr/issues/7) automated quality gates

### [v0.4.0 — Platform foundations](https://github.com/BeholdrApp/Beholdr/milestone/2)

Record the decisions, then build the seams everything else depends on.

- [#1](https://github.com/BeholdrApp/Beholdr/issues/1)–[#4](https://github.com/BeholdrApp/Beholdr/issues/4) the four founding ADRs
- [#8](https://github.com/BeholdrApp/Beholdr/issues/8)–[#12](https://github.com/BeholdrApp/Beholdr/issues/12) `lair`: ports, config restructure, extraction, conformance suite, second adapters
- [#13](https://github.com/BeholdrApp/Beholdr/issues/13)–[#15](https://github.com/BeholdrApp/Beholdr/issues/15) deployment profiles, bundled-or-external backends, N=1 UI
- [#16](https://github.com/BeholdrApp/Beholdr/issues/16) tracking: the seven assumptions that must not enter v1

### [v0.5.0 — Ingestion and agent](https://github.com/BeholdrApp/Beholdr/milestone/3)

- [#17](https://github.com/BeholdrApp/Beholdr/issues/17)–[#19](https://github.com/BeholdrApp/Beholdr/issues/19) `gaze`
- [#25](https://github.com/BeholdrApp/Beholdr/issues/25) cross-repo contracts and generated clients
- [stalkr#1](https://github.com/BeholdrApp/stalkr/issues/1)–[#3](https://github.com/BeholdrApp/stalkr/issues/3) extraction, egress-only OTLP, compatibility policy
- [net-spectatr#1](https://github.com/BeholdrApp/net-spectatr/issues/1)–[#3](https://github.com/BeholdrApp/net-spectatr/issues/3) the .NET distribution

### [v0.6.0 — Alerting](https://github.com/BeholdrApp/Beholdr/milestone/4)

- [#20](https://github.com/BeholdrApp/Beholdr/issues/20)–[#24](https://github.com/BeholdrApp/Beholdr/issues/24) `omen`

### [v1.0.0 — Production platform](https://github.com/BeholdrApp/Beholdr/milestone/5)

First supported release. Load and security tested, documented supported scale,
both deployment profiles verified, every port covered by its conformance suite.

## Delivery target

Develop and validate Beholdr as an independent project first. The local demo
runs only Beholdr, with explicitly labeled synthetic data and no external
infrastructure connections. Infrastructure provisioning is deferred.

The future distributed profile uses a shared management cluster running
`beholdr`, `gaze` and `omen`, with `stalkr` in each monitored cluster pushing
outward only. No organization-specific cluster, domain or cloud account is
part of the product contract.

## The test this design has to pass

Install a stable v1 into a shop with **one cluster, no management cluster, no
Prometheus or Grafana, a Java application stack, and Opsgenie instead of
PagerDuty.**

Three of those four are adapter or configuration changes the ports already
handle. The missing management cluster is a packaging problem, not an interface
problem — which is why deployment profiles are a v0.4.0 concern rather than
something bolted on later. [#16](https://github.com/BeholdrApp/Beholdr/issues/16)
tracks the assumptions that would turn that install into a fork.
