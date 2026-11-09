# JV backend security notes (PR_14A)

PR_14B retained the `OWNER`/`ADMIN` route policy while allowing the middleware to type-check both the existing shared Role enum and the generated Prisma Role enum. HTTP authorization behavior is covered by the JV API tests and live startup smoke; no broader role was granted access.

## Controls in this implementation

- Uses the existing Fastify plugin setup, JWT verification, and `requireRole` middleware. Only BMS `OWNER` and `ADMIN` roles may run a preview or receive its trace/pricing details.
- Uses a strict Zod envelope with a seven-family discriminated union, unique IDs/slots, bounded request size, decimal-string validation, positive quantities and dimensions, and strict nested shape checking against the selected profile provider.
- Rejects injected price/snapshot fields, extra properties, formulas beginning with `=`, invalid profile/provider combinations, and unsupported ruleset versions.
- Compares client settings, calculation coefficients, and provenance fields with the selected server-owned provider shape. The client cannot replace a price snapshot or edit the profile's locked settings.
- Derives Front shared order area inputs from the submitted positions, and resets Front's Main discount/markup/quantity and internal divisor from server-side sources. This prevents a caller from supplying a fabricated set of other positions or price-transfer controls.
- Does not log request bodies. Unexpected errors are logged with the request correlation and error type only; no stack or error details are returned to the client.
- Does not save requests, inputs, or results to Prisma. No schema, migrations, or production database are involved.

## Authorization model and limits

The existing BMS role model only has OWNER, ADMIN, USER, and GUEST; there is no separate quote permission. Since the response includes internal source prices and full calculation provenance, PR_14A conservatively requires OWNER or ADMIN. No tenant/organization claim is present in the existing JWT shape, so the route does not infer tenant scope. A dedicated permission and organization boundary should be introduced through the BMS authorization design before broad sales-role exposure.

Snapshots are selected solely by the explicit COMPLETATION/RETAIL profile from versioned server JSON. The endpoint never falls back between profiles. Provider release changes are repository-controlled and require updating the snapshot provenance/version; callers cannot select arbitrary workbook hashes or prices.

## Follow-up controls

- Move the currently static, confirmed catalog snapshots into a reviewed price-management lifecycle before business users can update prices.
- Add a dedicated BMS permission for quote calculation and trace visibility if USER accounts need this endpoint.
- Add tenant authorization if/when BMS JWTs and data model gain an organization context.
- Add rate limiting at the shared API gateway before high-volume external exposure.
