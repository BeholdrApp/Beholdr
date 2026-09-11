// Package demo supplies isolated fixtures and synthetic service-health queries.
package demo

import (
	"github.com/beholdrapp/stalkr/demo"
	"math"
	"time"
)

type Source struct{ demo.Source }

func wave(t time.Time) float64 { return math.Sin(float64(t.Unix()) / 60) }
