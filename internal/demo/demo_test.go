package demo_test

import (
	"context"
	"io"
	"log/slog"
	"testing"
	"time"

	"github.com/beholdrapp/beholdr/internal/collect"
	"github.com/beholdrapp/beholdr/internal/demo"
	"github.com/beholdrapp/beholdr/internal/servicehealth"
)

func TestDemoThroughRealCollectorAndHealthService(t *testing.T) {
	src := demo.Source{}
	c := collect.New(src, time.Hour, time.Second, 240, slog.New(slog.NewTextHandler(io.Discard, nil)))
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	c.Run(ctx)
	snap := c.Snapshot()
	if !snap.Ready || !snap.MetricsAvailable || snap.Metrics.Partial() || len(snap.Nodes) != 3 || len(snap.Microservices) != 6 || len(snap.Pods) != 14 {
		t.Fatalf("invalid demo snapshot: %+v", snap)
	}
	health, err := servicehealth.New(src, servicehealth.Config{})
	if err != nil {
		t.Fatal(err)
	}
	for _, workload := range snap.Microservices {
		var pods []string
		for _, p := range snap.Pods {
			if p.Namespace == workload.Namespace && p.Workload == workload.Name && p.WorkloadKind == workload.Kind {
				pods = append(pods, p.Name)
			}
		}
		for _, name := range []string{"1h", "6h", "24h", "7d", "21d"} {
			window, _ := servicehealth.ParseWindow(name)
			report, err := health.Query(context.Background(), workload, pods, window, time.Now())
			if err != nil {
				t.Fatal(err)
			}
			want := servicehealth.SeverityHealthy
			if workload.Name == "checkout" {
				want = servicehealth.SeverityCritical
			}
			if report.Severity != want {
				t.Fatalf("%s %s: severity %s, want %s", workload.Name, name, report.Severity, want)
			}
			for _, signal := range report.Signals {
				if signal.State != servicehealth.StateOK || len(signal.Points) == 0 {
					t.Fatalf("%s %s: %+v", workload.Name, name, signal)
				}
			}
		}
	}
}

func TestDemoQueryBoundsAndCancellation(t *testing.T) {
	s := demo.Source{}
	now := time.Now()
	for _, step := range []time.Duration{0, time.Nanosecond} {
		if _, err := s.QueryPrometheusRange(context.Background(), "", now.Add(-time.Hour), now, step); err == nil {
			t.Fatal("unbounded query accepted")
		}
	}
	if _, err := s.QueryPrometheusInstant(context.Background(), "unknown", now); err == nil {
		t.Fatal("unknown query accepted")
	}
	if _, err := s.QueryPrometheusRange(context.Background(), "unknown", now, now, time.Second); err == nil {
		t.Fatal("unknown range query accepted")
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := s.QueryPrometheusInstant(ctx, "", now); err == nil {
		t.Fatal("cancellation ignored")
	}
	if _, err := s.QueryPrometheusRange(ctx, "", now, now, time.Second); err == nil {
		t.Fatal("range cancellation ignored")
	}
}
