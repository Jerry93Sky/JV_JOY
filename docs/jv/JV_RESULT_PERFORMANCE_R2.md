# Performance R2

Reproduce after backend build: `node tools/jv/benchmark-result-http-r2.mjs legacy` and `node tools/jv/benchmark-result-http-r2.mjs v1`. Raw data: `JV_RESULT_BENCHMARK_R2_legacy.json`, `JV_RESULT_BENCHMARK_R2_v1.json`. Windows, Node 24.13, Ryzen 5 7500F, 12 logical cores, 33.9 GB RAM; all-seven COMPLETATION, one warmup, eight concurrent Fastify injects in one process, no production DB or real network/compression. Results are one short run, not an SLO. Eight samples do not establish reliable percentiles.

| Metric | Legacy | v1 |
|---|---:|---:|
| Response uncompressed | 3,153,987 B | 148,768 B |
| 8 requests elapsed | 685.2 ms | 268.7 ms |
| Throughput | 11.68/s | 29.77/s |
| p50 / p95 / p99 | 347.3 / 675.4 / 675.4 ms | 138.9 / 268.1 / 268.1 ms |
| Event-loop max | 685.8 ms | 267.5 ms |
| CPU user/system | 703 / 79 ms | 297 / 78 ms |
| RSS before/after | 171.8 / 393.3 MB | 142.9 / 173.9 MB |
| heap before/after | 50.9 / 190.1 MB | 58.6 / 39.7 MB |
| Engine sample | 35.1 ms | 31.4 ms |
| Projection sample | 21.37 ms | 0.325 ms |
| JSON stringify sample | 11.17 ms | 0.480 ms |
| Errors | 0 | 0 |

Projection sample excludes trace-store preparation; full endpoint timings include it. Different GC timing prevents interpreting heap as a leak or guaranteed reduction. Chrome test on same host: first trace page 376 ms including 250 ms debounce, JS heap 20.3 MB before and 76.3 MB after opening sections and searching; these are not comparable to prior 63.1 MB without controlling garbage collection and interactions. Network compression is not configured or measured. Other profile, single item, PARTIAL, larger BOM/trace and many-user load were functionally exercised where existing tests cover them, but have not been benchmarked in this R2 run.
