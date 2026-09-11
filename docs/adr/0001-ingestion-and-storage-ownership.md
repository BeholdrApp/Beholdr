# ADR 0001: Ingestion and storage ownership

Status: Accepted. Date: 2026-09-11. Tracks #1.

## Context

The observer currently reads Kubernetes and external provider data. The
platform roadmap adds an ingestion path, so the earlier blanket prohibition
on owning ingestion no longer describes the intended product.

## Decision

Beholdr owns OTLP ingestion through `gaze` and bounded query access through
`lair`. Established backends own storage engines, indexing, retention and rule
evaluation. The OpenTelemetry Collector handles receiving, batching and
backpressure; Prometheus-compatible systems evaluate metric queries and rules.

Unrestricted user-supplied query access remains a non-goal. The UI selects
named operations, bounded time windows, filters and limits. It never forwards
arbitrary PromQL, LogQL or backend query bodies.

Bundling a backend in a future standalone profile is packaging, not a promise
to replace its engine or every Grafana workflow. Beholdr owns the investigation
experience, entity correlation and operational context; operators can continue
using backend-native tooling directly under its own authorization boundary.

## Consequences

Ingestion now needs explicit identity, tenancy, limits and failure handling.
Backend ownership, retention and backup responsibilities must be documented
per deployment. Current observer/demo functionality must be distinguished from
planned platform features. No infrastructure is provisioned by this decision.
