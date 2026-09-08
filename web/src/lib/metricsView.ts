// Decides what the service-metrics panel should show. Pulled out of
// +page.svelte so the pending/error/ready decision can be unit tested without
// a component-testing harness (this project has none).
export type MetricsViewState = "pending" | "error" | "ready";

export function metricsViewState(
  data: { window: string } | null,
  error: string | null,
  selectedWindow: string,
): MetricsViewState {
  // A failed request always means an error for the window the user has
  // selected, even if `data` still holds a previous window's report -
  // otherwise a failure after a window change gets masked by the stale
  // window mismatch below and looks like it's loading forever.
  if (error) return "error";
  if (!data || data.window !== selectedWindow) return "pending";
  return "ready";
}
