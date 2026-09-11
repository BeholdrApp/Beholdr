<script lang="ts">
  import type { Snippet } from "svelte";
  let {
    tone = "muted",
    children,
  }: { tone?: "ok" | "warn" | "crit" | "muted"; children: Snippet } = $props();
</script>

<span class="status-pill {tone}"
  ><span class="dot {tone === 'ok' ? '' : tone}" aria-hidden="true"
  ></span>{@render children()}</span
>
