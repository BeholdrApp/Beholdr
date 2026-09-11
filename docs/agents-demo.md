# Isolated agents demo

The demo runs Beholdr, stalkr, the upstream OpenTelemetry Collector, a
net-spectatr sample and a stock .NET SDK control sample on this computer.
No Kubernetes credentials, Terraform, cloud account or organization-specific
configuration is needed. Kubernetes observations are synthetic; application
requests and exported application telemetry are real.

## Start

Keep sibling checkouts named `Beholdr`, `stalkr`, and `net-spectatr`. Install the
Go toolchain from go.mod, .NET SDK 10.0.400, Node.js/npm and tar. The pinned
Collector download currently supports Windows and Linux x64.

```sh
cd Beholdr/web
npm ci
npm run demo:agents
```

Open **http://127.0.0.1:8001/telemetry**. The original Beholdr-only demo can
continue running on port 8000. Ctrl+C stops all components started by this run.
Use `npm run demo:agents:check` for a finite end-to-end check that cleans up its
processes. `-- --no-build` reuses artifacts after a successful build.

The launcher checks ports before starting, verifies the Collector archive
SHA-256, clears inherited telemetry/proxy/Kubernetes settings for child
processes, binds literal loopback addresses and creates a fresh run directory.
Its temporary and runtime files are under ignored `Beholdr/out/`.

| Listener | Local port |
| --- | --- |
| Beholdr agents demo | 8001 |
| net-spectatr sample | 5080 |
| Stock SDK sample | 5081 |
| OTLP/gRPC and HTTP | 4317, 4318 |
| Collector readiness | 13133 |

## Explore

- The agent page shows stalkr's standard Kubernetes metrics by namespace.
- `net-spectatr-demo` shows ASP.NET Core, HttpClient and runtime metrics.
- `stock-otel-demo` proves that the same receiver accepts an ordinary SDK.
- The launcher requests `/work`, `/fail` and the stock sample every five seconds.
  `/fail` deliberately returns HTTP 500 with a typed exception event.
- Cluster, node and workload pages continue using clearly labeled synthetic
  fixtures and bounded in-memory history. Their charts are not yet derived
  from the agents' OTLP output.

The demo deliberately samples all traces for deterministic evidence. The
NetSpectatr library defaults to parent-based 10% root sampling outside this
launcher. Error traces can be sampled out under normal head sampling.

## Limits and next steps

The preview reads a bounded recent portion of the Collector's rotating JSON
output. Counts are counts in that sample, not durable totals. It is not the
production gaze/lair pipeline. Authentication, tenancy, durable storage, cluster
enrollment, release skew tests and real Kubernetes deployment validation remain
future milestones. Infrastructure manifests may be rendered/tested but are not
applied by any demo command.

Each run writes logs and a rotating export under `out/agents-run-*`. These are
local development artifacts. Failed readiness or conformance checks identify
the run directory through the launcher logs. A stopped Collector becomes stale
in the UI after 30 seconds.
