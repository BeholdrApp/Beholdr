<script lang="ts">
  import { page } from "$app/stores";
  import { poll } from "$lib/poll.svelte.js";
  import type { MetricsStatus, Microservice } from "$lib/types.js";
  import { fmtCpu, fmtMem } from "$lib/format.js";
  import Pill from "$lib/components/Pill.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import MetricsNotice from "$lib/components/MetricsNotice.svelte";
  const q = poll<{
    updated_at: number;
    metrics: MetricsStatus;
    microservices: Microservice[];
  }>("/api/microservices", 5000);
  let filter = $state(""),
    namespace = $state("all"),
    statusFilter = $state("all"),
    sort = $state("attention");
  $effect(() => {
    namespace = $page.url.searchParams.get("namespace") ?? "all";
    statusFilter =
      $page.url.searchParams.get("attention") === "1" ? "attention" : "all";
  });
  const all = $derived(q.data?.microservices ?? []);
  const namespaces = $derived([...new Set(all.map((m) => m.namespace))].sort());
  const needsAttention = (m: Microservice) =>
    m.ready_replicas < m.desired_replicas;
  const rows = $derived(
    all
      .filter(
        (m) =>
          `${m.name} ${m.namespace} ${m.kind}`
            .toLowerCase()
            .includes(filter.trim().toLowerCase()) &&
          (namespace === "all" || m.namespace === namespace) &&
          (statusFilter !== "attention" || needsAttention(m)),
      )
      .sort((a, b) =>
        sort === "cpu"
          ? b.cpu_used - a.cpu_used
          : sort === "name"
            ? a.name.localeCompare(b.name)
            : Number(needsAttention(b)) - Number(needsAttention(a)) ||
              a.name.localeCompare(b.name),
      ),
  );
  const reset = () => {
    filter = "";
    namespace = "all";
    statusFilter = "all";
    sort = "attention";
  };
</script>

<svelte:head><title>Workloads · Beholdr</title></svelte:head>
<div class="page-heading">
  <div>
    <span class="eyebrow">Observe / Workloads</span>
    <h1>Every service. One view.</h1>
    <p class="page-description">
      Find a workload, spot a readiness gap, and follow it down to the pod.
    </p>
  </div>
  <span class="count-label">{all.length} observed workloads</span>
</div>
{#if q.error}<div class="empty-state">
    <Icon name="alert" size={27} />
    <h2>Workloads are temporarily unavailable</h2>
    <p>{q.error}. The observer will retry automatically.</p>
  </div>{:else if !q.data}<div class="empty-state">
    <Icon name="workloads" size={28} />
    <p>Discovering your workloads…</p>
  </div>{:else}
  <div class="segmented" aria-label="Workload readiness filter">
    <button
      aria-pressed={statusFilter === "all"}
      onclick={() => (statusFilter = "all")}
      >All workloads <span class="ml-2 opacity-60">{all.length}</span></button
    ><button
      aria-pressed={statusFilter === "attention"}
      onclick={() => (statusFilter = "attention")}
      >Needs attention <span class="ml-2 opacity-60"
        >{all.filter(needsAttention).length}</span
      ></button
    >
  </div>
  <MetricsNotice metrics={q.data.metrics} scope="workloads" />
  <div class="toolbar">
    <label class="search-field"
      ><Icon name="search" size={16} /><span class="sr-only"
        >Search workloads</span
      ><input
        bind:value={filter}
        placeholder="Search name, namespace, or kind…"
      /></label
    ><select class="filter-select" aria-label="Namespace" bind:value={namespace}
      ><option value="all">All namespaces</option
      >{#each namespaces as ns}<option value={ns}>{ns}</option>{/each}</select
    ><select class="filter-select" aria-label="Sort workloads" bind:value={sort}
      ><option value="attention">Attention first</option><option value="name"
        >Name A–Z</option
      ><option value="cpu">Highest CPU</option></select
    >
  </div>
  {#if rows.length}<div class="table-wrap">
      <table>
        <thead
          ><tr
            ><th>Workload</th><th>Readiness</th><th>Namespace</th><th
              >Replicas</th
            ><th>CPU used</th><th>Memory used</th><th>Scaling</th><th
              >Restarts</th
            ></tr
          ></thead
        ><tbody
          >{#each rows as m (m.key)}<tr
              ><td
                ><div class="entity-cell">
                  <span class="entity-icon"
                    ><Icon name="workloads" size={16} /></span
                  >
                  <div>
                    <a
                      class="entity-name"
                      href="/microservices/{encodeURIComponent(
                        m.namespace,
                      )}/{encodeURIComponent(m.name)}?kind={encodeURIComponent(
                        m.kind,
                      )}">{m.name}</a
                    >
                    <div class="entity-meta">
                      {m.kind} · {m.nodes.length} nodes
                    </div>
                  </div>
                </div></td
              ><td
                ><Pill tone={needsAttention(m) ? "warn" : "ok"}
                  >{needsAttention(m)
                    ? "Needs attention"
                    : m.desired_replicas === 0
                      ? "Scaled to zero"
                      : "Ready"}</Pill
                ></td
              ><td class="text-slate-400">{m.namespace}</td><td
                >{m.ready_replicas}<span class="text-slate-500">
                  / {m.desired_replicas}</span
                ></td
              ><td
                title={m.metrics_missing
                  ? "Incomplete usage; some pods have no sample"
                  : ""}
                >{fmtCpu(m.cpu_used)}{m.metrics_missing ? "+" : ""}
                <div class="entity-meta">
                  {!m.metrics_missing && m.cpu_util_pct !== null
                    ? `${m.cpu_util_pct}% of requests`
                    : ""}
                </div></td
              ><td>{fmtMem(m.mem_used)}{m.metrics_missing ? "+" : ""}</td><td
                class="text-slate-400"
                >{m.hpa ? `Auto · ${m.hpa.min}–${m.hpa.max}` : "Fixed"}</td
              ><td
                >{#if m.restarts}<Pill tone="warn">{m.restarts}</Pill
                  >{:else}<span class="text-slate-500">0</span>{/if}</td
              ></tr
            >{/each}</tbody
        >
      </table>
    </div>
    <div class="mt-4 flex justify-between">
      <span class="count-label"
        >Showing {rows.length} of {all.length} workloads</span
      ><span class="count-label">Select a workload to investigate →</span>
    </div>{:else}<div class="empty-state">
      <Icon name="search" size={28} />
      <h2>No workloads match</h2>
      <p>
        Try another name or namespace, or clear the filters to see everything.
      </p>
      <button class="button" onclick={reset}>Clear filters</button>
    </div>{/if}
{/if}
