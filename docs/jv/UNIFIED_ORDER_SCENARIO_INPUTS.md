# Unified Order: canonical all-seven scenario inputs (PR_13E)

## Source and use

`fixtures/unified-order-all-seven-inputs.json` is the single canonical input manifest for PR_13E. It contains 12 controlled mixed-order cases: six for `COMPLETATION` and six for `RETAIL`. Each case has seven typed `UnifiedPositionInput` positions, order-level `mainDiscount` provenance, a list of Excel primary-cell writes with source notes, and the same `engineInput` object passed to `calculateJVOrder`.

The manifest was generated from source-bound family fixtures, then explicitly mapped into one mixed order. These are **recreated controlled cases**, not recovered logs of the earlier PR_13D all-seven cases. No Excel calculated price is used as a user input. Excel is opened from a temporary copy, the manifest's primary writes are applied, `CalculateFullRebuild` is run, and Formula, Value2, Text, and NumberFormat are captured. The source workbooks stay unchanged.

The COM capture verifies 88 explicit primary-cell writes per scenario (1,056 total). The captured workbook names and SHA-256 values match the snapshots embedded in the typed family inputs. Unwritten catalog/settings values come from the matching versioned snapshots; calculation outputs such as Main `G`, `K`, `M`, `R:X`, `Y`, `AA`, `ПРМ!AB25:AB31`, and glue package formulas remain Excel-derived outputs.

## Source inputs by family

| Main slot | Engine family | Typed source fixture | Primary Excel mapping |
|---:|---|---|---|
| 1 | `LINE` | `line-price-excel-golden.json`, `line_single_with_park`; price, glass, and paint snapshots for the selected profile | `Главная!C11:D11`, `F11`, `H11:I11`, `J11:L11`, `N11`, `Z11`; direct Line options at `L1!C21,D21,D22,C23:C25,D25`; profile/settings and catalog references are source-hash-bound |
| 2 | `ZIGZAG` | first position from `zigzag-order-pr10g-excel.json`, `two_zigzag_multiple_packages`; matching Zigzag price snapshot | `Главная!C12:D12`, `F12`, `H12:I12`, `J12`, `L12`, `Z12`; manual values `Z2!N40:N41` |
| 3 | `SLIDER_L3` | first profile record in `slider-pr11d-commercial-capture.json`; L3 price snapshot | `Главная!C13:D13`, `F13`, `H13:I13`, `J13`, `M13`, `Z13`; versioned `Настройки` values and price snapshot |
| 4 | `SLIDER_L5` | first profile record in `slider-pr11f-commercial-capture.json`; L5 price snapshot | `Главная!C14:D14`, `F14`, `H14:I14`, `J14`, `M14`, `Z14`; versioned `Настройки` values and price snapshot |
| 5 | `SLIDER_X3` | first profile record in `slider-pr11h-commercial-capture.json`; X3 price snapshot | `Главная!C15:D15`, `F15`, `H15:I15`, `J15`, `M15`, `Z15`; versioned `Настройки` values and price snapshot |
| 6 | `SLIDER_X5` | first profile record in `slider-pr11j-commercial-capture.json`; X5 price snapshot | `Главная!C16:D16`, `F16`, `H16:I16`, `J16`, `M16`, `Z16`; versioned `Настройки` values and price snapshot |
| 7 | `FRONT` | profile `*-base` in `front-pr12a-excel.json`; Front component price snapshot | `Главная!C17:D17`, `F17`, `H17:I17`, `J17`, `L17`, `Z17`; user controls at `F7!C11:C15,C18:C24,D18:D19`; Main selector `B26` is explicitly set to 1 for this controlled scenario |

The slot-to-family selector map is `1=LINE`, `2=ZIGZAG`, `3=SLIDER_L3`, `4=SLIDER_L5`, `5=SLIDER_X3`, `6=SLIDER_X5`, `7=FRONT`. The family source sheets are consequently `L1`, `Z2`, `S3:S6`, and **`F7`**. The Front typed request is slot 7; its area dependency is `F7!Y5 = ПРМ!AB31` and its commercial source is `F7!S38`.

## Shared order settings

The controlled test cases explicitly set:

| Input | Value | Excel source cell | Engine mapping |
|---|---:|---|---|
| additional work | `TRUE` | `Настройки!D32` | Line D32 snapshot, Zigzag D32, Slider `additionalWorkEnabled`, Front `finishingEnabled` |
| assembly / width service | `FALSE` | `Настройки!D33` | Line `assemblyEnabled`, Zigzag D33, Slider `widthServiceEnabled` |
| installation | `FALSE` | `Настройки!D34` | Line `installationEnabled`, Zigzag D34, Slider `installationEnabled`, Front `installationEnabled` |
| milling / L3 option | `TRUE` | `Настройки!L3` | Line `millingEnabled`, Zigzag L3, Slider L3-specific option |
| order surcharge selector | `1` | `Главная!F28` | Zigzag F28 and Slider `mainSurchargeSelector`; Line commercial mode |
| Front surcharge selector | `1` | `Главная!B26` | Front `mainSurchargeSelector`; set explicitly because `F7!S36` tests `Главная!B26=2` |
| order discount | profile snapshot | `Настройки!D19` | `engineInput.mainDiscount.value` |
| per-slot markup | profile snapshot | `Настройки!D21:D27` | seven `positionMarkups` entries |
| family divisor | profile snapshot | `Настройки!D11:D14` | Line, Zigzag, Slider, Front divisor entries |

The test manifest selects a common set of toggles across all seven positions even where the standalone family fixtures had different switches. The generator normalizes the typed input to those same explicit order settings before serializing the manifest. In particular, the retail Line input's assembly and installation flags are set from the common `D33/D34` inputs rather than inherited from its standalone capture. Front's `finishingEnabled` follows D32, and its Main surcharge selector is written to B26. These are fixture-bridge corrections; no production calculation formula was changed.

## Scenario quantities

Dimensions and family-specific construction options are the source-bound valid inputs listed above. The six cases per price profile vary only Main position quantities in this PR_13E fixture:

| Scenario suffix | Slots 1–7 quantities |
|---|---|
| `base` | `[1,1,1,1,1,1,1]` |
| `multi-quantity` | `[2,1,3,1,2,1,2]` |
| `quantity-zigzag-slider` | `[1,3,1,2,1,2,1]` |
| `quantity-front-line` | `[2,1,1,1,1,1,3]` |
| `quantity-all-distinct` | `[1,2,3,2,1,3,2]` |
| `quantity-high-mix` | `[3,2,1,3,2,1,4]` |

Thus the 12-case parity covers two price books, seven occupied families, multiple instance counts, shared adhesive/activator package thresholds, weighted area allocation, and Front slot 7. It does **not** constitute boundary testing for each geometry family, exhaustive material/opening branches, or proof for every possible size. Such cases remain subsequent coverage work.

## Input comparison contract

Before comparing a price, `compare-unified-order-all-seven-pr13e.mjs` reads every `primaryInputWrites` cell back from the recalculated workbook. A mismatch ledger includes scenario ID, family, sheet/address, expected and actual values, and the originating field/source note. If any required cell differs, the scenario's AA11:AA18 commercial comparison is skipped and classified `UNVERIFIED`, never `MISMATCH`.

The unit test deliberately changes one Front direct input and verifies that `findUnifiedInputMismatches` returns that exact cell and its provenance. The integration test recalculates every manifest case in the Engine and verifies positions 1–7, family routing, input match, Front F7/AB31 provenance, all seven Main transfer traces, AA18 row-sum identity, and the status ledger.
