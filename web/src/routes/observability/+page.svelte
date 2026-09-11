<script lang="ts">
  import Icon from "$lib/components/Icon.svelte";
  import { poll } from "$lib/poll.svelte.js";
  import type { IntegrationProvider, IntegrationStatus } from "$lib/types.js";
  import { fmtTime } from "$lib/format.js";

  const q = poll<IntegrationStatus>("/api/integrations", 10000);

  const title = (name: string) =>
    ({
      prometheus: "Prometheus",
      elasticsearch: "Elasticsearch",
      "otel-collector": "OpenTelemetry Collector",
    })[name] ?? name;

  const state = (provider: IntegrationProvider) => {
    if (!provider.configured)
      return {
        label: "Not configured",
        style: "text-slate-400 bg-slate-500/10 border-slate-500/30",
      };
    // Reachable and healthy are different questions: a backend that answers
    // while calling itself unhealthy must not read as green.
    if (provider.reachable && provider.degraded)
      return {
        label: "Degraded",
        style: "text-amber-300 bg-amber-500/10 border-amber-500/30",
      };
    if (provider.reachable)
      return {
        label: "Connected",
        style: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
      };
    return {
      label: "Unavailable",
      style: "text-rose-300 bg-rose-500/10 border-rose-500/30",
    };
  };
</script>

<svelte:head><title>Integrations · Beholdr</title></svelte:head>
<div class="page-heading">
  <div>
    <span class="eyebrow">Connect / Integrations</span>
    <h1>Your signals, connected.</h1>
    <p class="page-description">
      Check the providers behind your metrics and telemetry. Connection health
      stays separate from the health of your workloads.
    </p>
  </div>
  <a href="/telemetry" class="button"
    >Explore live telemetry <Icon name="arrow" size={15} /></a
  >
</div>
{#if q.error}
  <p class="mt-5 text-sm text-rose-300">
    Could not load integration status: {q.error}
  </p>
{:else if !q.data}
  <p class="mt-5 text-sm text-slate-400">Loading integrations…</p>
{:else}
  {#if q.data.providers.length > 0}<p class="mt-3 text-xs text-slate-500">
      {q.data.updated_at
        ? `Checked ${fmtTime(q.data.updated_at)}`
        : "Waiting for the first connectivity check"}
    </p>{/if}

  {#if q.data.providers.length === 0}<div class="empty-state">
      <Icon name="globe" size={34} />
      <h2>A clean slate for your connections.</h2>
      <p>
        No external providers are configured. In the demo, service-health charts
        use synthetic samples and local agent telemetry has its own dedicated
        view.
      </p>
      <a href="/telemetry" class="button primary"
        >View local agent signals <Icon name="arrow" size={15} /></a
      >
    </div>{/if}
  <div class="mt-5 grid gap-4 lg:grid-cols-3">
    {#each q.data.providers as provider}
      {@const providerState = state(provider)}
      <section class="rounded-2xl border border-white/5 bg-slate-900/60 p-5">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="font-semibold">{title(provider.name)}</h2>
            <p class="mt-1 text-xs uppercase tracking-wide text-slate-500">
              {provider.signal}
            </p>
          </div>
          <span
            class={`rounded-full border px-2.5 py-1 text-xs ${providerState.style}`}
          >
            {providerState.label}
          </span>
        </div>

        {#if provider.reachable}
          <p
            class="mt-5 text-sm {provider.degraded
              ? 'text-amber-300'
              : 'text-slate-300'}"
          >
            {provider.detail ??
              `Health check completed in ${provider.latency_ms} ms.`}
          </p>
          {#if provider.detail}
            <p class="mt-1 text-xs text-slate-500">
              Answered in {provider.latency_ms} ms.
            </p>
          {/if}
        {:else if provider.error}
          <p class="mt-5 text-sm text-rose-300">{provider.error}</p>
        {:else}
          <p class="mt-5 text-sm text-slate-400">
            Add the endpoint through Beholdr's deployment configuration.
          </p>
        {/if}

        {#if provider.tls_skip_verify}
          <p
            class="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200"
          >
            <span aria-hidden="true">&#9888;</span>
            <span>
              Certificate verification is disabled for this backend, so the
              connection is encrypted but not authenticated. Supply a CA bundle
              instead.
            </span>
          </p>
        {/if}
      </section>
    {/each}
  </div>
{/if}

<section class="mt-8 rounded-2xl border border-white/5 bg-slate-900/40 p-5">
  <h2 class="font-semibold">You stay in control</h2>
  <p class="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
    Provider checks are read-only. Beholdr does not inject agents, restart
    workloads, or change your applications. Configure external endpoints through
    your deployment configuration when you are ready to connect them.
  </p>
</section>
