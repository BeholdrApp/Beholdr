import { describe, expect, it } from "vitest";
import { metricsViewState } from "./metricsView.js";

describe("metricsViewState", () => {
  it("is pending before the first response arrives", () => {
    expect(metricsViewState(null, null, "24h")).toBe("pending");
  });

  it("is ready once data for the selected window has loaded", () => {
    expect(metricsViewState({ window: "24h" }, null, "24h")).toBe("ready");
  });

  it("is pending while a newly selected window's request is still in flight", () => {
    // Old data for 24h is still around; the 7d request hasn't resolved yet.
    expect(metricsViewState({ window: "24h" }, null, "7d")).toBe("pending");
  });

  it("is error when the request for the selected window fails, even with stale data from the old window", () => {
    // Reproduces the #31 bug: a 502 on the new window used to be masked by
    // the stale-window mismatch check and rendered as "Loading 7d..." forever.
    expect(metricsViewState({ window: "24h" }, "502 Bad Gateway", "7d")).toBe("error");
  });

  it("recovers to ready once a retry succeeds for the selected window", () => {
    // success -> window change -> failure -> retry recovery
    expect(metricsViewState({ window: "24h" }, null, "24h")).toBe("ready");
    expect(metricsViewState({ window: "24h" }, null, "7d")).toBe("pending");
    expect(metricsViewState({ window: "24h" }, "502 Bad Gateway", "7d")).toBe("error");
    expect(metricsViewState({ window: "7d" }, null, "7d")).toBe("ready");
  });
});
