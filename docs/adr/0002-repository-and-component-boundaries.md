# ADR 0002: Repository and component boundaries

Status: Accepted. Date: 2026-09-11. Tracks #2.

## Decision

Use three repositories and six components:

| Repository | Components | Version boundary |
| --- | --- | --- |
| Beholdr | beholdr, gaze, lair, omen | One platform version |
| stalkr | Cluster-side observer and forwarder | Independently upgraded agent |
| net-spectatr | .NET OpenTelemetry distribution | Independently upgraded library |

`beholdr` owns control-plane API/UI and incidents. `gaze` owns ingestion.
`lair` is a storage/query library, not a required network service. `omen` owns
alert normalization, entity resolution and notification delivery.

## Rationale

A repository boundary needs a distinct audience, language, ownership or
upgrade schedule. A separate Deployment alone does not justify it. The agent
and .NET distribution run on independently upgraded infrastructure; the four
platform components ship together. This creates two external compatibility
contracts rather than a separate contract for every internal component.

Separate commands, Dockerfiles, charts and component-aware CI provide build,
test and deployment isolation inside the monorepo. Shared-code changes must
still trigger every affected consumer's checks.

## Promotion triggers

- Split `gaze` when ingestion needs a separate release cadence or owning team.
- Split `omen` when third parties implement integrations against it, or its
  CI dominates the monorepo's cost.
- Split `lair` when a real consumer outside this repository needs it. More
  internal consumers strengthen the case for keeping it here.

Moving to multiple Go modules is a separate response to demonstrated
dependency bloat (#26), not a prerequisite for component boundaries.
