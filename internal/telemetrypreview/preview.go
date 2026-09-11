// Package telemetrypreview provides a bounded, read-only view of an upstream
// Collector JSON export in the local demo. It is not a production storage adapter.
package telemetrypreview

import (
	"bytes"
	"encoding/json"
	"io"
	"os"
	"sort"
	"time"

	"go.opentelemetry.io/collector/pdata/ptrace/ptraceotlp"
	metrics "go.opentelemetry.io/proto/otlp/collector/metrics/v1"
	traces "go.opentelemetry.io/proto/otlp/collector/trace/v1"
	common "go.opentelemetry.io/proto/otlp/common/v1"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
)

const maxBytes = 8 << 20

type Service struct {
	Name        string   `json:"name"`
	Cluster     string   `json:"cluster"`
	Namespace   string   `json:"namespace"`
	MetricNames []string `json:"metric_names"`
	Spans       int      `json:"spans"`
	Errors      int      `json:"errors"`
	LastSeen    float64  `json:"last_seen"`
}
type Span struct {
	Service    string  `json:"service"`
	Name       string  `json:"name"`
	TraceID    string  `json:"trace_id"`
	DurationMS float64 `json:"duration_ms"`
	Error      bool    `json:"error"`
	Exception  string  `json:"exception,omitempty"`
	At         float64 `json:"at"`
}
type Snapshot struct {
	Enabled   bool      `json:"enabled"`
	Ready     bool      `json:"ready"`
	UpdatedAt float64   `json:"updated_at"`
	Services  []Service `json:"services"`
	Spans     []Span    `json:"spans"`
	Truncated bool      `json:"truncated"`
}

func Read(path string) (Snapshot, error) {
	out := Snapshot{Enabled: path != "", Services: []Service{}, Spans: []Span{}}
	if path == "" {
		return out, nil
	}
	f, err := os.Open(path)
	if os.IsNotExist(err) {
		return out, nil
	}
	if err != nil {
		return out, err
	}
	defer f.Close()
	info, err := f.Stat()
	if err != nil {
		return out, err
	}
	if info.Size() > maxBytes {
		_, err = f.Seek(-maxBytes, io.SeekEnd)
		if err != nil {
			return out, err
		}
		out.Truncated = true
	}
	data, err := io.ReadAll(io.LimitReader(f, maxBytes))
	if err != nil {
		return out, err
	}
	if out.Truncated {
		if i := bytes.IndexByte(data, '\n'); i >= 0 {
			data = data[i+1:]
		} else {
			return out, nil
		}
	}
	out.UpdatedAt = float64(info.ModTime().Unix())
	services := map[string]*Service{}
	metricNames := map[string]map[string]bool{}
	service := func(attrs []*common.KeyValue) (*Service, string) {
		name, cluster, ns := value(attrs, "service.name"), value(attrs, "k8s.cluster.name"), value(attrs, "k8s.namespace.name")
		if name == "" {
			name = "unknown_service"
		}
		key := name + "\x00" + cluster + "\x00" + ns
		if services[key] == nil {
			if len(services) >= 100 {
				out.Truncated = true
				return nil, key
			}
			services[key] = &Service{Name: name, Cluster: cluster, Namespace: ns, MetricNames: []string{}}
			metricNames[key] = map[string]bool{}
		}
		return services[key], key
	}
	decoder := protojson.UnmarshalOptions{DiscardUnknown: true}
	for _, line := range bytes.Split(data, []byte{'\n'}) {
		// A concurrent writer may leave an incomplete final line. Ignore it.
		var shape map[string]json.RawMessage
		if json.Unmarshal(line, &shape) != nil {
			continue
		}
		if _, ok := shape["resourceMetrics"]; ok {
			var request metrics.ExportMetricsServiceRequest
			if decoder.Unmarshal(line, &request) != nil {
				continue
			}
			for _, rm := range request.ResourceMetrics {
				s, key := service(rm.GetResource().GetAttributes())
				if s == nil {
					continue
				}
				for _, scope := range rm.ScopeMetrics {
					for _, m := range scope.Metrics {
						if len(metricNames[key]) < 200 {
							metricNames[key][m.Name] = true
						} else {
							out.Truncated = true
						}
						var newest uint64
						for _, p := range m.GetGauge().GetDataPoints() {
							newest = max(newest, p.TimeUnixNano)
						}
						for _, p := range m.GetSum().GetDataPoints() {
							newest = max(newest, p.TimeUnixNano)
						}
						for _, p := range m.GetHistogram().GetDataPoints() {
							newest = max(newest, p.TimeUnixNano)
						}
						for _, p := range m.GetExponentialHistogram().GetDataPoints() {
							newest = max(newest, p.TimeUnixNano)
						}
						s.LastSeen = max(s.LastSeen, float64(newest)/1e9)
					}
				}
			}
		}
		if _, ok := shape["resourceSpans"]; ok {
			var request traces.ExportTraceServiceRequest
			otlp := ptraceotlp.NewExportRequest()
			if otlp.UnmarshalJSON(line) != nil {
				continue
			}
			wire, err := otlp.MarshalProto()
			if err != nil || proto.Unmarshal(wire, &request) != nil {
				continue
			}
			for _, rs := range request.ResourceSpans {
				s, _ := service(rs.GetResource().GetAttributes())
				if s == nil {
					continue
				}
				for _, scope := range rs.ScopeSpans {
					for _, span := range scope.Spans {
						failed := span.GetStatus().GetCode() == 2
						s.Spans++
						if failed {
							s.Errors++
						}
						s.LastSeen = max(s.LastSeen, float64(span.EndTimeUnixNano)/1e9)
						item := Span{Service: s.Name, Name: span.Name, TraceID: fmtHex(span.TraceId), At: float64(span.StartTimeUnixNano) / 1e9, Error: failed}
						if span.EndTimeUnixNano >= span.StartTimeUnixNano {
							item.DurationMS = float64(span.EndTimeUnixNano-span.StartTimeUnixNano) / 1e6
						}
						for _, event := range span.Events {
							if event.Name == "exception" {
								item.Exception = value(event.Attributes, "exception.type")
							}
						}
						out.Spans = append(out.Spans, item)
						if len(out.Spans) > 100 {
							out.Spans = out.Spans[1:]
							out.Truncated = true
						}
					}
				}
			}
		}
	}
	for key, s := range services {
		for name := range metricNames[key] {
			s.MetricNames = append(s.MetricNames, name)
		}
		sort.Strings(s.MetricNames)
		out.Services = append(out.Services, *s)
	}
	sort.Slice(out.Services, func(i, j int) bool {
		return out.Services[i].Name+out.Services[i].Namespace < out.Services[j].Name+out.Services[j].Namespace
	})
	sort.Slice(out.Spans, func(i, j int) bool { return out.Spans[i].At > out.Spans[j].At })
	out.Ready = len(out.Services) > 0 && time.Since(info.ModTime()) < 30*time.Second
	return out, nil
}

func value(attrs []*common.KeyValue, key string) string {
	for _, a := range attrs {
		if a.Key == key {
			return a.Value.GetStringValue()
		}
	}
	return ""
}
func fmtHex(b []byte) string {
	const digits = "0123456789abcdef"
	out := make([]byte, 0, len(b)*2)
	for _, v := range b {
		out = append(out, digits[v>>4], digits[v&15])
	}
	return string(out)
}
