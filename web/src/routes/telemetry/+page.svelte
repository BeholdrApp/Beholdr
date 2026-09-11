<script lang="ts">
  import { tick } from "svelte";
  import { poll } from "$lib/poll.svelte.js";
  import { fmtTime } from "$lib/format.js";
  import Icon from "$lib/components/Icon.svelte";
  import Pill from "$lib/components/Pill.svelte";
  import StatCard from "$lib/components/StatCard.svelte";
  type Service = {
    name: string;
    cluster: string;
    namespace: string;
    metric_names: string[];
    spans: number;
    errors: number;
    last_seen: number;
  };
  type Span = {
    service: string;
    name: string;
    trace_id: string;
    duration_ms: number;
    error: boolean;
    exception?: string;
    at: number;
  };
  const q = poll<{
    enabled: boolean;
    ready: boolean;
    truncated: boolean;
    services: Service[];
    spans: Span[];
  }>("/api/telemetry", 3000);
  let search = $state(""),
    service = $state("all"),
    errorsOnly = $state(false),
    selected = $state<Span | null>(null),
    copyState = $state("");
  const spans = $derived(
    (q.data?.spans ?? []).filter(
      (s) =>
        (service === "all" || s.service === service) &&
        (!errorsOnly || s.error) &&
        `${s.name} ${s.service} ${s.trace_id} ${s.exception ?? ""}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    ),
  );
  const names = $derived([
    ...new Set(q.data?.services.map((s) => s.name) ?? []),
  ]);
  const metrics = $derived(
    new Set(q.data?.services.flatMap((s) => s.metric_names) ?? []).size,
  );
  async function copyTrace() {
    if (!selected) return;
    try {
      await navigator.clipboard.writeText(selected.trace_id);
      copyState = "Copied";
    } catch {
      copyState = "Select the trace ID below to copy";
    }
  }
  let inspector = $state<HTMLElement>();
  async function inspect(span: Span) {
    selected = span;
    copyState = "";
    await tick();
    inspector?.focus();
  }
</script>

<svelte:head><title>Live telemetry · Beholdr</title></svelte:head>
<div class="page-heading">
  <div>
    <span class="eyebrow">Observe / Live telemetry</span>
    <h1>Every signal tells a story.</h1>
    <p class="page-description">
      Follow application requests, inspect exceptions, and see what your agents
      are sending.
    </p>
  </div>
  {#if q.data?.enabled}<Pill tone={q.data.ready ? "ok" : "warn"}
      >{q.data.ready ? "Receiving signals" : "Awaiting fresh signals"}</Pill
    >{/if}
</div>
{#if q.error}<div class="empty-state">
    <Icon name="alert" size={28} />
    <h2>Telemetry is temporarily unavailable</h2>
    <p>{q.error}. Beholdr will retry automatically.</p>
  </div>{:else if !q.data}<div class="empty-state">
    <Icon name="pulse" size={28} />
    <p>Listening for telemetry…</p>
  </div>{:else if !q.data.enabled}<div class="empty-state">
    <Icon name="pulse" size={35} />
    <h2>Your signals will land here.</h2>
    <p>
      The agents demo connects stalkr and the .NET samples to this view. In the
      meantime, you can explore your cluster.
    </p>
    <a href="/" class="button primary"
      >Explore overview <Icon name="arrow" size={15} /></a
    >
  </div>{:else}
  <div class="stats-grid">
    <StatCard
      label="Reporting services"
      value={names.length}
      sub="Unique service identities"
      icon="globe"
    /><StatCard
      label="Metric types"
      value={metrics}
      sub="Across the recent sample"
      icon="pulse"
    /><StatCard
      label="Recent spans"
      value={q.data.spans.length}
      sub="Latest retained requests"
      icon="clock"
    /><StatCard
      label="Errors in sample"
      value={q.data.spans.filter((s) => s.error).length}
      sub="Failed spans in the recent sample"
      icon="alert"
    />
  </div>
  <div class="section-title">
    <h2>Signal sources</h2>
    <span class="count-label">Expand a source to see its metric names</span>
  </div>
  <div class="sources-grid">
    {#each q.data.services as source}<details class="panel source-card">
        <summary
          ><span class="entity-icon"
            ><Icon name={source.name === "stalkr" ? "nodes" : "pulse"} /></span
          >
          <div>
            <strong>{source.name}</strong>
            <p>
              {source.namespace || "Cluster scope"} · {source.cluster ||
                "No cluster attribute"}
            </p>
          </div>
          <span class="source-count"
            >{source.metric_names.length}<small>metrics</small></span
          ></summary
        >
        <div class="source-detail">
          <p class="count-label">Last sample {fmtTime(source.last_seen)}</p>
          <div class="metric-list">
            {#each source.metric_names as name}<code>{name}</code
              >{/each}{#if !source.metric_names.length}<p class="count-label">
                No metric names in this sample.
              </p>{/if}
          </div>
        </div>
      </details>{/each}
  </div>
  <div class="section-title">
    <div>
      <h2>Request explorer</h2>
      <p>Select a request to inspect its trace and exception.</p>
    </div>
    <span class="count-label">{spans.length} matching spans</span>
  </div>
  <div class="toolbar">
    <label class="search-field"
      ><Icon name="search" size={16} /><span class="sr-only"
        >Search requests</span
      ><input
        bind:value={search}
        placeholder="Search request, exception, or trace ID…"
      /></label
    ><select
      class="filter-select"
      aria-label="Filter requests by service"
      bind:value={service}
      ><option value="all">All services</option>{#each names as name}<option
          value={name}>{name}</option
        >{/each}</select
    >
    <div class="segmented">
      <button aria-pressed={!errorsOnly} onclick={() => (errorsOnly = false)}
        >All requests</button
      ><button aria-pressed={errorsOnly} onclick={() => (errorsOnly = true)}
        >Errors only</button
      >
    </div>
  </div>
  {#if selected}<section
      bind:this={inspector}
      tabindex="-1"
      class="trace-inspector"
      aria-label="Selected request"
    >
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span class="eyebrow">Request detail</span>
          <h2 class="text-lg">{selected.name}</h2>
          <p class="page-description">
            {selected.service} · {fmtTime(selected.at)} · {selected.duration_ms.toFixed(
              2,
            )} ms
          </p>
        </div>
        <button
          class="button"
          aria-label="Close request inspector"
          onclick={() => (selected = null)}
          ><Icon name="close" size={16} /></button
        >
      </div>
      <div class="mt-4 flex flex-wrap items-center gap-3">
        <Pill tone={selected.error ? "crit" : "ok"}
          >{selected.error ? "Error" : "Successful span"}</Pill
        >{#if selected.exception}<code class="text-xs text-rose-300"
            >{selected.exception}</code
          >{/if}
      </div>
      <div class="mt-5 flex flex-wrap items-center gap-3">
        <span class="count-label">Trace ID</span><code
          class="select-all text-xs">{selected.trace_id}</code
        ><button class="text-link" onclick={copyTrace}
          ><Icon name="copy" size={14} />Copy</button
        ><span class="count-label" role="status">{copyState}</span>
      </div>
    </section>{/if}
  {#if spans.length}<div class="table-wrap mt-4">
      <table>
        <thead
          ><tr
            ><th>Request / service</th><th>Duration</th><th>Outcome</th><th
              >Observed</th
            ><th>Trace ID</th></tr
          ></thead
        ><tbody
          >{#each spans.slice(0, 50) as span}<tr class="trace-row"
              ><td
                ><button
                  class="entity-name text-left"
                  onclick={() => inspect(span)}>{span.name}</button
                >
                <div class="entity-meta">{span.service}</div></td
              ><td
                ><div class="duration-cell">
                  <span>{span.duration_ms.toFixed(1)} ms</span><span
                    class="duration-bar"
                    style:width={`${Math.min(70, Math.max(3, span.duration_ms))}px`}
                  ></span>
                </div></td
              ><td
                ><Pill tone={span.error ? "crit" : "ok"}
                  >{span.error ? "Error" : "OK"}</Pill
                >{#if span.exception}<p class="entity-meta text-rose-300">
                    {span.exception.split(".").at(-1)}
                  </p>{/if}</td
              ><td class="text-slate-400">{fmtTime(span.at)}</td><td
                ><button
                  class="font-mono text-[10px] text-slate-400 hover:text-brand-400"
                  onclick={() => inspect(span)}
                  aria-label={`Inspect trace ${span.trace_id}`}
                  >{span.trace_id.slice(0, 12)}…</button
                ></td
              ></tr
            >{/each}</tbody
        >
      </table>
    </div>
    <p class="mt-4 count-label">
      Showing {Math.min(spans.length, 50)} of {spans.length} matching spans. Counts
      describe the recent local sample, not lifetime totals.
    </p>{:else}<div class="empty-state">
      <Icon name="search" size={28} />
      <h2>No requests match</h2>
      <p>
        Try another service or search term. New telemetry appears automatically.
      </p>
      <button
        class="button"
        onclick={() => {
          search = "";
          service = "all";
          errorsOnly = false;
        }}>Clear filters</button
      >
    </div>{/if}
  {#if q.data.truncated}<p class="mt-4 count-label">
      This preview keeps a bounded recent sample. Persistent telemetry storage
      is not configured.
    </p>{/if}
{/if}

<style>
  .sources-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }
  .source-card summary {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 18px;
    list-style: none;
  }
  .source-card summary::-webkit-details-marker {
    display: none;
  }
  .source-card summary > div {
    min-width: 0;
    flex: 1;
  }
  .source-card strong {
    font-size: 12px;
    font-weight: 550;
    overflow-wrap: anywhere;
  }
  .source-card p {
    font-size: 10px;
    color: #98a98a;
    margin-top: 5px;
  }
  .source-count {
    font-size: 21px;
    text-align: right;
    color: #cee5b6;
    font-variant-numeric: tabular-nums;
  }
  .source-count small {
    display: block;
    font-size: 9px;
    font-weight: 400;
    color: #8ea27b;
  }
  .source-detail {
    border-top: 1px solid #ffffff09;
    padding: 16px 18px;
  }
  .metric-list {
    max-height: 190px;
    overflow: auto;
    margin-top: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .metric-list code {
    font-size: 10px;
    color: #afc29c;
    overflow-wrap: anywhere;
  }
  .duration-cell {
    display: flex;
    align-items: center;
    gap: 10px;
    white-space: nowrap;
  }
  .duration-bar {
    display: inline-block;
    background: #b9ed7638;
    height: 4px;
    border-radius: 2px;
  }
  @media (max-width: 1000px) {
    .sources-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
