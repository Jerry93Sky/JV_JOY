# JV preview API contract (PR_14A)

## Request

`POST /api/jv/orders/calculate-preview`

Authentication: `Authorization: Bearer <BMS JWT>`. Role: `OWNER` or `ADMIN` (existing BMS JWT role authorization). Content type: `application/json`. Maximum JSON body: 256 KiB.

```json
{
  "orderId": "quote-2026-0001",
  "profile": "COMPLETATION",
  "rulesVersion": "JV-UNIFIED-ORDER-PR13E-1",
  "priceSnapshotVersion": "JV-PR13E-COMPLETATION-EXCEL16",
  "positions": [
    {
      "id": "opening-1",
      "slot": 1,
      "family": "LINE",
      "quantity": "2",
      "calculation": {
        "input": { "...": "family input matching the shared JV Line contract" },
        "settings": { "...": "server-versioned settings; must match selected provider" }
      }
    }
  ]
}
```

`orderId` is optional and limited to 120 characters; if omitted, the server uses a generated correlation ID. Position IDs must be unique. A request may include one to seven positions, with unique Excel slots 1–7. `quantity` is a positive integer decimal string (`1`–`999999`). Dimensions and other decimal inputs are decimal strings; millimetre fields are named `widthMm`, `heightMm`, and where present `depthMm`.

`family` is a discriminator from the shared `UnifiedPositionInput` union: `LINE`, `ZIGZAG`, `SLIDER_L3`, `SLIDER_L5`, `SLIDER_X3`, `SLIDER_X5`, or `FRONT`. The `calculation` member follows the corresponding family shape in `packages/shared/src/jv/unified-order.ts`, without provider-owned snapshot fields. Current server-accepted request shapes and settings are recorded in the profile provider JSON. Extra, missing, incorrectly typed, or formula-like fields are rejected.

Clients must not submit `mainDiscount`, price snapshots, prices, formula strings, source provenance, or editable coefficient/settings objects. The server injects the snapshots and Main discount/markup/divisor settings after validation. `priceSnapshotVersion` may be omitted to select the current provider for the explicitly requested profile; when sent, it must equal that profile's provider ID. `rulesVersion` is required and must match exactly.

## Success response

HTTP 200 returns:

```json
{
  "correlationId": "<generated UUID>",
  "orderId": "quote-2026-0001",
  "profile": "COMPLETATION",
  "engineVersion": "JV-UNIFIED-ORDER-1",
  "versions": {
    "rules": "JV-UNIFIED-ORDER-PR13E-1",
    "provider": "JV-PR13E-COMPLETATION-EXCEL16",
    "workbook": "JV-комплектация 08.10.2026.xlsm",
    "workbookSha256": "<64 lowercase hexadecimal characters>",
    "familyPriceSnapshots": { "LINE": "<snapshot version>" }
  },
  "status": "COMPLETE",
  "calculation": {
    "status": "COMPLETE",
    "positions": [],
    "bom": [],
    "sharedResources": {},
    "trace": [],
    "diagnostics": [],
    "limitations": [],
    "totalSalePrice": { "numerator": "...", "denominator": "..." }
  }
}
```

The full `calculation` value is the existing unified Engine result, including per-position family calculation details, geometry, BOM/specification, supported commercial subtotals, order context, diagnostics, limitations, and trace. Rational monetary and dimension values remain `{ numerator, denominator }` string pairs; they are never converted to JavaScript `Number`. Internal Maps/Sets are emitted as entry/value arrays.

## PARTIAL

An Engine `PARTIAL` result also returns HTTP 200 with confirmed positions, BOM, subtotals, trace, diagnostics, and limitations. `totalSalePrice` is absent. The API does not coerce incomplete calculations to 500 or publish a final price. A validation or invariant error is not reclassified as PARTIAL.

## Error responses

- `400 INVALID_REQUEST`, `INVALID_CALCULATION_INPUT`, `INVALID_DECIMAL`, or `INVALID_QUANTITY`: malformed request or unsupported input shape. Structured `issues` identify paths, without echoing input values.
- `401` / `403`: existing BMS authentication/authorization response.
- `409 RULE_VERSION_MISMATCH`, `PRICE_PROFILE_MISMATCH`, or unavailable provider/settings: requested server version is not available for that profile.
- `422`: a validated request violates an Engine input requirement (for example missing/invalid construction prerequisites).
- `503 PRICE_CATALOG_UNAVAILABLE`: the selected server catalog does not contain a price required by an otherwise valid calculation. The caller must not substitute client prices.
- `500 JV_CALCULATION_FAILED`: unexpected software fault; response contains a correlation ID and no stack trace.

No preview endpoint operation creates or modifies a Deal, DealSystem, product, or price record.
