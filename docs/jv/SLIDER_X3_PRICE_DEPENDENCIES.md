# Slider-X3: commercial dependency map for PR_11H

The X3 route is confirmed by the selector capture in both original books: `Главная!F11=5 -> G11=3 -> S1!A3=1`; `S1!M53=IF(D6<=2,SUM(M51:M52),"ОШИБКА !")`; `Главная!T11='S1'!M53/Настройки!D13`; `Главная!Y11=INDEX(R11:X11,G11)*(100+Настройки!D21)/100`. The capture contains recalculated X3 M53 values, but no X3 engine price result has been compared. The commercial API is therefore **not implemented** for X3.

The following are source dependencies to close, not permission to reuse L5 prices or amounts unchanged:

1. Material amounts `S1!M5:M42` require X3 quantities K5:K42 and their row-specific `S1!L5:L42` prices. The price source is `Прайс-Slider!E5:E43` with source divisors and switches (`Настройки!D4`, `L8`, `S26`, `S1!D28`). X3 active rows differ from L3/L5, especially E9/E13 and X caps/carriages/latches.
2. Glass, paint and processing, extra work, assembly and installation feed `S1!M47:M52` through their own `S1`, `Прайс-Стекло`, `Прайс-сб+монт` and `Прайс-Slider` rules. The existing L5 commercial graph documents common candidates; their X3 branches and snapshot mapping need source verification.
3. `S1!K40/K41` are per-construction activator/glue quantities. `S1!M40/M41` additionally depend on `Клей+акт!O5/O18`. `Клей+акт!N5:N12` and `N18:N25` aggregate quantities over seven order slots, round up to whole packages with a minimum of one, then allocate the package factor. Other nonzero order positions need their own family quantities. This context must be computed once per order.
4. `S1!T5` depends on `ПРМ!AB25`, which uses area and quantity allocation across `ПРМ!AA25:AA32` and `Главная!C11:D17/Z11:Z17`.

Until the X3 price snapshot, all active cost rows, order-wide adhesive and PRM inputs, and both-book `M53` parity are closed, any X3 commercial result must remain `PARTIAL`. The new X3 geometry/BOM exports do not call the legacy `/calculate` API or the existing L3/L5 pricing modules.
