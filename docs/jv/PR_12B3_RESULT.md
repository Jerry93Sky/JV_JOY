# PR_12B3 status

The public Front API now composes geometry/BOM, material, glass, works and consumables, then calculates S36/S37/S38 and Main X11/Y11/AA11. Scenario D32 is passed from the Excel input fixture; this fixed three completion parity mismatches caused by using the workbook-default D32 instead of the scenario switch.

Comparator: tools/jv/front-commercial-s38-parity.mjs. Excel snapshot: docs/jv/fixtures/front-commercial-s38.xlsx.json, eight scenarios across both price profiles, recalculated on temporary copies using Excel 16 CalculateFullRebuild. Results: 56 terminal comparisons, 8 EXACT, 48 DISPLAY_MATCH, 0 MISMATCH, 0 UNVERIFIED. S38 and Main are display matches, not exact rational equality. The 488 source records contain 464 unique scenario/address pairs; 24 are duplicate Main X/Y/AA captures. 408 unique cells were not directly mapped to public commercial outputs.

Tests: pnpm test:jv 185/185; pnpm typecheck:shared passed; build:frontend, fixture validation and line-lab smoke passed. Front Geometry/BOM, Line, Zigzag, Mixed Order and Slider parity scripts passed. Front Material Pricing still reports its three known inactive retail F1!R13 binary-vs-rational mismatches. Slider S1!R10 and ПРМ!R25 remain documented existing exceptions.

Status is PARTIAL for unsupported glass-off and missing Order Context; missing Order Context now returns structured PARTIAL with a diagnostic, retained S33 where available, and no S38/Main final amounts. Invalid decimals and profile mismatch remain explicit errors. The glass-off branch remains unsupported and PARTIAL. No legacy API, Prisma, production data, or existing orders were changed.
