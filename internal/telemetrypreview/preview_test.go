package telemetrypreview

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"
	"time"
)

const metricsLine = `{"resourceMetrics":[{"resource":{"attributes":[{"key":"service.name","value":{"stringValue":"stalkr"}},{"key":"k8s.cluster.name","value":{"stringValue":"demo"}}]},"scopeMetrics":[{"metrics":[{"name":"k8s.pod.cpu.usage","gauge":{"dataPoints":[{"timeUnixNano":"1000000000","asDouble":0.5}]}}]}]}]}`
const traceLine = `{"resourceSpans":[{"resource":{"attributes":[{"key":"service.name","value":{"stringValue":"sample"}}]},"scopeSpans":[{"spans":[{"name":"GET /fail","traceId":"0123456789abcdef0123456789abcdef","startTimeUnixNano":"1000000000","endTimeUnixNano":"1002000000","status":{"code":2},"events":[{"name":"exception","attributes":[{"key":"exception.type","value":{"stringValue":"System.InvalidOperationException"}},{"key":"exception.message","value":{"stringValue":"do not expose"}}]}]}]}]}]}`

func TestReadsUpstreamRecordsAndIgnoresPartialWrites(t *testing.T) {
	file := filepath.Join(t.TempDir(), "telemetry.jsonl")
	if err := os.WriteFile(file, []byte(metricsLine+"\n"+traceLine+"\n{partial"), 0600); err != nil {
		t.Fatal(err)
	}
	got, err := Read(file)
	if err != nil {
		t.Fatal(err)
	}
	if !got.Ready || len(got.Services) != 2 || len(got.Spans) != 1 {
		t.Fatalf("unexpected preview %+v", got)
	}
	span := got.Spans[0]
	if !span.Error || span.DurationMS != 2 || span.Exception != "System.InvalidOperationException" || span.TraceID != "0123456789abcdef0123456789abcdef" {
		t.Fatalf("bad span %+v", span)
	}
	if got.Services[1].MetricNames[0] != "k8s.pod.cpu.usage" {
		t.Fatal("missing metric")
	}
	old := time.Now().Add(-time.Hour)
	if err := os.Chtimes(file, old, old); err != nil {
		t.Fatal(err)
	}
	got, err = Read(file)
	if err != nil || got.Ready {
		t.Fatal("stale file reported live")
	}
}

func TestMissingDisabledAndBoundedPreview(t *testing.T) {
	got, err := Read("")
	if err != nil || got.Enabled {
		t.Fatal("empty preview should be disabled")
	}
	got, err = Read(filepath.Join(t.TempDir(), "missing"))
	if err != nil || !got.Enabled || got.Ready {
		t.Fatal("missing file should be waiting")
	}
	file := filepath.Join(t.TempDir(), "large.jsonl")
	data := append(bytes.Repeat([]byte{' '}, maxBytes), '\n')
	for range 110 {
		data = append(data, []byte(traceLine+"\n")...)
	}
	if err := os.WriteFile(file, data, 0600); err != nil {
		t.Fatal(err)
	}
	got, err = Read(file)
	if err != nil {
		t.Fatal(err)
	}
	if !got.Truncated || len(got.Spans) != 100 {
		t.Fatalf("unbounded preview: %d", len(got.Spans))
	}
}
