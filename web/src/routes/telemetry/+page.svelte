<script lang="ts">
  import { poll } from "$lib/poll.svelte.js";
  import { fmtTime } from "$lib/format.js";
  type Service = { name: string; cluster: string; namespace: string; metric_names: string[]; spans: number; errors: number; last_seen: number };
  type Span = { service: string; name: string; trace_id: string; duration_ms: number; error: boolean; exception?: string; at: number };
  const q = poll<{enabled: boolean; ready: boolean; truncated: boolean; services: Service[]; spans: Span[]}>("/api/telemetry", 3000);
</script>

<svelte:head><title>Agent telemetry · Beholdr</title></svelte:head>
<h1 class="text-2xl font-semibold">Agent telemetry</h1>
<p class="mt-2 text-sm text-slate-400">Live delivery from stalkr and the .NET samples through the local OpenTelemetry Collector.</p>

{#if q.error}
  <p role="alert" class="mt-6 text-rose-300">Telemetry preview is unavailable: {q.error}</p>
{:else if !q.data}
  <p class="mt-6 text-slate-400">Loading telemetry…</p>
{:else if !q.data.enabled}
  <div class="mt-6 rounded-xl border border-white/10 p-5 text-slate-300">Start the agents demo to see live telemetry here. The cluster demo is available independently.</div>
{:else}
  <div class="mt-5 rounded-xl border border-white/10 bg-slate-900/60 p-4 text-sm">
    <span class={q.data.ready ? "text-emerald-300" : "text-amber-300"}>{q.data.ready ? "Receiving telemetry" : "Waiting for fresh telemetry"}</span>
    <span class="ml-2 text-slate-400">Recent local preview · synthetic cluster inputs · real sample application requests</span>
  </div>
  <div class="mt-5 grid gap-4 lg:grid-cols-2">
    {#each q.data.services as service}
      <section class="min-w-0 rounded-2xl border border-white/5 bg-slate-900/60 p-5">
        <h2 class="font-semibold text-indigo-200">{service.name}</h2>
        <p class="mt-1 text-xs text-slate-400">{service.cluster || "No cluster attribute"} · {service.namespace || "Cluster scope"}</p>
        <div class="my-4 flex gap-6 text-sm"><span>{service.metric_names.length} metric types</span><span>{service.spans} spans</span><span class={service.errors ? "text-rose-300" : "text-slate-400"}>{service.errors} errors</span></div>
        <details><summary class="cursor-pointer text-xs text-slate-400">Metric names · updated {fmtTime(service.last_seen)}</summary><ul class="mt-3 max-h-48 overflow-auto break-all text-xs text-slate-300">{#each service.metric_names as name}<li class="py-1">{name}</li>{/each}</ul></details>
      </section>
    {/each}
  </div>
  <h2 class="mb-3 mt-8 text-lg font-medium">Recent requests</h2>
  <div class="overflow-x-auto rounded-xl border border-white/10">
    <table class="w-full text-left text-sm"><thead class="bg-white/5 text-xs text-slate-400"><tr><th class="p-3">Service / request</th><th class="p-3">Duration</th><th class="p-3">Result</th><th class="p-3">Trace</th></tr></thead>
      <tbody>{#each q.data.spans.slice(0, 30) as span}<tr class="border-t border-white/5"><td class="p-3"><div>{span.name}</div><div class="text-xs text-slate-500">{span.service}</div></td><td class="whitespace-nowrap p-3 tabular-nums">{span.duration_ms.toFixed(1)} ms</td><td class="p-3"><span class={span.error ? "text-rose-300" : "text-emerald-300"}>{span.error ? "Error" : "OK"}</span>{#if span.exception}<div class="text-xs text-rose-300">{span.exception}</div>{/if}</td><td class="p-3 font-mono text-xs text-slate-400">{span.trace_id.slice(0,16)}…</td></tr>{/each}</tbody>
    </table>
  </div>
  {#if q.data.truncated}<p class="mt-3 text-xs text-slate-500">Showing a bounded recent sample. This preview does not provide persistent telemetry storage.</p>{/if}
{/if}
