# Front commercial rules — PR_12B3

Both original books use F1!S38 = IF($I$23=\"ОШИБКА!\",$I$23,SUM($S$36:$S$37)). I23 is calculated from I17:I22; the existing geometry calculator rejects the error branch. S36 is the material subtotal S33 plus glass/finish S35, paint S34, and the conditional C25×Y5 additional service; S37 is the independently gated installation charge. No extra S38 rounding is present.

The active Front selector maps Главная!F11/G11 to system slot 7. Главная!X11 = F1!S38/Настройки!D14; Y11 selects X11 through INDEX(R11:X11,G11) and applies Настройки!D21; AA11 multiplies Y11 by Z11 and (100+Настройки!D19)/100. The captured source settings have D19=D21=0; D14 is profile dependent (completion 1, retail 0.5). These factors are applied once in the transfer.

calculateFrontCommercial composes raw FrontInput with the matching profile snapshot and order-area context. Finishing D32 is a scenario input, not a constant from the workbook snapshot. Unsupported glass-off remains PARTIAL. An expected MISSING_INPUT from incomplete order context is converted by calculateFrontCommercial to structured PARTIAL with a concrete diagnostic; S33 and trace are retained where available, while S38 and Main transfer amounts are omitted. Invalid decimal, profile mismatch and other errors remain explicit.

Parity compares seven terminal/intermediate outputs per each of eight scenarios. EXACT compares rational value with decimal Excel Value2; DISPLAY_MATCH compares formatting at the source NumberFormat precision without epsilon. Main transfer display checks pass, but they are not internal numeric equality. Other snapshot cells are not claimed as covered.
