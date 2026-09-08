import { describe, expect, it } from "vitest";
import { areaPath, linePath, makeXScale, maxValue, segmentsFor, spansMultipleDays, timeExtent } from "./chartMath.js";
import type { Point } from "./types.js";

// The exact reproduction fixture from the issue: a timestamp that exists only
// in the comparison series, plus an irregular final gap.
const sparse: Point[] = [
  { t: 0, current: 10, week_ago: 5 },
  { t: 60, week_ago: 5 },
  { t: 600, current: 20, week_ago: 5 },
];

describe("timeExtent", () => {
  it("spans the actual min/max timestamps, not the point count", () => {
    expect(timeExtent(sparse)).toEqual({ minT: 0, maxT: 600 });
  });

  it("collapses to zero for empty data", () => {
    expect(timeExtent([])).toEqual({ minT: 0, maxT: 0 });
  });
});

describe("makeXScale", () => {
  it("places points proportionally to elapsed time, not array index", () => {
    const x = makeXScale(0, 600, 0, 100);
    // t=60 is 10% of the way from 0 to 600, regardless of it being the
    // middle element of a 3-point array.
    expect(x(60)).toBeCloseTo(10);
    expect(x(600)).toBeCloseTo(100);
  });

  it("collapses a zero-span range to the left edge instead of dividing by zero", () => {
    const x = makeXScale(5, 5, 0, 100);
    expect(x(5)).toBe(0);
    expect(Number.isFinite(x(5))).toBe(true);
  });
});

describe("maxValue", () => {
  it("ignores missing samples instead of treating them as 0", () => {
    // week_ago is 5 everywhere; current only reaches 20. A naive fill-with-0
    // would still get this right, but a fill that clamped low would not.
    expect(maxValue(sparse, ["current", "week_ago"])).toBe(20);
  });

  it("returns 0 when no series has any sample", () => {
    expect(maxValue([{ t: 0 }, { t: 1 }], ["current"])).toBe(0);
  });
});

describe("segmentsFor", () => {
  it("breaks the run at a missing sample instead of bridging it with a fabricated value", () => {
    const segs = segmentsFor(sparse, "current");
    expect(segs).toHaveLength(2);
    expect(segs[0]).toEqual([{ t: 0, current: 10, week_ago: 5 }]);
    expect(segs[1]).toEqual([{ t: 600, current: 20, week_ago: 5 }]);
  });

  it("keeps one unbroken run when every point has the sample", () => {
    const segs = segmentsFor(sparse, "week_ago");
    expect(segs).toHaveLength(1);
    expect(segs[0]).toHaveLength(3);
  });

  it("handles a series with no samples at all", () => {
    expect(segmentsFor([{ t: 0 }, { t: 1 }], "current")).toEqual([]);
  });
});

describe("linePath / areaPath", () => {
  const x = makeXScale(0, 600, 40, 808);
  const y = (v: number) => 200 - v * 2;

  it("draws current as two disconnected segments around the missing sample", () => {
    const d = linePath(sparse, "current", x, y);
    // Two "M" (move-to) commands means two independent segments were drawn;
    // the old index-based fill would produce a single continuous path.
    expect(d.match(/M/g)).toHaveLength(2);
  });

  it("draws week_ago as a single continuous segment since it has every sample", () => {
    const d = linePath(sparse, "week_ago", x, y);
    expect(d.match(/M/g)).toHaveLength(1);
  });

  it("closes each area segment independently", () => {
    const d = areaPath(sparse, "current", x, y);
    // One "Z" (close-path) per segment.
    expect(d.match(/Z/g)).toHaveLength(2);
  });

  it("produces no path for a series with zero samples", () => {
    expect(linePath([{ t: 0 }, { t: 1 }], "current", x, y)).toBe("");
    expect(areaPath([{ t: 0 }, { t: 1 }], "current", x, y)).toBe("");
  });

  it("draws a single-point series as one move-to with no line segment", () => {
    const single: Point[] = [{ t: 0, current: 10 }];
    const d = linePath(single, "current", x, y);
    expect(d.match(/M/g)).toHaveLength(1);
    expect(d).not.toMatch(/L/);
  });
});

describe("spansMultipleDays", () => {
  it("is false for a same-day window", () => {
    expect(spansMultipleDays(0, 3600 * 6)).toBe(false);
  });

  it("is true once the window reaches 24 hours", () => {
    expect(spansMultipleDays(0, 86400)).toBe(true);
    expect(spansMultipleDays(1_700_000_000, 1_700_000_000 + 3 * 86400)).toBe(true);
  });
});
