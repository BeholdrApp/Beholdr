# Telemetry boundary, revision 1

This is the canonical contract for stalkr and net-spectatr. Neither agent sends
Beholdr snapshot JSON or requires a proprietary handshake. The wire schema is
the upstream [OTLP protobuf](https://github.com/open-telemetry/opentelemetry-proto),
consumed through generated upstream packages. Do not copy these definitions.

- Metrics and traces enter gaze over OTLP/HTTP protobuf or OTLP/gRPC.
- stalkr currently exports OTLP/HTTP metrics through gaze. Direct remote write
  and Prometheus federation are future additions, not competing default paths.
- net-spectatr uses upstream OTLP exporters and standard OTEL environment
  variables. Stock OpenTelemetry SDKs require no Beholdr package or attributes.
- Resource identity uses `service.name`, `service.namespace`, `service.version`
  and standard `k8s.*` attributes. Missing Kubernetes attributes are permitted
  for applications outside Kubernetes; they must not cause ingestion rejection.
- Instrumentation scope carries producer version. A different producer version
  does not prevent ingestion. Unknown optional fields follow upstream OTLP
  handling; Beholdr does not negotiate a parallel telemetry schema.

stalkr's initial metric profile follows the published Kubernetes semantic
conventions: node conditions, node/pod CPU usage and memory working set, pod
phase, and desired/available/ready controller counts. CPU is in cores, memory
in bytes. Missing usage is omitted, never synthesized as a measured zero.
Deployment availability comes from `status.availableReplicas`, not readiness.
Node conditions and pod phases include zero-valued alternative states.

These Kubernetes conventions are not all stable upstream. Metric renames must
be documented and accompanied by a compatibility period in the query layer;
do not silently reinterpret existing names or units. Formal release-skew CI,
enrollment, authentication and tenant resolution remain tracked work (#25,
stalkr#3). No private auth client is needed for this loopback-only preview.

## Executable conformance evidence

`npm run demo:agents:check` builds the three repositories and sends telemetry
through checksum-pinned upstream Collector 0.160.0. It asserts that Beholdr
displays stalkr metrics, net-spectatr traces/runtime metrics/exception events,
and metrics/traces from a stock .NET SDK sample without NetSpectatr references.
The stock Java-agent test and production storage/query integration remain open.

The Collector receives, batches, limits memory and rotates a local JSON export.
Beholdr's demo reader uses the upstream OTLP JSON decoder (including hexadecimal
trace IDs), reads at most 8 MiB, and exposes at most 100 service groups, 200
metric names per group and 100 recent spans. It exposes exception types only.
This is an explicit local preview, not a lair implementation or durable storage.
