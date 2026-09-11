package main

import "testing"

func TestDemoIgnoresExternalConfiguration(t *testing.T) {
	t.Setenv("BEHOLDR_ADDR", "0.0.0.0:9000")
	t.Setenv("KUBECONFIG", "/must/not/be/read")
	t.Setenv("BEHOLDR_PROMETHEUS_URL", "https://must-not-connect.invalid")
	t.Setenv("BEHOLDR_SERVICE_ERROR_RATE_WARNING", "invalid")
	cfg := runtimeConfig(true)
	if cfg.Addr != "127.0.0.1:8000" || cfg.Kubeconfig != "" || cfg.PrometheusURL != "" || cfg.Validate() != nil {
		t.Fatalf("demo leaked external configuration: %+v", cfg)
	}
	if cfg.PollInterval <= 0 || cfg.HistorySize <= 0 {
		t.Fatal("invalid demo collector settings")
	}
	if err := runtimeConfig(false).Validate(); err == nil {
		t.Fatal("normal mode must still validate environment configuration")
	}
}
