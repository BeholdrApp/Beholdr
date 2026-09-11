<script lang="ts">
  import { poll } from "$lib/poll.svelte.js";
  import type { MetricsStatus, NodeInfo } from "$lib/types.js";
  import { fmtMem, fmtCpu } from "$lib/format.js";
  import UsageBar from "$lib/components/UsageBar.svelte";
  import Pill from "$lib/components/Pill.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import MetricsNotice from "$lib/components/MetricsNotice.svelte";
  const q = poll<{
    updated_at: number;
    metrics: MetricsStatus;
    nodes: NodeInfo[];
  }>("/api/nodes", 5000);
  let search = $state("");
  const nodes = $derived(
    (q.data?.nodes ?? []).filter((n) =>
      `${n.name} ${n.roles.join(" ")}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    ),
  );
</script>

<svelte:head><title>Nodes · Beholdr</title></svelte:head>
<div class="page-heading">
  <div>
    <span class="eyebrow">Observe / Nodes</span>
    <h1>The ground beneath your services.</h1>
    <p class="page-description">
      See how your cluster is distributed and where there is room to grow.
    </p>
  </div>
</div>
{#if q.error}<div class="empty-state">
    <Icon name="alert" size={28} />
    <h2>Node data is unavailable</h2>
    <p>{q.error}. Beholdr is retrying.</p>
  </div>{:else if !q.data}<div class="empty-state">
    <p>Discovering nodes…</p>
  </div>{:else}
  <MetricsNotice metrics={q.data.metrics} scope="nodes" />
  <div class="toolbar">
    <label class="search-field"
      ><Icon name="search" size={16} /><span class="sr-only">Search nodes</span
      ><input
        bind:value={search}
        placeholder="Find a node by name or role…"
      /></label
    ><span class="count-label"
      >{nodes.length} nodes · {q.data.nodes.filter((n) => n.ready).length} ready</span
    >
  </div>
  <div class="node-grid">
    {#each nodes as n}<section class="panel node-card">
        <div class="node-top">
          <span class="entity-icon"><Icon name="nodes" /></span>
          <div>
            <h2>
              <a class="entity-name" href="/nodes/{encodeURIComponent(n.name)}"
                >{n.name}</a
              >
            </h2>
            <div class="entity-meta">{n.roles.join(" · ")}</div>
          </div>
          <Pill tone={n.ready ? "ok" : "crit"}
            >{n.ready ? "Ready" : "Not ready"}</Pill
          >
        </div>
        <div class="node-measure">
          <span>CPU</span><span
            >{n.metrics_missing ? "Unmeasured" : `${n.cpu_pct}%`}</span
          >
        </div>
        {#if !n.metrics_missing}<UsageBar pct={n.cpu_pct} />{/if}
        <p class="entity-meta">
          {n.metrics_missing
            ? "Waiting for a usage sample"
            : `${fmtCpu(n.cpu_used)} of ${fmtCpu(n.cpu_capacity)}`}
        </p>
        <div class="node-measure">
          <span>Memory</span><span
            >{n.metrics_missing ? "Unmeasured" : `${n.mem_pct}%`}</span
          >
        </div>
        {#if !n.metrics_missing}<UsageBar pct={n.mem_pct} />{/if}
        <p class="entity-meta">
          {n.metrics_missing
            ? "Waiting for a usage sample"
            : `${fmtMem(n.mem_used)} of ${fmtMem(n.mem_capacity)}`}
        </p>
        <div class="node-footer">
          <span>{n.pod_count} pods · {n.workloads.length} workloads</span><a
            class="text-link"
            href="/nodes/{encodeURIComponent(n.name)}"
            aria-label={`Inspect ${n.name}`}><Icon name="arrow" size={16} /></a
          >
        </div>
      </section>{/each}
  </div>
  {#if !nodes.length}<div class="empty-state">
      <Icon name="search" size={28} />
      <h2>No nodes found</h2>
      <p>Try a different name or clear your search.</p>
      <button class="button" onclick={() => (search = "")}>Clear search</button>
    </div>{/if}
{/if}
