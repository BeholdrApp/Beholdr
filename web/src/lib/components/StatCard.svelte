<script lang="ts">
  import Icon from "./Icon.svelte";
  let {
    label,
    value,
    sub = "",
    icon = "",
    accent = false,
  }: {
    label: string;
    value: string | number;
    sub?: string;
    icon?: string;
    accent?: boolean;
  } = $props();
</script>

<div class="stat-card">
  <div class="stat-label">
    {label}{#if icon}<Icon name={icon} size={16} />{/if}
  </div>
  <div class="stat-value">{value}</div>
  {#if sub}<div class="stat-sub">{sub}</div>{/if}{#if accent}<div
      class="stat-accent"
    ></div>{/if}
</div>
