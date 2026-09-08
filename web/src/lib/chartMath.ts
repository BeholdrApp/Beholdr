import type { Point } from "./types.js";

/** Maps a timestamp to an x pixel position across [minT, maxT]. A zero-span
 *  range (empty or single-timestamp data) collapses to the left edge. */
export function makeXScale(minT: number, maxT: number, x0: number, x1: number) {
  const span = maxT - minT;
  return (t: number) => x0 + (span <= 0 ? 0 : ((t - minT) / span) * (x1 - x0));
}

export function timeExtent(data: Point[]): { minT: number; maxT: number } {
  if (data.length === 0) return { minT: 0, maxT: 0 };
  let minT = data[0].t, maxT = data[0].t;
  for (const p of data) {
    if (p.t < minT) minT = p.t;
    if (p.t > maxT) maxT = p.t;
  }
  return { minT, maxT };
}

/** Largest value held by `key` across `data`, ignoring points where that
 *  series has no sample rather than treating the gap as zero. */
export function maxValue(data: Point[], keys: string[]): number {
  let m = 0;
  for (const p of data) {
    for (const key of keys) {
      const v = p[key];
      if (v !== undefined) m = Math.max(m, v);
    }
  }
  return m;
}

/** Splits `data` into runs of consecutive points that carry a sample for
 *  `key`, so a missing sample breaks the line instead of being drawn as 0. */
export function segmentsFor(data: Point[], key: string): Point[][] {
  const segments: Point[][] = [];
  let current: Point[] = [];
  for (const p of data) {
    if (p[key] === undefined) {
      if (current.length) segments.push(current);
      current = [];
    } else {
      current.push(p);
    }
  }
  if (current.length) segments.push(current);
  return segments;
}

export function linePath(
  data: Point[],
  key: string,
  x: (t: number) => number,
  y: (v: number) => number,
): string {
  return segmentsFor(data, key)
    .map((seg) =>
      seg
        .map((p, i) => `${i === 0 ? "M" : "L"}${x(p.t).toFixed(1)},${y(p[key]!).toFixed(1)}`)
        .join(" "),
    )
    .join(" ");
}

export function areaPath(
  data: Point[],
  key: string,
  x: (t: number) => number,
  y: (v: number) => number,
): string {
  return segmentsFor(data, key)
    .map((seg) => {
      const top = seg
        .map((p, i) => `${i === 0 ? "M" : "L"}${x(p.t).toFixed(1)},${y(p[key]!).toFixed(1)}`)
        .join(" ");
      const first = x(seg[0].t).toFixed(1);
      const last = x(seg[seg.length - 1].t).toFixed(1);
      return `${top} L${last},${y(0).toFixed(1)} L${first},${y(0).toFixed(1)} Z`;
    })
    .join(" ");
}

const DAY_SECONDS = 86400;

/** Whether the x axis spans more than a day, so axis labels need date context
 *  and not just a time-of-day. */
export function spansMultipleDays(minT: number, maxT: number): boolean {
  return maxT - minT >= DAY_SECONDS;
}
