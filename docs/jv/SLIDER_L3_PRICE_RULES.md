# JV-Slider-L3 price and commercial rules

Source workbooks: `JV-комплектация 08.10.2026.xlsm` and `JV-розница 08.10.2026.xlsm`. Workbook hashes and versioned source-literal prices are stored in `fixtures/slider-l3-price-snapshots.json`. Captures were made using Excel 16 `CalculateFullRebuild` on temporary copies.

## Material cost

For each applicable material row `r`, Excel uses `S1!Mᵣ=S1!Lᵣ*S1!Kᵣ`. The engine maps `Kᵣ` to the existing Slider-L3 BOM output and obtains catalog literals from the matching workbook's `Прайс-Slider!E` column. Price transformations confirmed by the S1 L-column formulas:

- Rows 5–13: catalog price divided by `Настройки!D4`.
- Rows 14 and 18: catalog price multiplied by `Настройки!S26` only when the existing interlock input is enabled; otherwise multiplier 1.
- Rows 33–35: catalog price divided by `Настройки!L8`.
- Other charged rows use the corresponding catalog literal without an invented factor.
- S1 rows 43 and 45 remain visible in BOM, but their M-cost is not added independently: their source label/relationship says the cost is included in related items. They are not removed from the specification.
- `S1!M47=SUM(M5:M46)` is calculated from closed priced lines.

The snapshots have independent price-profile IDs and raw source literals. No calculated workbook cache is used as a unit-price constant.

## Glass and added work

`C47` and `C48` use the resolved `D20`, `D24`, and `D26` selectors and side/leaf count. `C49=D5-C47-C48`. For selector `C12`, the rate is `INDEX('Прайс-Стекло'!D5:D16,C12)`:

- `D47=rate*Настройки!L17*D43*D44/1,000,000`
- `D48=rate*Настройки!L18*D43*D44/1,000,000`
- `D49=rate*D43*D44/1,000,000`
- `D50=C47*D47+C48*D48+C49*D49`
- `D53=D50+Прайс-сб+монт!C23*T5`
- `M49=IF(Настройки!D32,D53,0)`

The three glazing rates remain separate: edge/treated, lock-count, and remaining panes. Engine trace keeps each component separate.

## Painting, services, and total

- `R5:R21=K5:K21*'Прайс-Slider'!G5:G21` for the supported paint quantity rows. `R22=SUM(R5:R21)*IF(C11=4,Настройки!L11,1)`.
- `R23=Настройки!L9*Настройки!L10*T5`.
- `R24=MAX(R13:R23)` and `R26='Прайс-сб+монт'!C24*T5`; `R27=R24+R26`.
- `M48=IF(C11<>1,R27,0)`. It is painting-related and is not the glass amount.
- `M50=IF(D33,C7*D3/1000,0)+IF(L3,K29*C19,0)`.
- `M51=SUM(M47:M50)+IF(Главная!F28=2,C25*T5,0)`.
- `M52=IF(D34,D3*C14/1000+D5*D4*C15/1000,0)`.
- `M53=IF(D6<=2,SUM(M51:M52),"ОШИБКА !")`.

## Order consumables and factors

`ПРМ!U25:W31` link to `Главная!C11:D17` and `Z11:Z17`. For row 25–31, `AA=IFERROR(U*V*W/1,000,000,0)`, `AA32=SUM(AA25:AA31)`, `AB25=IFERROR(AA25/(AA32*W25),0)`, and `S1!T5=ПРМ!AB25`.

Glue/activator consumption is order-scoped, not a minimum package per construction. For the two seven-slot groups, Excel computes `N=IFERROR(L*M,0)`, group pack count `IF(ROUNDUP(SUM(N group),0)>1,ROUNDUP(SUM(N group),0),1)`, then `O=packCount/SUM(N group)`. S1 `M40` and `M41` multiply their base material amount by `O5` and `O18`. When a denominator is zero, the source O formula errors; the engine returns a typed error rather than inventing a factor.

## Precision

The engine retains exact decimal inputs and rational intermediate values without monetary rounding. The Excel NumberFormat is used only by the parity comparator to classify display agreement. It does not alter calculation output. `EXACT`, `DISPLAY_MATCH`, `MISMATCH`, and `UNVERIFIED` remain distinct statuses.
