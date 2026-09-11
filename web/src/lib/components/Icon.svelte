<script lang="ts">
  let { name, size = 18 }: { name: string; size?: number } = $props();
  const paths: Record<string, string> = {
    eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
    overview: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
    nodes:
      "M4 3h16v7H4z M4 14h16v7H4z M7 6.5h.01 M7 17.5h.01 M15 6.5h2 M15 17.5h2",
    workloads: "m12 3 9 5-9 5-9-5 9-5Z M3 12l9 5 9-5 M3 16l9 5 9-5",
    pulse: "M2 12h5l3-8 4 16 3-8h5",
    search: "M16 16l5 5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
    arrow: "M5 12h14 M13 6l6 6-6 6",
    chevron: "m9 5 7 7-7 7",
    globe:
      "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z M3 12h18 M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z",
    settings: "M4 7h16 M4 17h16 M8 4v6 M16 14v6",
    close: "m6 6 12 12 M6 18 18 6",
    menu: "M4 6h16 M4 12h16 M4 18h16",
    alert: "m12 3 10 18H2L12 3Z M12 9v5 M12 17h.01",
    check: "m5 12 4 4L19 6",
    clock: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z M12 7v5l3 2",
    cpu: "M6 6h12v12H6z M9 9h6v6H9z M9 2v4 M15 2v4 M9 18v4 M15 18v4 M2 9h4 M2 15h4 M18 9h4 M18 15h4",
    copy: "M8 8h12v12H8z M16 8V4H4v12h4",
  };
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.6"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"><path d={paths[name] ?? paths.eye} /></svg
>
