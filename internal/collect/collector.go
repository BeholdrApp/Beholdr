// Package collect connects stalkr observations to control-plane history.
package collect

import (
	"github.com/beholdrapp/stalkr/cluster"
	"log/slog"
	"time"
)

type Collector struct {
	*cluster.Collector
	History *History
}

func New(src Source, interval, timeout time.Duration, historySize int, log *slog.Logger) *Collector {
	c := &Collector{Collector: cluster.New(src, interval, timeout, log), History: NewHistory(historySize)}
	c.Collector.OnSnapshot = c.recordHistory
	return c
}
func (c *Collector) recordHistory(snap Snapshot) {
	ts, cluster := snap.UpdatedAt, snap.Cluster
	c.History.Push("cluster", Point{
		"t": ts, "cpu_pct": cluster.CPUPct, "mem_pct": cluster.MemPct,
		"cpu_used": float64(cluster.CPUUsed), "mem_used": float64(cluster.MemUsed),
		"pods_running": float64(cluster.PodsByPhase["Running"]),
	})
	keep := map[string]struct{}{"cluster": {}}
	for _, n := range snap.Nodes {
		name := n.Name
		key := "node::" + name
		keep[key] = struct{}{}
		c.History.Push(key, Point{
			"t": ts, "cpu_pct": n.CPUPct, "mem_pct": n.MemPct,
			"cpu_used": float64(n.CPUUsed), "mem_used": float64(n.MemUsed),
			"pod_count": float64(n.PodCount),
		})
	}
	for _, m := range snap.Microservices {
		key := m.Key
		hk := "ms::" + key
		keep[hk] = struct{}{}
		c.History.Push(hk, Point{
			"t": ts, "cpu_used": float64(m.CPUUsed), "mem_used": float64(m.MemUsed),
			"replicas_ready": float64(m.ReadyReplicas), "replicas_desired": float64(m.DesiredReplica),
		})
	}
	c.History.Prune(keep)

}
