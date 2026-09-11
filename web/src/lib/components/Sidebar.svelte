<script lang="ts">
  import { page } from "$app/stores";
  import Icon from "./Icon.svelte";
  let sidebar = $state<HTMLElement>();
  let {
    open = $bindable(false),
    demo = false,
  }: { open?: boolean; demo?: boolean } = $props();
  const links = [
    { href: "/", label: "Overview", icon: "overview", hint: "01" },
    {
      href: "/microservices",
      label: "Workloads",
      icon: "workloads",
      hint: "02",
    },
    { href: "/nodes", label: "Nodes", icon: "nodes", hint: "03" },
    { href: "/telemetry", label: "Live telemetry", icon: "pulse", hint: "04" },
  ];
  const active = (href: string) =>
    href === "/"
      ? $page.url.pathname === "/"
      : $page.url.pathname.startsWith(href);
  $effect(() => {
    if (open) sidebar?.querySelector<HTMLAnchorElement>("nav a")?.focus();
  });
</script>

{#if open}<button
    class="nav-backdrop"
    aria-label="Close navigation"
    onclick={() => (open = false)}
  ></button>{/if}
<aside bind:this={sidebar} class:expanded={open} id="primary-sidebar">
  <a
    class="wordmark"
    href="/"
    onclick={() => (open = false)}
    aria-label="Beholdr overview"
    ><span class="brand-eye"><Icon name="eye" size={27} /></span>beholdr<span
      class="wordmark-dot">.</span
    ></a
  >
  <div class="workspace">
    <div class="workspace-icon"><Icon name="globe" size={17} /></div>
    <div>
      <strong>{demo ? "Local observatory" : "Your observatory"}</strong><span
        >{demo ? "Demo workspace" : "Cluster workspace"}</span
      >
    </div>
    <small>{demo ? "DEMO" : "LIVE"}</small>
  </div>
  <div class="nav-label">Observe</div>
  <nav aria-label="Main navigation">
    {#each links as link}<a
        href={link.href}
        class:active={active(link.href)}
        aria-current={active(link.href) ? "page" : undefined}
        onclick={() => (open = false)}
        ><Icon name={link.icon} /><span>{link.label}</span><small
          >{link.hint}</small
        ></a
      >{/each}
  </nav>
  <div class="nav-label second">Connect</div>
  <nav aria-label="Connections">
    <a
      href="/observability"
      class:active={active("/observability")}
      aria-current={active("/observability") ? "page" : undefined}
      onclick={() => (open = false)}
      ><Icon name="settings" /><span>Integrations</span></a
    >
  </nav>
  <div class="sidebar-bottom">
    <div class="observatory-note">
      <span class="tiny-eye"><Icon name="eye" size={19} /></span><strong
        >See the whole picture.</strong
      >
      <p>From cluster health to the requests that matter.</p>
      <a href="/telemetry" onclick={() => (open = false)}
        >Explore telemetry <Icon name="arrow" size={14} /></a
      >
    </div>
    <div class="sidebar-footer">
      <span class="dot"></span> Beholdr <span>Developer preview</span>
    </div>
  </div>
</aside>

<style>
  aside {
    width: 236px;
    flex-shrink: 0;
    background: #151a13;
    border-right: 1px solid #ffffff0c;
    padding: 32px 18px 22px;
    position: sticky;
    top: 0;
    height: 100dvh;
    display: flex;
    flex-direction: column;
    z-index: 30;
  }
  .wordmark {
    font-size: 26px;
    font-weight: 650;
    letter-spacing: -1.3px;
    display: flex;
    align-items: center;
    padding: 0 10px;
    gap: 8px;
  }
  .wordmark-dot {
    color: #c1ed83;
    margin-left: -9px;
  }
  .brand-eye {
    color: #c1ed83;
    display: grid;
    place-items: center;
    margin-right: 1px;
  }
  .workspace {
    margin: 35px 0 29px;
    display: flex;
    gap: 9px;
    align-items: center;
    padding: 12px 9px;
    border: 1px solid #ffffff10;
    border-radius: 8px;
    background: #1d231a;
  }
  .workspace-icon {
    width: 30px;
    height: 30px;
    background: #c1ed830d;
    border-radius: 6px;
    display: grid;
    place-items: center;
    color: #b5c4a4;
  }
  .workspace strong {
    font-size: 11px;
    font-weight: 550;
    display: block;
  }
  .workspace span {
    font-size: 10px;
    color: #8e9b81;
    display: block;
    margin-top: 3px;
  }
  .workspace small {
    font-size: 8px;
    color: #a5b492;
    margin-left: auto;
    border: 1px solid #a5b49226;
    padding: 3px;
    border-radius: 3px;
  }
  .nav-label {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: #8e9d82;
    padding: 0 12px;
    margin-bottom: 12px;
  }
  .second {
    margin-top: 30px;
  }
  nav {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  nav a {
    display: flex;
    align-items: center;
    gap: 11px;
    font-size: 12px;
    color: #a9b79d;
    padding: 12px;
    border-radius: 6px;
    position: relative;
  }
  nav a:hover {
    background: #ffffff04;
    color: #eef5e4;
  }
  nav a.active {
    background: #c1ed8310;
    color: #d0efa9;
  }
  nav a.active:before {
    content: "";
    position: absolute;
    left: -18px;
    height: 20px;
    width: 3px;
    background: #c1ed83;
    border-radius: 0 3px 3px 0;
  }
  nav small {
    margin-left: auto;
    font-size: 9px;
    color: #829174;
    font-family: ui-monospace, monospace;
  }
  nav a.active small {
    color: #9cb780;
  }
  .sidebar-bottom {
    margin-top: auto;
    padding-top: 30px;
  }
  .observatory-note {
    border: 1px solid #c1ed8310;
    background: radial-gradient(ellipse at 0 0, #c1ed830e, transparent);
    border-radius: 9px;
    padding: 17px 13px;
  }
  .tiny-eye {
    color: #c1ed83;
  }
  .observatory-note strong {
    font-size: 11px;
    display: block;
    margin-top: 10px;
    font-weight: 550;
  }
  .observatory-note p {
    font-size: 10px;
    color: #96a38a;
    line-height: 1.8;
    margin-top: 6px;
  }
  .observatory-note a {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 10px;
    color: #c1dbaa;
    margin-top: 17px;
  }
  .sidebar-footer {
    display: flex;
    align-items: center;
    gap: 7px;
    margin-top: 21px;
    font-size: 10px;
    color: #a6b397;
  }
  .sidebar-footer span:last-child {
    font-size: 9px;
    margin-left: auto;
    color: #8b997f;
  }
  .nav-backdrop {
    display: none;
  }
  @media (max-width: 1000px) and (min-width: 681px) {
    aside {
      width: 196px;
      padding-left: 14px;
      padding-right: 14px;
    }
    .workspace small {
      display: none;
    }
    .wordmark {
      font-size: 24px;
    }
    .sidebar-footer span:last-child {
      display: none;
    }
    nav a.active:before {
      left: -14px;
    }
  }
  @media (max-width: 680px) {
    aside {
      position: fixed;
      left: 0;
      transform: translateX(-100%);
      visibility: hidden;
      transition: transform 0.2s;
      width: 236px;
    }
    .expanded {
      transform: none;
      visibility: visible;
    }
    .nav-backdrop {
      display: block;
      position: fixed;
      inset: 0;
      background: #0009;
      z-index: 29;
      backdrop-filter: blur(3px);
    }
  }
</style>
