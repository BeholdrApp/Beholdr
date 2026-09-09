<script lang="ts">
  // Explains why usage numbers are absent, distinguishing the two cases the
  // old single boolean collapsed into one: metrics.k8s.io did not answer at
  // all, versus it answered without a sample for every object. Both render
  // usage as 0, so without this the UI silently reports an idle cluster.
  import type { MetricsStatus } from "$lib/types.js";

  let { metrics, scope = "cluster" }: {
    metrics: MetricsStatus | undefined;
    /** Which objects this page shows, so the notice names the right ones. */
    scope?: "cluster" | "nodes" | "workloads";
  } = $props();

  const unavailable = $derived(
    !!metrics && (!metrics.nodes_available || !metrics.pods_available)
  );
  // Only count the gaps this page actually renders: a nodes table is not made
  // wrong by pods missing samples.
  const missing = $derived(
    !metrics ? 0
      : scope === "nodes" ? metrics.nodes_missing
      : scope === "workloads" ? metrics.pods_missing
      : metrics.nodes_missing + metrics.pods_missing
  );
  const partial = $derived(!unavailable && missing > 0);

  const which = $derived(
    !metrics ? ""
      : !metrics.nodes_available && !metrics.pods_available ? "Node and pod"
      : !metrics.nodes_available ? "Node"
      : "Pod"
  );
</script>

{#if unavailable}
  <div class="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-300">
    <div class="font-medium">
      {which} usage metrics are unavailable — CPU and memory are unmeasured, not zero.
    </div>
    <div class="mt-0.5 text-amber-400/80">
      Check that metrics-server is installed and healthy. Beholdr retries every
      collection and recovers on its own.
    </div>
    {#if metrics?.error}
      <div class="mt-1 font-mono text-[11px] text-amber-400/70">{metrics.error}</div>
    {/if}
  </div>
{:else if partial}
  <div class="mt-4 rounded-lg border border-slate-500/40 bg-slate-500/10 px-4 py-2.5 text-sm text-slate-300">
    Partial data — {missing}
    {scope === "nodes" ? (missing === 1 ? "node has" : "nodes have")
      : scope === "workloads" ? (missing === 1 ? "pod has" : "pods have")
      : (missing === 1 ? "object has" : "objects have")}
    no usage sample yet. Totals below are an undercount.
  </div>
{/if}
