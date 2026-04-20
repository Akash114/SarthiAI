# SLOs — Android v1 (baseline)

**Status:** Baseline definitions for measurement; targets are directional until production traffic exists.

## Measurement (v1)

**Chosen approach:** **Sentry + structured logs** as the primary signals for API error rate and mobile crash-free sessions. **PostHog** for product funnel coverage. **OTel traces** export to a collector when `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` is set (optional p95 from your APM/backend if wired to the same traces).

Full **OTel HTTP metrics** and load-balancer SLO dashboards are **not** required for an initial Android release; add them when traffic warrants.

## API (FastAPI `/v1`)

| Signal | Definition | Initial target | Notes |
| --- | --- | --- | --- |
| Availability | Successful responses (2xx/3xx) / all responses, excluding client 4xx | 99.5% monthly | LB or APM when available; until then infer from Sentry issue volume + 5xx |
| Latency | p95 server-side request duration | &lt; 500 ms warm paths (auth, small JSON) | Optional: APM from OTLP traces; else spot-check logs |
| Error rate | 5xx / all requests | &lt; 0.5% | **Sentry** (Issues, alert on regression) + JSON logs with `level` |

## Mobile (Android)

| Signal | Definition | Initial target | Notes |
| --- | --- | --- | --- |
| Crash-free sessions | Sentry Release Health | &gt; 99% | Tune per release after baseline |
| Core funnel | PostHog events per [taxonomy](../analytics/taxonomy-v1.md) | Dashboards for onboarding → task → intervention | No PII in properties |

## Review

Revisit monthly after internal/preview data exists; tighten targets when stable.
