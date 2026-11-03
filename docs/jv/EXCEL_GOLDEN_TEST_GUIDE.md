# Excel golden recalculation guide (Windows with desktop Excel)

Never use the source workbook directly. Make a disposable copy of the requested workbook. This procedure does not run macros: open with macros disabled, set `Application.AutomationSecurity = msoAutomationSecurityForceDisable`, set `EnableEvents = False`, set calculation to automatic, apply input cell overrides from the case JSON, then `CalculateFullRebuild`. Save the copied workbook and export listed cell values plus formula text, input overrides, workbook SHA256 and Excel version.

For current Line parking block, candidate cells to capture are Главная C11/D11/J11/K11/L11 and M11, L1 D3:D8, C21/C23:C25, D21:D22, D23:D24, I21:I27, C28:D32, O15, and Настройки P2:P15 cells referenced by formulas. This is an inventory only; complete input schema and scenario boundaries still require mapping. Keep values/units as shown, do not invent them.

Comparison harness must map each engine trace rule to workbook/sheet/cell and compare exact decimal text only after explicit Excel serialization policy is defined. Record mismatches with source formula, engine inputs, result status and dependency trace. Mark result `verified_excel_oracle` only after independent recalculation and reviewer confirmation; caches remain `cached_unverified`.

No Excel COM executable is available in the current agent environment. For manual user-side recalculation, use the copied workbook, force full recalc (Ctrl+Alt+F9), save, and export target cells. Do not enable/execute VBA.
