package collect

import (
	"context"
	"github.com/beholdrapp/stalkr/demo"
	"io"
	"log/slog"
	"testing"
	"time"
)

func TestExtractedCollectorMaintainsBoundedControlPlaneHistory(t *testing.T) {
	c := New(demo.Source{}, time.Second, time.Second, 2, slog.New(slog.NewTextHandler(io.Discard, nil)))
	for range 3 {
		c.Poll(context.Background())
	}
	for _, key := range []string{"cluster", "node::demo-worker-1", "ms::shop/Deployment/checkout"} {
		if len(c.History.Get(key)) != 2 {
			t.Errorf("missing or unbounded history: %s", key)
		}
	}
	if c.Snapshot().Cluster.PodsTotal != 14 {
		t.Fatal("extracted collector changed demo")
	}
}
