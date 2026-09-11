<script lang="ts">
  import "../app.css";

  import { page } from "$app/stores";

  import Sidebar from "$lib/components/Sidebar.svelte";

  import HealthBanner from "$lib/components/HealthBanner.svelte";

  import Icon from "$lib/components/Icon.svelte";

  import CommandSearch from "$lib/components/CommandSearch.svelte";

  import { poll } from "$lib/poll.svelte.js";

  import type { Health } from "$lib/types.js";

  let { children } = $props();

  let navOpen = $state(false),
    searchOpen = $state(false);
  let menuButton = $state<HTMLButtonElement>();

  const health = poll<Health>("/api/health", 10000);

  const sections: Record<string, string> = {
    microservices: "Workloads",
    nodes: "Nodes",
    telemetry: "Live telemetry",
    observability: "Integrations",
  };

  const section = $derived(
    sections[$page.url.pathname.split("/")[1]] ?? "Overview",
  );
</script>

<svelte:head><meta name="theme-color" content="#151a13" /></svelte:head>

<svelte:window
  onkeydown={(event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      searchOpen = !searchOpen;
    }
    if (event.key === "Escape" && navOpen) {
      navOpen = false;
      menuButton?.focus();
    }
  }}
/>

<a class="skip-link" href="#main-content">Skip to content</a>

<div class="app-shell">
  <Sidebar bind:open={navOpen} demo={health.data?.demo} />
  <div class="app-body">
    <header class="app-topbar">
      <button
        class="mobile-menu"
        bind:this={menuButton}
        aria-controls="primary-sidebar"
        aria-label="Open navigation"
        aria-expanded={navOpen}
        onclick={() => (navOpen = !navOpen)}
        ><Icon name="menu" size={21} /></button
      >
      <div class="breadcrumb">
        <span>Workspace</span><Icon name="chevron" size={11} /><span
          >{section}</span
        >
      </div>
      <div class="topbar-tools">
        <button
          class="search-trigger"
          onclick={() => (searchOpen = true)}
          aria-label="Search workloads, nodes and pages"
          ><Icon name="search" size={15} /><span>Find anything…</span><kbd
            >Ctrl K</kbd
          ></button
        >
        <div class="topbar-status">
          <span class="dot" class:warn={!health.data?.ready || !!health.error}
          ></span>{health.error
            ? "Connection lost"
            : health.data?.ready
              ? "Observer connected"
              : "Connecting"}
        </div>
      </div>
    </header>
    <main id="main-content" class="app-content" tabindex="-1">
      <HealthBanner />{@render children()}
    </main>
  </div>
</div>
<CommandSearch bind:open={searchOpen} />
