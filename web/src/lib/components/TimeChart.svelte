<script lang="ts">
  import type { Point } from "$lib/types.js";
  import { fmtTime, fmtTimeWithDate } from "$lib/format.js";
  import {
    areaPath,
    linePath,
    makeXScale,
    maxValue,
    spansMultipleDays,
    timeExtent,
  } from "$lib/chartMath.js";
  type Line = { key: string; label: string; color: string };
  let {
    data = [],
    lines,
    unit = "",
    height = 220,
  }: {
    data: Point[];
    lines: Line[];
    unit?: string;
    height?: number;
  } = $props();
  const id = $props.id();
  let chartWidth = $state(856);
  // Match the SVG coordinate space to its content width so axis text stays
  // readable on phones and in multi-column chart layouts.
  const W = $derived(Math.max(160, chartWidth - 36));
  const padL = 42,
    padR = 14,
    padT = 15,
    padB = 16;
  let sampleIndex = $state(-1);
  const maxY = $derived.by(() => {
    const m = maxValue(
      data,
      lines.map((l) => l.key),
    );
    return unit === "%" ? Math.max(100, m * 1.15) : m <= 0 ? 1 : m * 1.15;
  });
  const { minT, maxT } = $derived(timeExtent(data));
  const x = $derived(makeXScale(minT, maxT, padL, W - padR));
  const y = (v: number) => padT + (1 - v / maxY) * (height - padT - padB);
  const fmtAxisTime = $derived(
    spansMultipleDays(minT, maxT) ? fmtTimeWithDate : fmtTime,
  );
  const ticks = $derived([0, 0.25, 0.5, 0.75, 1].map((f) => f * maxY));
  const fmtY = (v: number) =>
    unit === "%"
      ? `${Math.round(v)}%`
      : v >= 1000
        ? `${(v / 1000).toFixed(1)}k`
        : `${Number(v.toFixed(maxY < 10 ? 1 : 0))}`;
  const color = (c: string) =>
    ({ "#818cf8": "#c1ed83", "#10b981": "#84c9c0", "#f59e0b": "#eac082" })[c] ??
    c;
  const index = $derived(
    sampleIndex < 0 ? data.length - 1 : Math.min(sampleIndex, data.length - 1),
  );
  const point = $derived(data[index]);
  function inspect(event: PointerEvent) {
    const bounds = (
      event.currentTarget as SVGSVGElement
    ).getBoundingClientRect();
    const at =
      minT +
      Math.max(
        0,
        Math.min(
          1,
          (((event.clientX - bounds.left) / bounds.width) * W - padL) /
            (W - padR - padL),
        ),
      ) *
        (maxT - minT);
    let best = 0;
    for (let i = 1; i < data.length; i++)
      if (Math.abs(data[i].t - at) < Math.abs(data[best].t - at)) best = i;
    sampleIndex = best;
  }
</script>

<div class="chart-card" bind:clientWidth={chartWidth}>
  <div class="chart-legend">
    {#each lines as l}<span
        ><span class="legend-mark" style:background={color(l.color)}
        ></span>{l.label}</span
      >{/each}<span class="ml-auto text-slate-500">{data.length} samples</span>
  </div>
  {#if !data.length}<div
      class="flex items-center justify-center text-xs text-slate-400"
      style:height={`${height}px`}
    >
      History will appear after the next observation.
    </div>{:else}
    <svg
      role="img"
      aria-label={`${lines.map((l) => l.label).join(" and ")} over time. Use the sample slider below to inspect values.`}
      viewBox="0 0 {W} {height}"
      class="w-full"
      style:height={`${height}px`}
      preserveAspectRatio="none"
      onpointermove={inspect}
      onpointerleave={() => (sampleIndex = -1)}
    >
      <defs
        >{#each lines as l, i}<linearGradient
            id={`${id}-gradient-${i}`}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
            ><stop
              offset="0%"
              stop-color={color(l.color)}
              stop-opacity="0.18"
            /><stop
              offset="100%"
              stop-color={color(l.color)}
              stop-opacity="0"
            /></linearGradient
          >{/each}</defs
      >
      {#each ticks as t}<line
          x1={padL}
          x2={W - padR}
          y1={y(t)}
          y2={y(t)}
          stroke="#ffffff0c"
          stroke-dasharray="3 5"
        /><text x="0" y={y(t) + 3} font-size="10" fill="#8c9a7e">{fmtY(t)}</text
        >{/each}
      {#each lines as l, i}<path
          d={areaPath(data, l.key, x, y)}
          fill={`url(#${id}-gradient-${i})`}
        /><path
          d={linePath(data, l.key, x, y)}
          fill="none"
          stroke={color(l.color)}
          stroke-width="1.8"
          vector-effect="non-scaling-stroke"
        />{#if point && point[l.key] !== undefined}<circle
            cx={x(point.t)}
            cy={y(point[l.key])}
            r="3"
            fill={color(l.color)}
          />{/if}{/each}
      {#if sampleIndex >= 0 && point}<line
          x1={x(point.t)}
          x2={x(point.t)}
          y1={padT}
          y2={height - padB}
          stroke="#b4c79f"
          stroke-opacity=".35"
          stroke-dasharray="3 4"
        />{/if}
    </svg>
    <div class="mt-2 flex justify-between text-[10px] text-slate-400">
      <span>{fmtAxisTime(data[0].t)}</span><span
        >{fmtAxisTime(data[data.length - 1].t)}</span
      >
    </div>
    {#if point}<div class="chart-values">
        <time>{fmtAxisTime(point.t)}</time>{#each lines as l}<span
            ><span style:color={color(l.color)}>{l.label}</span>
            {point[l.key] === undefined
              ? "No sample"
              : `${Number(point[l.key].toFixed(2))}${unit}`}</span
          >{/each}
      </div>{/if}
    <input
      class="chart-slider"
      type="range"
      aria-label={`Inspect ${lines.map((l) => l.label).join(" and ")} sample`}
      min="0"
      max={Math.max(0, data.length - 1)}
      value={index}
      oninput={(event) => (sampleIndex = Number(event.currentTarget.value))}
    />
  {/if}
</div>

<style>
  .chart-slider {
    width: 100%;
    height: 20px;
    accent-color: #b9de8b;
    margin-top: 15px;
    opacity: 0.45;
    cursor: ew-resize;
  }
  .chart-slider:hover,
  .chart-slider:focus-visible {
    opacity: 1;
  }
</style>
