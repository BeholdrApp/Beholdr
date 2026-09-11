# Local Beholdr demo

This demo runs Beholdr only. Infrastructure provisioning and integration with
an organization's clusters are separate future steps.

## Start

Install Go 1.25.14 or newer and Node.js 22 with npm. From the repository root:

```sh
cd web
npm ci
npm run demo
```

Open http://127.0.0.1:8000. The launcher builds the static UI and compiles it
into the Go binary in a temporary staging directory under `out/`. Source files
are not rewritten. Keep the terminal open; Ctrl+C stops the application.

To run an already-built demo, execute `out/beholdr-demo -demo` from the root
(`.\out\beholdr-demo.exe -demo` in PowerShell). For frontend development,
`go run ./cmd/beholdr -demo` and `npm run dev` in `web/` also work.

## Walkthrough

1. **Cluster:** three sample nodes, fourteen pods and six workloads. Resource
   usage changes every five seconds. Recent cluster history grows while running.
2. **Nodes:** open a worker to inspect its pods and resource trends.
3. **Microservices:** filter by `shop` or `platform`. Open `checkout` to see
   two of three replicas ready, restarts, an HPA, elevated HTTP errors and a
   failing-pod signal. Open `catalog` to compare a healthy service.
4. **Service health:** switch between 1h, 6h, 24h, 7d and 21d windows. These
   charts have generated history immediately; the normal bounded query and
   severity calculation code processes the synthetic query results.
5. **Observability:** external providers are intentionally disconnected.

All displayed values are synthetic. This is a product walkthrough and an
integration smoke test, not evidence of Kubernetes compatibility or supported
production scale. It does not implement the future `gaze`, `stalkr`, `lair` or
`omen` deployment profiles.

## Isolation and checks

`-demo` ignores environment configuration entirely, including kubeconfig,
provider URLs, credentials, CORS settings and listen-address overrides. It
binds to `127.0.0.1:8000`. No Terraform or Kubernetes commands are executed.
The first build can download Go/npm dependencies; the running demo needs no
network beyond the browser's loopback connection.

```sh
cd web
npm run check
npm test
npm run demo:check
```

The last command builds and starts the embedded application, checks readiness,
all six workload detail and metrics endpoints, sample severity, provider
isolation and the embedded UI, then stops it. Backend regression tests run
with `go test ./...` from the repository root.

If port 8000 is in use, stop the other local listener before starting the demo.
The synthetic data is in memory and resets on restart. No organization names,
cloud subscription identifiers or real cluster names belong in demo fixtures.
