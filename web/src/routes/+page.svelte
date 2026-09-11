<script lang="ts">
  import { poll } from "$lib/poll.svelte.js";
  import type {
    Cluster,
    MetricsStatus,
    Point,
    Microservice,
  } from "$lib/types.js";
  import { fmtCpu, fmtMem, fmtTime } from "$lib/format.js";
  import StatCard from "$lib/components/StatCard.svelte";
  import TimeChart from "$lib/components/TimeChart.svelte";
  import MetricsNotice from "$lib/components/MetricsNotice.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import Pill from "$lib/components/Pill.svelte";
  const q = poll<{
    updated_at: number;
    metrics_available: boolean;
    metrics: MetricsStatus;
    cluster: Cluster;
    history: Point[];
  }>("/api/cluster", 5000);
  const workloads = poll<{ microservices: Microservice[] }>(
    "/api/microservices",
    5000,
  );
  const attention = $derived(
    (workloads.data?.microservices ?? []).filter(
      (m) => m.ready_replicas < m.desired_replicas,
    ),
  );
  const workloadUrl = (m: Microservice) =>
    `/microservices/${encodeURIComponent(m.namespace)}/${encodeURIComponent(m.name)}?kind=${encodeURIComponent(m.kind)}`;
</script>

<svelte:head><title>Overview · Beholdr</title></svelte:head>
<div class="page-heading">
  <div>
    <span class="eyebrow">The observatory / Overview</span>
    <h1>Your cluster, in focus.</h1>
    <p class="page-description">
      A clear view of your infrastructure. A shorter path to what needs you.
    </p>
  </div>
  <a class="button primary" href="/microservices"
    >Explore workloads <Icon name="arrow" size={15} /></a
  >
