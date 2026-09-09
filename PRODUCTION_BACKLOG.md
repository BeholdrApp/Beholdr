# Beholdr production backlog

## Product decision

Beholdr today is a lightweight Kubernetes resource observer with external
telemetry-provider integration. Kubernetes state has about one hour of
in-memory history, while Prometheus supplies bounded per-service long-range
charts. There is no notification delivery, log or trace search, durable
storage, built-in authentication, or arbitrary metric query capability.

**The architecture direction is under active revision.** An earlier note held
that Beholdr would only ever *consume* existing Prometheus, Elasticsearch and
OpenTelemetry data, never owning ingestion, storage or query evaluation. The
target architecture contradicts that — `gaze` owns the ingestion path and
`lair` owns the query path — so the decision is being re-recorded rather than
inherited. See [#1](https://github.com/BeholdrApp/Beholdr/issues/1).

One non-goal survives the revision unchanged: **unrestricted user-supplied
query access stays out of scope.** `lair` exposes named, bounded queries, never
a passthrough for arbitrary PromQL.

The platform shape — three repositories, six components — is recorded in
[#2](https://github.com/BeholdrApp/Beholdr/issues/2), with the full sequencing
in [ROADMAP.md](ROADMAP.md).

1. Make the existing observer safe and dependable for production use.
2. Extend it into a modular observability platform along the architecture
   recorded in [#1](https://github.com/BeholdrApp/Beholdr/issues/1)–[#4](https://github.com/BeholdrApp/Beholdr/issues/4).

Priorities: **P0** blocks a production release; **P1** belongs in the first
production-ready release; **P2** is planned follow-up.

## Release status

**There is no published release.** `BeholdrApp/Beholdr` has no tags, no GitHub
Releases and no prior issue history — earlier drafts of this document cited a
`v0.2.0` prerelease, milestones, and issue numbers that were never created in
this repository. Those references have been removed rather than reconstructed.

The live milestones are:

| Milestone | Scope |
| --- | --- |
| [v0.3.0 — Observer hardening](https://github.com/BeholdrApp/Beholdr/milestone/1) | Close the remaining P0 blockers below. No new architecture. |
| [v0.4.0 — Platform foundations](https://github.com/BeholdrApp/Beholdr/milestone/2) | ADRs, `lair` ports and conformance suite, deployment profiles. |
| [v0.5.0 — Ingestion and agent](https://github.com/BeholdrApp/Beholdr/milestone/3) | `gaze`, the `stalkr` split, cross-repo contracts. |
| [v0.6.0 — Alerting](https://github.com/BeholdrApp/Beholdr/milestone/4) | `omen`. |
| [v1.0.0 — Production platform](https://github.com/BeholdrApp/Beholdr/milestone/5) | First supported release of the full platform. |

Release policy from here on: a tag and GitHub Release are created only once
all required milestone items and release-qualification checks pass. A clearly
labeled preview may still ship early.

## Delivered foundations

- [x] Correct liveness/readiness semantics and stale-data reporting.
- [x] Secure deployment boundary: CORS disabled by default, explicit TLS mode,
  and required ingress authentication unless deliberately overridden.
- [x] Deterministic Go/frontend dependency locks, PR tests, frontend build, and
  container-build quality gates.
- [x] Read-only Prometheus, Elasticsearch, and OpenTelemetry Collector health
  integrations with provider-scoped TLS and secret-backed credentials.
- [x] Fixed, bounded per-service PromQL queries and charts for HTTP error
  rate/week comparison, CPU, memory, and failing pods — configurable metric and
  label profile, thresholds validated at startup, severity scored from an
  instant query so it does not vary with the selected chart window, and reports
  cached, de-duplicated and concurrency-bounded so the UI cannot amplify load
  onto Prometheus.
- [x] StatefulSet and DaemonSet discovery with real desired/ready status
  (read from their own spec/status, not inferred from observed pod count),
  kind-aware workload/HPA identity so same-named workloads of different
  kinds no longer collide, explicit Job handling, and CronJob runs collapsed
  into one workload instead of one entry per scheduled run.
- [x] Dependency and toolchain vulnerability triage against the actual
  release build (see below), with the Go build toolchain and frontend build
  toolchain deliberately upgraded rather than accepting `npm audit fix
  --force`'s downgrade suggestions.
- [x] Supply-chain hardening
  ([#6](https://github.com/BeholdrApp/Beholdr/issues/6)): every base image
  pinned by digest and every GitHub Action by commit SHA (a floating tag
  silently changes what a reproducible build produces), Dependabot watching
  those pins so they cannot rot, SBOM and `mode=max` build provenance attached
  to every published image as registry attestations plus a downloadable
  workflow artifact, and a Trivy scan of the *built image* in CI — which
  reaches the Go standard library inside the binary, the surface the
  2026-09-05 triage found dependency scanning had missed.
- [x] Correct collector metric availability under failure
  ([#5](https://github.com/BeholdrApp/Beholdr/issues/5)): availability is
  derived per collection and carried in the snapshot instead of latched onto
  the shared `k8s.Client`, which removes the data race between the collector
  goroutine and HTTP handlers and lets a transient metrics-server outage
  recover without a restart. Unavailable and partial data are now distinct
  states, per-node/pod/workload gaps are flagged, and the UI renders unmeasured
  usage as unknown rather than as zero.

## Dependency and toolchain vulnerability triage (2026-09-05)

- **Go toolchain.** `govulncheck` found 28 reachable advisories, all in the
  Go standard library shipped inside the compiled binary (`crypto/tls`,
  `crypto/x509`, `net/http`, `encoding/asn1`, etc.) plus two in
  `golang.org/x/net` (GO-2026-4918, GO-2026-5026). The release binary is a
  static Go build, so the compiler's own standard library is part of its
  vulnerability surface — this was not caught by dependency scanning alone.
  Fixed by pinning the release Docker build image to a current patch release
  (`golang:1.25.14-alpine`, replacing a floating, unsupported
  `golang:1.22-alpine`) and bumping `golang.org/x/net`/`x/oauth2`/`x/sys`/
  `x/term`/`x/text`/`x/time` to current versions. Re-running `govulncheck`
  against the updated graph reports zero reachable module vulnerabilities.
- **npm/frontend.** `npm audit` reported 7 findings (1 high, 3 moderate, 3
  low), all rooted in the Vite 5.x dev-server toolchain (path traversal and
  request-handling issues in Vite/esbuild's dev server) — not reachable in
  the shipped app, since production serves a prebuilt static SPA from the Go
  binary and never runs the Vite dev server, but still worth fixing since
  `npm run dev` is used locally. Fixed deliberately: Vite 5→6,
  `@sveltejs/vite-plugin-svelte` 4→5, and `@sveltejs/kit`/
  `@sveltejs/adapter-static`/`svelte-check`/`typescript` bumped to their
  latest compatible releases, verified with a clean `npm run check` and
  `npm run build`.
- **Caught by the new image gate (2026-09-09).** The first CI run of the Trivy
  scan added in [#6](https://github.com/BeholdrApp/Beholdr/issues/6) blocked on
  CVE-2026-46600 — a denial of service in `golang.org/x/net/dns/dnsmessage`,
  HIGH, present in the built binary at v0.55.0 and fixed in v0.56.0. Bumped.
  Worth recording as evidence for the gate: `govulncheck` classes the same
  advisory as *not reachable* from Beholdr's code, so a reachability-only check
  would have let it ship. Scanning the artifact for what is *present* and the
  source for what is *reached* answer different questions, and this is a case
  where they disagreed.
- **Remaining, accepted.** One low-severity finding (`cookie` < 0.7.0,
  GHSA-pxg6-pf52-xh8x) is pinned by `@sveltejs/kit`@2.70.3, the latest
  stable release — the fix ships only in SvelteKit's 3.0.0 prerelease line.
  Beholdr uses `adapter-static` (a prerendered SPA with no SvelteKit server
  runtime or cookie handling in production), so this finding is not
  reachable in the shipped app. Revisit once SvelteKit 3 stabilizes.
- **Severity policy** (signed off 2026-09-09, enforced in CI): a HIGH or
  CRITICAL finding in the built image blocks the pull request **when a fix is
  available**. Unfixed findings are reported in the job log but do not block —
  an unfixable upstream CVE must not wedge every pull request. Dev-toolchain
  and non-reachable findings are tracked here rather than gating. Widen the
  gate by setting `ignore-unfixed: false` in `.github/workflows/ci.yml`.
  Source-level enforcement (`govulncheck`/`npm audit`) is still open — see
  "Finish automated quality gates" below.

## P0 — remaining release blockers

- [ ] **Finish automated quality gates** ([#7](https://github.com/BeholdrApp/Beholdr/issues/7))**.** Backend/frontend tests and builds plus
  the container build run on pull requests. Add IaC validation, vulnerability
  and license checks, publish coverage, and fail on coverage regressions.

- [ ] **Run a security and scale validation against a representative cluster.**
  Validate least-privilege RBAC, namespace isolation, API response size,
  collection duration, API-server request rate, memory growth, and UI behavior
  at the target pod/node/workload counts. Define and test a supported scale
  envelope before launch.

## P1 — production-ready observer

- [ ] **Persist history and define retention.** Add a pluggable durable store,
  migrations, retention/downsampling, backups/restores, and a graceful
  degradation path. Keep an in-memory option for local/demo use.

- [ ] **Provide high availability.** Make collectors horizontally safe via
  leader election/sharding and shared storage, add a PodDisruptionBudget, and
  document recovery and upgrade behavior. A single in-memory replica must not
  be the source of truth for operational data.

- [ ] **Use Kubernetes watches/informers.** Replace repeated full object lists
  with shared informers and cache state; retain periodic reconciliation as a
  correctness backstop. Bound concurrency and expose collection latency/error
  metrics.

- [ ] **Improve resource accuracy.** Calculate scheduling pressure from
  allocatable (not raw capacity), expose requests *and* limits, account for
  init containers/pod overhead, distinguish usage samples from instantaneous
  utilization, and surface missing or stale metrics explicitly.

- [ ] **Cover core Kubernetes operational signals.** Add pod/container state
  reasons, OOMKills, CrashLoopBackOff, restart rate, image/version, owner
  hierarchy, rollout progress, unschedulable pods, node conditions/pressure,
  PVC status, and Kubernetes Events with correlation to each workload.

- [ ] **Add filtering and safe API contracts.** Implement pagination,
  namespace/label/status filters, sorting, server-side time-range queries,
  stable versioned API schemas, validation and encoded path handling, request
  limits/timeouts, compression, and a generated OpenAPI contract.

- [ ] **Improve the operator experience.** Add global search, a unified
  workload/pod detail route, time-range selection and zoom, table sorting,
  empty/error/stale states, saved URL filters, responsive/mobile layout, and
  accessibility and keyboard checks.

- [ ] **Operate Beholdr itself.** Expose Prometheus-format self-metrics,
  structured request logs, traces, profiling, audit logs, dashboards, and an
  operational runbook (install, upgrade, rollback, recovery, and incident
  triage).

- [ ] **Harden deployment defaults.** Add security context (read-only root
  filesystem, dropped capabilities, seccomp), NetworkPolicy guidance, resource
  sizing, image pull policy, PDB, pod anti-affinity/topology spread where HA is
  enabled, and a Helm chart with values/schema validation. Keep raw manifest
  and Terraform outputs aligned.

- [ ] **Document supported environments and failure modes.** Include
  metrics-server requirements, Kubernetes version matrix, RBAC modes,
  namespace-scoped deployment option, capacity limits, data-retention
  guarantees, and troubleshooting. Remove or add the missing Terraform README
  referenced by the root README.

## P1 — platform capabilities

The architecture decision this section used to defer — integrate with
existing telemetry systems versus have Beholdr own ingestion and query — is
being recorded in [#1](https://github.com/BeholdrApp/Beholdr/issues/1). The target architecture has Beholdr owning the
ingestion path (`gaze`) and the query path (`lair`) while still delegating
storage engines and rule evaluation to established systems. Unrestricted
user-supplied query access remains a non-goal.

- [ ] **Resolve what the architecture decision leaves open.** Tenancy, data
  model for cross-provider correlation, retention policy for Beholdr's own
  operational state (see "Persist history" above), cost model, availability
  SLOs, and the migration path as more providers are added. Tenancy is
  partly covered by [#9](https://github.com/BeholdrApp/Beholdr/issues/9); correlation by [#8](https://github.com/BeholdrApp/Beholdr/issues/8) and [#21](https://github.com/BeholdrApp/Beholdr/issues/21).

- [ ] **Adopt OpenTelemetry as an integration contract alongside Prometheus.**
  Support OTLP for traces, metrics, and logs from existing OpenTelemetry
  pipelines; propagate service/resource attributes; provide Kubernetes
  enrichment; and publish language/platform onboarding examples. Ingestion is
  `gaze`'s job — see [#17](https://github.com/BeholdrApp/Beholdr/issues/17) and [#18](https://github.com/BeholdrApp/Beholdr/issues/18); the agents are
  [net-spectatr](https://github.com/BeholdrApp/net-spectatr) and any
  OTLP-compliant instrumentation.

- [ ] **Extend metric consumption from Prometheus and OpenTelemetry.**
  Fixed, bounded, cached service-range queries with configurable metric/label
  profiles are delivered (see "Delivered foundations"). Managed-Prometheus
  identity and token refresh is folded into the auth-strategy work in
  [#9](https://github.com/BeholdrApp/Beholdr/issues/9). Remaining here: broader label/dimension support and
  recording-rule guidance for keeping Beholdr's own queries cheap — not a
  general query language, which stays out of scope per [#1](https://github.com/BeholdrApp/Beholdr/issues/1) and
  [#8](https://github.com/BeholdrApp/Beholdr/issues/8).

- [ ] **Build a dashboard and exploration layer.** Add composable dashboards,
  panels, variables, annotations, sharing/export, provisioning as code,
  permissions, and a metric/log/trace explorer scoped to the fixed queries
  Beholdr already knows how to run safely — not ad-hoc or arbitrary backend
  queries, which remain a non-goal per [#1](https://github.com/BeholdrApp/Beholdr/issues/1).

- [ ] **Build alerting and incident response** — now scoped as `omen`:
  [#20](https://github.com/BeholdrApp/Beholdr/issues/20) intake, [#21](https://github.com/BeholdrApp/Beholdr/issues/21) entity resolution, [#22](https://github.com/BeholdrApp/Beholdr/issues/22) delivery
  adapters, [#23](https://github.com/BeholdrApp/Beholdr/issues/23) durable notification log, [#24](https://github.com/BeholdrApp/Beholdr/issues/24) the
  alert/incident boundary.

- [ ] **Build logs and trace correlation.** Add indexed log ingestion/search
  with retention controls, distributed trace storage/search, service maps,
  error analytics, and links between deploys, events, metrics, logs, and
  traces. Add browser RUM and synthetics only after the core backend signals.

- [ ] **Design identity and tenancy.** Implement SSO (OIDC/SAML as required),
  RBAC, teams/projects, per-tenant quotas and retention, audit trails, data
  isolation, and secret-management policies before accepting multiple users or
  clusters.

- [ ] **Support multi-cluster and lifecycle management.** The agent is
  [stalkr](https://github.com/BeholdrApp/stalkr); deployment topology is
  [#13](https://github.com/BeholdrApp/Beholdr/issues/13) and version compatibility is
  [stalkr#3](https://github.com/BeholdrApp/stalkr/issues/3). Remaining here:
  configuration-as-code, health reporting, and cost/usage accounting.

## P2 — high-value differentiators

- [ ] **Kubernetes cost and capacity intelligence:** rightsizing from usage
  history, request/limit recommendations, bin-packing visibility, idle
  workloads, and cost allocation by team/namespace/label.
- [ ] **Change intelligence:** correlate deploys, configuration changes,
  autoscaling, events, and incidents; add rollback-risk and anomaly views.
- [ ] **Complete service health views:** the first error/CPU/memory/pod signals
  now exist; add dependency/service maps, latency, traffic, SLO scorecards,
  error-budget forecasting, and release-health comparison.
- [ ] **Integrations:** Alertmanager-compatible webhooks, Slack/PagerDuty/email,
  GitHub/GitOps annotations, cloud-provider metrics, databases, and managed
  Kubernetes distributions.

## Suggested release gates

Do not market Beholdr as a replacement until the platform-architecture items
are implemented and independently load/security tested. For the near-term
observer release, all P0 items must be complete, P1 observer work must have an
explicitly accepted scope, and the release must pass a representative-cluster
test with a documented supported scale and recovery exercise.
