// Build and run the same embedded Go + Svelte application shipped in the image.
// Demo mode only listens on loopback and never loads external configuration.
import { spawn } from "node:child_process";
import { cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";
import net from "node:net";

const root = fileURLToPath(new URL("../", import.meta.url));
const web = path.join(root, "web");
const dist = path.join(root, "internal/webui/dist");
const binary = path.join(root, "out", process.platform === "win32" ? "beholdr-demo.exe" : "beholdr-demo");

function run(command, args, cwd = root) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: "inherit", windowsHide: true });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`)));
  });
}

async function build() {
  if (!process.env.npm_execpath) throw new Error("Run this with npm run demo from web/.");
  await run(process.execPath, [process.env.npm_execpath, "run", "build"], web);
  await mkdir(path.dirname(binary), { recursive: true });
  const output = path.resolve(root, "out");
  const staging = await mkdtemp(path.join(output, "demo-build-"));
  try {
    await Promise.all([
      cp(path.join(root, "go.mod"), path.join(staging, "go.mod")),
      cp(path.join(root, "go.sum"), path.join(staging, "go.sum")),
      cp(path.join(root, "cmd"), path.join(staging, "cmd"), { recursive: true }),
      cp(path.join(root, "internal"), path.join(staging, "internal"), {
        recursive: true,
        filter: (source) => path.resolve(source) !== path.resolve(dist),
      }),
    ]);
    await cp(path.join(web, "build"), path.join(staging, "internal/webui/dist"), { recursive: true });
    await run("go", ["build", "-o", binary, "./cmd/beholdr"], staging);
  } finally {
    // Remove only our own temporary build directory, never a source path.
    if (path.dirname(path.resolve(staging)) !== output || !path.basename(staging).startsWith("demo-build-")) {
      throw new Error("Unexpected demo build directory; refusing cleanup.");
    }
    await rm(staging, { recursive: true, force: true });
  }
}

// Fail before building if another instance owns the demo port. Otherwise a
// smoke test could accidentally validate an older application already running.
await new Promise((resolve, reject) => {
  const probe = net.createServer();
  probe.once("error", () => reject(new Error("Port 8000 is already in use. Stop the existing listener before running the demo.")));
  probe.listen(8000, "127.0.0.1", () => probe.close(resolve));
});
await build();
const server = spawn(binary, ["-demo"], { cwd: root, stdio: "inherit", windowsHide: true });
let serverError;
server.on("error", (error) => { serverError = error; });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.kill());

const base = "http://127.0.0.1:8000";
async function json(route) {
  const r = await fetch(base + route, { signal: AbortSignal.timeout(5000) });
  assert.equal(r.status, 200, `${route}: ${r.status}`);
  return r.json();
}

try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (serverError) throw serverError;
    if (server.exitCode !== null) throw new Error(`Demo exited: ${server.exitCode}`);
    try {
      const health = await json("/api/health");
      ready = health.ready && health.demo;
    } catch { /* wait for the first collection */ }
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(ready, "The isolated demo did not become ready on port 8000.");
  if (process.argv.includes("--check")) {
    assert.equal((await json("/api/cluster")).cluster.nodes_total, 3);
    const workloads = (await json("/api/microservices")).microservices;
    assert.equal(workloads.length, 6);
    for (const m of workloads) {
      const route = `/api/microservices/${m.namespace}/${m.name}`;
      const detail = await json(`${route}?kind=${m.kind}`);
      assert.ok(detail.pods.length > 0);
      const metrics = await json(`${route}/metrics?kind=${m.kind}&range=1h`);
      assert.equal(metrics.severity, m.name === "checkout" ? "critical" : "healthy");
      assert.ok(metrics.signals.every((signal) => signal.state === "ok" && signal.points.length > 0));
    }
    assert.deepEqual((await json("/api/integrations")).providers, []);
    const html = await (await fetch(base)).text();
    assert.ok(html.includes("_app/immutable"), "The embedded UI was not built.");
    assert.equal(server.exitCode, null, "The demo process exited during the smoke test.");
    console.log("Demo smoke check passed: real API, six workloads, charts and embedded UI.");
    server.kill();
  } else {
    console.log(`\nBeholdr is ready: ${base}\nSynthetic data only. Press Ctrl+C to stop.\n`);
  }
} catch (error) {
  server.kill();
  console.error(error);
  process.exitCode = 1;
}
