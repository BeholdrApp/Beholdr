package demo

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/beholdrapp/beholdr/internal/integrations"
	"github.com/beholdrapp/beholdr/internal/servicehealth"
)

var _ servicehealth.Querier = Source{}

// These inputs exercise Beholdr's actual bounded query, scoring and chart code.
// They simulate query results; they are not a PromQL engine or real telemetry.
func (Source) QueryPrometheusInstant(ctx context.Context, query string, at time.Time) ([]integrations.InstantSample, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	v, err := metric(query, at)
	if err != nil {
		return nil, err
	}
	return []integrations.InstantSample{{Sample: integrations.Sample{Timestamp: float64(at.Unix()), Value: v}}}, nil
}

func (Source) QueryPrometheusRange(ctx context.Context, query string, start, end time.Time, step time.Duration) ([]integrations.TimeSeries, error) {
	if step <= 0 || end.Before(start) || end.Sub(start)/step > 2000 {
		return nil, fmt.Errorf("invalid demo query range")
	}
	values := []integrations.Sample{}
	for at := start; !at.After(end); at = at.Add(step) {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		v, err := metric(query, at)
		if err != nil {
			return nil, err
		}
		values = append(values, integrations.Sample{Timestamp: float64(at.Unix()), Value: v})
	}
	return []integrations.TimeSeries{{Values: values}}, nil
}

func metric(query string, at time.Time) (float64, error) {
	checkout := strings.Contains(query, "checkout")
	switch {
	case strings.Contains(query, "aspnetcore_requests_duration_seconds_count"):
		if checkout && !strings.Contains(query, "offset 1w") {
			return 6 + wave(at), nil
		}
		return 0.2 + 0.1*wave(at), nil
	case strings.Contains(query, "container_cpu_usage_seconds_total"):
		if checkout {
			return 85 + 5*wave(at), nil
		}
		return 30 + 8*wave(at), nil
	case strings.Contains(query, "container_memory_working_set_bytes"):
		return 45 + 4*wave(at), nil
	case strings.Contains(query, "kube_pod_container_status_waiting_reason"):
		if checkout {
			return 1, nil
		}
		return 0, nil
	case strings.Contains(query, "kube_pod_status_phase"):
		return 0, nil
	default:
		return 0, fmt.Errorf("unsupported demo metric query")
	}
}