</div>
{#if q.error}<div class="empty-state">
    <Icon name="alert" size={28} />
    <h2>We lost the observer connection</h2>
    <p>Beholdr will reconnect automatically. {q.error}</p>
  </div>{:else if !q.data}<div class="empty-state">
    <Icon name="eye" size={30} />
    <h2>Bringing your cluster into focus</h2>
    <p>Waiting for the first observation…</p>
  </div>{:else}
  {@const c = q.data.cluster}
  <MetricsNotice metrics={q.data.metrics} />
  <div class="stats-grid">
    <StatCard
      label="Nodes ready"
      value={`${c.nodes_ready} / ${c.nodes_total}`}
      sub="Observed cluster capacity"
      icon="nodes"
      accent
    />
    <StatCard
      label="Running pods"
      value={`${c.pods_by_phase.Running ?? 0} / ${c.pods_total}`}
      sub={`${c.microservices_total} workloads across the cluster`}
      icon="workloads"
      accent
    />
    <StatCard
      label="CPU utilization"
      value={!q.data.metrics_available
        ? "Unmeasured"
        : `${c.cpu_pct}%${c.metrics_missing ? "+" : ""}`}
      sub={`${fmtCpu(c.cpu_capacity)} total capacity`}
      icon="cpu"
      accent
    />
    <StatCard
      label="Memory utilization"
      value={!q.data.metrics_available
        ? "Unmeasured"
        : `${c.mem_pct}%${c.metrics_missing ? "+" : ""}`}
      sub={`${fmtMem(c.mem_capacity)} total capacity`}
      icon="pulse"
      accent
    />
  </div>
  <div class="hero-grid">
    <section class="panel">
      <div class="panel-heading">
        <div>
          <h2>Resource pulse</h2>
          <p>CPU and memory · recent observer history</p>
        </div>
        <span class="count-label">As of {fmtTime(q.data.updated_at)}</span>
      </div>
      <div class="p-4">
        <TimeChart
          data={q.data.history}
          unit="%"
          height={240}
          lines={[
            { key: "cpu_pct", label: "CPU", color: "#c1ed83" },
            { key: "mem_pct", label: "Memory", color: "#84c9c0" },
          ]}
        />
      </div>
    </section>
    <section class="panel">
      <div class="panel-heading">
        <h2>On your radar</h2>
        <Pill
          tone={workloads.error || !workloads.data
            ? "muted"
            : attention.length
              ? "warn"
              : "ok"}
          >{workloads.error
            ? "Unavailable"
            : !workloads.data
              ? "Checking"
              : `${attention.length} to review`}</Pill
        >
      </div>
      <div class="signal-summary">
        <div class="orbit"><Icon name="eye" /></div>
        <div>
          <h2>
            {workloads.error || !workloads.data
              ? "Awaiting workload data"
              : attention.length
                ? "A closer look needed."
                : "Readiness looks good."}
          </h2>
          <p>
            {workloads.error
              ? "Workload status could not be refreshed."
              : workloads.data
                ? `${workloads.data.microservices.length - attention.length} of ${workloads.data.microservices.length} workloads meet their desired replica count.`
                : "Checking workload readiness…"}
          </p>
        </div>
      </div>
      {#each attention.slice(0, 3) as m}<a
          class="attention-row"
          href={workloadUrl(m)}
          ><span class="entity-icon"><Icon name="alert" size={17} /></span>
          <div>
            <strong>{m.name}</strong>
            <p>
              {m.namespace} · {m.ready_replicas} of {m.desired_replicas} replicas
              ready
            </p>
          </div>
          <span class="arrow"><Icon name="arrow" size={16} /></span></a
        >{/each}
      <a class="attention-row" href="/telemetry"
        ><span class="entity-icon"><Icon name="pulse" size={17} /></span>
        <div>
          <strong>Follow the request</strong>
          <p>Explore agent signals and application exceptions</p>
        </div>
        <span class="arrow"><Icon name="arrow" size={16} /></span></a
      >
    </section>
  </div>
  <div class="section-title">
    <div>
      <h2>Workload landscape</h2>
      <p>Readiness and resource use, without the noise.</p>
    </div>
    <a href="/microservices" class="text-link"
      >View all workloads <Icon name="arrow" size={15} /></a
    >
  </div>
  {#if workloads.error}<div class="empty-state">
      <p>Workload data is unavailable. Beholdr will retry automatically.</p>
    </div>{:else if workloads.data}<div class="table-wrap">
      <table>
        <thead
          ><tr
            ><th>Workload</th><th>Readiness</th><th>Namespace</th><th
              >CPU used</th
            ><th>Memory used</th><th>Replicas</th></tr
          ></thead
        ><tbody
          >{#each [...workloads.data.microservices]
            .sort((a, b) => Number(b.ready_replicas < b.desired_replicas) - Number(a.ready_replicas < a.desired_replicas))
            .slice(0, 6) as m}<tr
              ><td
                ><div class="entity-cell">
                  <span class="entity-icon"
                    ><Icon name="workloads" size={16} /></span
                  >
                  <div>
                    <a class="entity-name" href={workloadUrl(m)}>{m.name}</a>
                    <div class="entity-meta">{m.kind}</div>
                  </div>
                </div></td
              ><td
                ><Pill
                  tone={m.ready_replicas < m.desired_replicas ? "warn" : "ok"}
                  >{m.ready_replicas < m.desired_replicas
                    ? "Needs attention"
                    : m.desired_replicas === 0
                      ? "Scaled to zero"
                      : "Ready"}</Pill
                ></td
              ><td class="text-slate-400">{m.namespace}</td><td
                >{fmtCpu(m.cpu_used)}{m.metrics_missing ? "+" : ""}</td
              ><td>{fmtMem(m.mem_used)}{m.metrics_missing ? "+" : ""}</td><td
                >{m.ready_replicas}<span class="text-slate-500">
                  / {m.desired_replicas}</span
                ></td
              ></tr
            >{/each}</tbody
        >
      </table>
    </div>{/if}
{/if}
