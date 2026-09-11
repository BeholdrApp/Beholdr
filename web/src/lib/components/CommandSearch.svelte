<script lang="ts">
  import Icon from "./Icon.svelte";
  import type { Microservice, NodeInfo } from "$lib/types.js";
  let { open = $bindable(false) }: { open?: boolean } = $props();
  let dialog: HTMLDialogElement, input: HTMLInputElement;
  let query = $state(""),
    loading = $state(false),
    failed = $state(false);
  type Result = { name: string; detail: string; href: string; icon: string };
  let entities = $state<Result[]>([]);
  const pages: Result[] = [
    {
      name: "Overview",
      detail: "Cluster health at a glance",
      href: "/",
      icon: "overview",
    },
    {
      name: "Workloads",
      detail: "Find a service or investigate a workload",
      href: "/microservices",
      icon: "workloads",
    },
    {
      name: "Nodes",
      detail: "Cluster capacity and distribution",
      href: "/nodes",
      icon: "nodes",
    },
    {
      name: "Live telemetry",
      detail: "Metrics, requests and exceptions",
      href: "/telemetry",
      icon: "pulse",
    },
    {
      name: "Integrations",
      detail: "Telemetry provider connections",
      href: "/observability",
      icon: "settings",
    },
  ];
  const results = $derived(
    [...pages, ...entities]
      .filter((x) =>
        `${x.name} ${x.detail}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
      )
      .slice(0, 12),
  );
  $effect(() => {
    if (open) {
      dialog?.showModal();
      query = "";
      input?.focus();
      loading = true;
      failed = false;
      entities = [];
      const controller = new AbortController();
      Promise.all([
        fetch("/api/microservices", { signal: controller.signal }),
        fetch("/api/nodes", { signal: controller.signal }),
      ])
        .then(async (responses) => {
          if (responses.some((r) => !r.ok)) throw Error("unavailable");
          const [workloads, nodes] = await Promise.all(
            responses.map((r) => r.json()),
          );
          if (controller.signal.aborted) return;
          entities = [
            ...workloads.microservices.map((m: Microservice) => ({
              name: m.name,
              detail: `${m.namespace} · ${m.kind}`,
              href: `/microservices/${encodeURIComponent(m.namespace)}/${encodeURIComponent(m.name)}?kind=${encodeURIComponent(m.kind)}`,
              icon: "workloads",
            })),
            ...nodes.nodes.map((n: NodeInfo) => ({
              name: n.name,
              detail: "Cluster node",
              href: `/nodes/${encodeURIComponent(n.name)}`,
              icon: "nodes",
            })),
          ];
        })
        .catch(() => {
          if (!controller.signal.aborted) failed = true;
        })
        .finally(() => {
          if (!controller.signal.aborted) loading = false;
        });
      return () => controller.abort();
    } else {
      dialog?.close();
    }
  });
</script>

<dialog
  bind:this={dialog}
  onclose={() => (open = false)}
  aria-labelledby="search-title"
>
  <div class="search-head">
    <Icon name="search" size={21} /><label
      class="sr-only"
      id="search-title"
      for="global-search">Search Beholdr</label
    ><input
      id="global-search"
      bind:this={input}
      bind:value={query}
      placeholder="Search workloads, nodes, or pages…"
      autocomplete="off"
    /><button aria-label="Close search" onclick={() => (open = false)}
      ><kbd>Esc</kbd></button
    >
  </div>
  <div class="search-results">
    <div class="result-label">
      {query ? "Search results" : "Jump to"}{#if loading}<span
          >Loading entities…</span
        >{/if}
    </div>
    {#each results as result}<a
        href={result.href}
        onclick={() => (open = false)}
        ><span class="entity-icon"><Icon name={result.icon} /></span>
        <div>
          <strong>{result.name}</strong>
          <p>{result.detail}</p>
        </div>
        <Icon name="arrow" size={14} /></a
      >{/each}{#if !results.length}<p class="no-results">
        No matches for “{query}”. Try a service name or namespace.
      </p>{/if}{#if failed}<p class="no-results">
        Entity search is unavailable. You can still navigate to a page.
      </p>{/if}
  </div>
  <footer>
    <span>Find your next investigation</span><kbd>Tab</kbd> to move
    <kbd>Enter</kbd> to open
  </footer>
</dialog>

<style>
  dialog {
    background: #1b2217;
    color: #eff3e8;
    border: 1px solid #c1ed8330;
    border-radius: 14px;
    width: min(580px, calc(100% - 32px));
    margin: 12vh auto auto;
    padding: 0;
    box-shadow: 0 30px 120px #0009;
  }
  dialog::backdrop {
    background: #080c08aa;
    backdrop-filter: blur(7px);
  }
  .search-head {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 22px;
    border-bottom: 1px solid #ffffff0c;
    color: #b7cb9e;
  }
  .search-head input {
    background: none;
    border: 0;
    outline: 0;
    flex: 1;
    font-size: 14px;
    color: #eff3e8;
    min-width: 0;
  }
  .search-head input::placeholder {
    color: #8a9a7c;
  }
  .search-results {
    padding: 12px;
    max-height: 55vh;
    overflow: auto;
  }
  .result-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #95a784;
    padding: 6px 10px 12px;
    display: flex;
    justify-content: space-between;
  }
  .result-label span {
    font-size: 9px;
    text-transform: none;
    letter-spacing: 0;
  }
  a {
    padding: 10px;
    border-radius: 7px;
    display: flex;
    gap: 12px;
    align-items: center;
  }
  a:hover,
  a:focus {
    background: #c1ed8310;
  }
  a > div {
    flex: 1;
  }
  strong {
    font-size: 12px;
    font-weight: 500;
  }
  p {
    font-size: 10px;
    color: #93a580;
    margin-top: 4px;
  }
  .no-results {
    padding: 20px 10px;
    font-size: 12px;
    line-height: 1.8;
  }
  footer {
    padding: 14px 22px;
    border-top: 1px solid #ffffff0a;
    font-size: 10px;
    display: flex;
    align-items: center;
    gap: 7px;
    color: #9cac8c;
  }
  footer span {
    margin-right: auto;
  }
  @media (max-width: 480px) {
    footer span {
      display: none;
    }
    .search-head {
      padding: 18px;
    }
    .search-head input {
      font-size: 12px;
    }
  }
</style>
