# ADR 0003: Ports and adapters

Status: Accepted. Date: 2026-09-11. Tracks #3.

## Decision

Define interfaces from Beholdr's use cases. Keep their mandatory surface to
the operations all supported adapters can implement. Extra functionality is
advertised through capabilities and checked before the UI offers it.

Use separate `MetricsReader`, `LogSearcher` and `TraceFetcher` ports; avoid a
single backend interface requiring every signal. Elasticsearch need not
implement metrics to provide logs. Capabilities can include exemplars, log
tailing, trace tag search and native histograms. Unsupported features should
explain their absence rather than fail after being selected.

Every port must have two independently useful implementations and a shared
conformance suite before v1. Tests enforce ordering, bounded limits, time
boundaries, filtering/regex semantics, cancellation, errors and capability
claims. A backend adapter is not conformant merely because it compiles.

## Scope

Metrics use the Prometheus HTTP API, with authentication and tenancy handled
outside the domain operation. Trace operations remain narrow around the OTLP
data model; OTLP ingestion does not imply a standard trace query language.

The log port deliberately supports only field equality and explicitly defined
regex semantics, time ranges, free-text substring, direction and limits.
Backend-specific aggregations or parsing expressions do not enter the common
port. Unsupported semantics must be rejected, not silently approximated.

## Consequences

The second adapter and conformance tests can force an interface revision early.
Configuration selects adapters without leaking credentials into domain data.
These interfaces provide backend substitution. Deployment topology remains a
packaging concern governed by ADR 0004.
