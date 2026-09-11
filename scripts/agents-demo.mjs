// Isolated, cross-repository OTLP demo. Downloads only a checksum-pinned upstream
// Collector; every runtime listener and exporter stays on literal loopback.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, access, mkdtemp } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import net from "node:net";
import assert from "node:assert/strict";

const root = fileURLToPath(new URL("../", import.meta.url));
const workspace = path.dirname(root);
const stalkr = path.join(workspace, "stalkr");
const spectatr = path.join(workspace, "net-spectatr");
const tools = path.join(root, "out/tools");
const extension = process.platform === "win32" ? ".exe" : "";
const check = process.argv.includes("--check");
const noBuild = process.argv.includes("--no-build");
const version = "0.160.0";
const hashes = {
  win32: "d8de67cf9dc3ffe928610d52b192cb029365bb42dc79a23e0586c040c83293cf",
  linux: "7bb60c584c241c86261c2b8697cd3725dd8c56691f5ad5d98454eaa005b47b0c",
};
if (!hashes[process.platform] || process.arch !== "x64") throw new Error("The pinned demo Collector supports Windows/Linux x64.");
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  !/^(OTEL_|K8S_|BEHOLDR_|ASPNETCORE_|DOTNET_STARTUP|CORECLR_|COR_|KUBECONFIG$|HTTP_PROXY$|HTTPS_PROXY$|ALL_PROXY$)/i.test(key)));
const children = [];
let stopping = false;
function start(command, args, cwd, environment = env, log) {
  const output = log ? createWriteStream(log) : null;
  const child = spawn(command, args, { cwd, env: environment, stdio: output ? ["ignore", "pipe", "pipe"] : "inherit", windowsHide: true });
  if (output) { child.stdout.pipe(output); child.stderr.pipe(output); }
  child.on("error", error => { child.demoError = error; });
  children.push(child);
  return child;
}
async function run(command, args, cwd) {
  const child = start(command, args, cwd);
  await new Promise((resolve, reject) => { child.once("error", reject); child.once("exit", code => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`))); });
}
function stop() { stopping = true; for (const child of children.toReversed()) if (child.exitCode === null) child.kill(); }
process.on("SIGINT", stop); process.on("SIGTERM", stop);
async function free(port) {
  await new Promise((resolve, reject) => { const server = net.createServer(); server.once("error", () => reject(new Error(`Port ${port} is occupied; stop its listener first.`))); server.listen(port,"127.0.0.1",() => server.close(resolve)); });
}
async function healthy(child, url) {
  for (let i=0; i<150; i++) {
    if (child.demoError) throw child.demoError;
    if (child.exitCode !== null) throw new Error(`Demo child exited ${child.exitCode}; inspect the run logs.`);
    try { if ((await fetch(url,{signal:AbortSignal.timeout(1000)})).ok) return; } catch {}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw new Error(`Not ready: ${url}`);
}

try {
  await Promise.all([4317,4318,13133,5080,5081,8001].map(free));
  await Promise.all([access(path.join(stalkr,"go.mod")),access(path.join(spectatr,"NetSpectatr.slnx"))]);
  await mkdir(tools,{recursive:true});
  const archive = `otelcol-contrib_${version}_${process.platform === "win32" ? "windows" : "linux"}_amd64.tar.gz`;
  const archivePath = path.join(tools,archive);
  try { await access(archivePath); } catch {
    console.log("Downloading the pinned upstream OpenTelemetry Collector…");
    const response = await fetch(`https://github.com/open-telemetry/opentelemetry-collector-releases/releases/download/v${version}/${archive}`);
    if (!response.ok) throw new Error(`Collector download failed: ${response.status}`);
    await writeFile(archivePath, Buffer.from(await response.arrayBuffer()));
  }
  assert.equal(createHash("sha256").update(await readFile(archivePath)).digest("hex"),hashes[process.platform],"Collector checksum mismatch");
  await run("tar",["-xzf",archivePath,"-C",tools,`otelcol-contrib${extension}`],root);
  if (!noBuild) {
    await run("go",["build","-o",path.join(root,`out/stalkr-demo${extension}`),"./cmd/stalkr"],stalkr);
    await run("dotnet",["restore","--locked-mode"],spectatr);
    await run("dotnet",["build","-c","Release","--no-restore"],spectatr);
    await run(process.execPath,[path.join(root,"scripts/demo.mjs"),"--build-only","--agents"],root);
  }
  const runDir = await mkdtemp(path.join(root,"out/agents-run-"));
  const telemetry = path.join(runDir,"telemetry.jsonl");
  const config = path.join(runDir,"collector.yaml");
  console.log(`Run artifacts: ${runDir}`);
  // JSON strings are valid YAML quoted scalars, including Windows paths.
  await writeFile(config, `receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 127.0.0.1:4317
      http:
        endpoint: 127.0.0.1:4318
processors:
  memory_limiter:
    check_interval: 1s
    limit_mib: 256
    spike_limit_mib: 64
  batch:
    timeout: 1s
    send_batch_size: 256
    send_batch_max_size: 512
exporters:
  file:
    path: ${JSON.stringify(telemetry)}
    flush_interval: 1s
    rotation:
      max_megabytes: 10
      max_backups: 1
extensions:
  health_check:
    endpoint: 127.0.0.1:13133
service:
  extensions: [health_check]
  telemetry:
    logs:
      level: error
    metrics:
      level: none
  pipelines:
    metrics:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [file]
    traces:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [file]
`);
  const collector = start(path.join(tools,`otelcol-contrib${extension}`),["--config",config],root,env,path.join(runDir,"collector.log"));
  await healthy(collector,"http://127.0.0.1:13133");
  const sampleEnv = { ...env, OTEL_EXPORTER_OTLP_ENDPOINT:"http://127.0.0.1:4318", OTEL_EXPORTER_OTLP_PROTOCOL:"http/protobuf", OTEL_TRACES_SAMPLER:"always_on", OTEL_METRIC_EXPORT_INTERVAL:"1000", OTEL_BSP_SCHEDULE_DELAY:"1000", DOTNET_ENVIRONMENT:"Development", K8S_CLUSTER_NAME:"beholdr-demo", K8S_NAMESPACE_NAME:"shop", K8S_POD_NAME:"checkout-sample", K8S_CONTAINER_NAME:"app", K8S_DEPLOYMENT_NAME:"checkout" };
  const app = start("dotnet",[path.join(spectatr,"samples/DemoApi/bin/Release/net10.0/DemoApi.dll"),"--urls","http://127.0.0.1:5080"],spectatr,{...sampleEnv,OTEL_SERVICE_NAME:"net-spectatr-demo"},path.join(runDir,"spectatr.log"));
  const stock = start("dotnet",[path.join(spectatr,"samples/StockOtelApi/bin/Release/net10.0/StockOtelApi.dll"),"--urls","http://127.0.0.1:5081"],spectatr,{...sampleEnv,OTEL_SERVICE_NAME:"stock-otel-demo",OTEL_RESOURCE_ATTRIBUTES:"k8s.cluster.name=beholdr-demo,k8s.namespace.name=shop"},path.join(runDir,"stock.log"));
  await Promise.all([healthy(app,"http://127.0.0.1:5080/health"),healthy(stock,"http://127.0.0.1:5081/")]);
  const agent = start(path.join(root,`out/stalkr-demo${extension}`),["-demo","-interval","5s"],stalkr,env,path.join(runDir,"stalkr.log"));
  const beholdr = start(path.join(root,`out/beholdr-agents${extension}`),["-demo","-demo-port","8001","-demo-telemetry-file",telemetry],root,env,path.join(runDir,"beholdr.log"));
  await healthy(beholdr,"http://127.0.0.1:8001/ready");
  async function traffic() {
    await Promise.all(["http://127.0.0.1:5080/work", "http://127.0.0.1:5080/fail", "http://127.0.0.1:5081/"].map(url=>fetch(url,{signal:AbortSignal.timeout(5000)})));
  }
  let proven = false;
  for (let i=0;i<30;i++) {
    await traffic();
    const result = await (await fetch("http://127.0.0.1:8001/api/telemetry")).json();
    const has = name => result.services.find(s=>s.name===name && s.metric_names.length>0);
    proven = has("stalkr") && has("net-spectatr-demo")?.metric_names.includes("dotnet.gc.collections") && has("net-spectatr-demo")?.metric_names.includes("dotnet.exceptions") && has("net-spectatr-demo")?.spans>0 && has("stock-otel-demo")?.spans>0 && result.spans.some(s=>s.service==="net-spectatr-demo"&&s.error&&s.exception==="System.InvalidOperationException");
    if (proven) break;
    await new Promise(resolve=>setTimeout(resolve,1000));
  }
  assert.ok(proven,"OTLP proof failed: need agent metrics, both .NET services, and an exception trace in Beholdr.");
  console.log(`Agents demo verified: stalkr metrics + .NET traces/runtime metrics/exceptions + stock SDK control.\nBeholdr: http://127.0.0.1:8001/telemetry\nRun artifacts: ${runDir}`);
  if (check) {
    collector.kill();
    // A receiver outage must not block the instrumented request path.
    const response = await fetch("http://127.0.0.1:5080/work",{signal:AbortSignal.timeout(3000)});
    assert.equal(response.status,200,"Sample failed after Collector outage");
    console.log("Collector outage check passed: sample request path remains available.");
    stop();
  } else {
    console.log("Demo traffic runs every 5s. Press Ctrl+C to stop all components.");
    const timer = setInterval(()=>traffic().catch(error=>{console.error(error);stop();}),5000);
    await new Promise(resolve=>{const timer2=setInterval(()=>{
      if ([collector,app,stock,agent,beholdr].some(c=>c.exitCode!==null||c.demoError)) { if(!stopping)process.exitCode=1;stop(); }
      if(stopping){clearInterval(timer);clearInterval(timer2);resolve();}
    },500);});
  }
} catch(error) { console.error(error); process.exitCode=1; stop(); }
