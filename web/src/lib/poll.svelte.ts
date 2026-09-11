// Reactive polling helper built on Svelte 5 runes. Call inside a component's
// init; it refetches `url` every `intervalMs` and exposes reactive getters.
export function poll<T>(url: string | (() => string), intervalMs = 5000) {
  let data = $state<T | null>(null);
  let error = $state<string | null>(null);
  let loading = $state(true);

  const resolve = () => (typeof url === "function" ? url() : url);

  $effect(() => {
    // Resolve inside the effect so a reactive URL starts a fresh request
    // lifecycle. An error belongs to the previously requested URL, not the
    // next one selected by the user.
    const currentUrl = resolve();
    data = null;
    error = null;
    loading = true;

    let alive = true;
    const controller = new AbortController();
    let inFlight = false;
    const tick = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const r = await fetch(currentUrl, { signal: controller.signal });
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        const j = (await r.json()) as T;
        if (alive) { data = j; error = null; }
      } catch (e) {
        if (alive) error = e instanceof Error ? e.message : String(e);
      } finally {
        inFlight = false;
        if (alive) loading = false;
      }
    };
    tick();
    const id = setInterval(tick, intervalMs);
    return () => { alive = false; controller.abort(); clearInterval(id); };
  });

  return {
    get data() { return data; },
    get error() { return error; },
    get loading() { return loading; },
  };
}
