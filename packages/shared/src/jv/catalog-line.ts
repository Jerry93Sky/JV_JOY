export const LINE_MATERIAL_CATALOG_VERSION = 'JV-LINE-CATALOG-2026-10-08' as const
export type LineCatalogCategory = 'material' | 'component'
export interface LineMaterialCatalogEntry {
  readonly sourceL1Row: number
  readonly catalogRow: number
  readonly sku: string
  readonly description: string
  readonly unit: string
  readonly category: LineCatalogCategory
  readonly quantityFormula?: string
  readonly quantityConstant?: string
}

/** Identifiers copied from the two original Прайс-Line sheets; price columns are deliberately excluded. */
export const LINE_MATERIAL_CATALOG: readonly LineMaterialCatalogEntry[] = Object.freeze([
  Object.freeze({ sourceL1Row: 5, catalogRow: 5, sku: "LN-010", description: "Профиль несущий", unit: "п.м", category: "material", quantityFormula: "=$D$32/1000+Настройки!$D$7/1000", quantityConstant: undefined }),
  Object.freeze({ sourceL1Row: 6, catalogRow: 6, sku: "LN-020", description: "Профиль створочный верхний", unit: "п.м", category: "material", quantityFormula: "=$F$39/1000+Настройки!$D$6/1000", quantityConstant: undefined }),
  Object.freeze({ sourceL1Row: 7, catalogRow: 7, sku: "LN-030", description: "Профиль створочный нижний", unit: "п.м", category: "material", quantityFormula: "=$F$39/1000+Настройки!$D$6/1000", quantityConstant: undefined }),
  Object.freeze({ sourceL1Row: 8, catalogRow: 8, sku: "LN-040", description: "Профиль боковой", unit: "п.м", category: "material", quantityFormula: "=IF($D$15=\"ДА\", 2*$D$33/1000+Настройки!$D$8/1000, 0)", quantityConstant: undefined }),
  Object.freeze({ sourceL1Row: 9, catalogRow: 9, sku: "LN-050-L", description: "Тройник левый", unit: "шт.", category: "component", quantityFormula: "=IF(OR($D$7=\"НАЛЕВО\",$D$6=2),1,0)", quantityConstant: undefined }),
  Object.freeze({ sourceL1Row: 10, catalogRow: 10, sku: "LN-050-R", description: "Тройник правый", unit: "шт.", category: "component", quantityFormula: "=IF(OR($D$7=\"НАПРАВО\",$D$6=2),1,0)", quantityConstant: undefined }),
  Object.freeze({ sourceL1Row: 11, catalogRow: 11, sku: "LN-060", description: "Роликовая каретка низкая", unit: "шт.", category: "component", quantityFormula: "=$D$5-$D$6", quantityConstant: undefined }),
  Object.freeze({ sourceL1Row: 12, catalogRow: 12, sku: "LN-070-A", description: "Роликовая каретка высокая", unit: "шт.", category: "component", quantityFormula: "=$O$11-$O$13-$O$14", quantityConstant: undefined }),
  Object.freeze({ sourceL1Row: 13, catalogRow: 13, sku: "LN-070-B", description: "Роликовая каретка c карманом", unit: "шт.", category: "component", quantityFormula: "=IF($D$23=\"ДА\",1,IF(OR($D$23=\"ОШИБКА\",$D$24=\"ОШИБКА\"),\"ОШИБКА\",0))", quantityConstant: undefined }),
  Object.freeze({ sourceL1Row: 14, catalogRow: 14, sku: "LN-070-C", description: "Роликовая каретка с вилкой", unit: "шт.", category: "component", quantityFormula: "=IF(   OR($D$24=\"OK\",$D$24=\"- - -\"),    IF(AND($D$23=\"ДА\",$D$6=1),$D$5-$C$24,0)+IF(AND($D$23=\"ДА\",$D$6=2),$D$5-$C$24-1,0),  \"ОШИБКА\")", quantityConstant: undefined }),
  Object.freeze({ sourceL1Row: 15, catalogRow: 15, sku: "LN-080", description: "Защёлка боковая", unit: "шт.", category: "component", quantityFormula: "=IF($D$23=\"НЕТ\",$D$6+2,0) + IF(AND($D$23=\"ДА\",$D$6=1),INDEX(ПД!$D$5:$BA$54,$D$5,$C$24),0) + IF(AND($D$23=\"ДА\",$D$6=2),INDEX(ПД!$D$61:$BA$110,$D$5,$C$24),0)", quantityConstant: undefined }),
  Object.freeze({ sourceL1Row: 16, catalogRow: 16, sku: "LN-090", description: "Защёлка продольная", unit: "шт.", category: "component", quantityFormula: "=IF($D$23=\"НЕТ\",$D$5-1-$D$6,0) + IF(AND($D$23=\"ДА\",$D$6=1),INDEX(ПД!D117:BA166,$D$5,$C$24),0) + IF(AND($D$23=\"ДА\",$D$6=2),INDEX(ПД!D173:BA222,$D$5,$C$24),0)", quantityConstant: undefined }),
  Object.freeze({ sourceL1Row: 17, catalogRow: 17, sku: "LN-100", description: "Ответная втулка защёлки", unit: "шт.", category: "component", quantityFormula: "=$O$15+$O$16+IF($D$17=\"ДА\",$D$6,0)", quantityConstant: undefined }),
  Object.freeze({ sourceL1Row: 18, catalogRow: 18, sku: "LN-110", description: "Ручка-кноб", unit: "шт.", category: "component", quantityFormula: "=IF($D$16=\"ДА\",$D$6,0)", quantityConstant: undefined }),
  Object.freeze({ sourceL1Row: 19, catalogRow: 19, sku: "LN-120", description: "Поворотный узел нижний (комплект)", unit: "комплект", category: "component", quantityFormula: "=IF($D$20=\"ДА\",  0,  $D$6)", quantityConstant: undefined }),
  Object.freeze({ sourceL1Row: 20, catalogRow: 20, sku: "LN-130", description: "Поворотный узел верхний (комплект)", unit: "комплект", category: "component", quantityFormula: "=O19", quantityConstant: undefined }),
  Object.freeze({ sourceL1Row: 21, catalogRow: 21, sku: "LN-140-L", description: "Отсекатель левый", unit: "шт.", category: "component", quantityFormula: "=IF(OR($D$7=\"НАЛЕВО\",$D$6=2),1,0)", quantityConstant: undefined }),
  Object.freeze({ sourceL1Row: 22, catalogRow: 22, sku: "LN-140-R", description: "Отсекатель правый", unit: "шт.", category: "component", quantityFormula: "=IF(OR($D$7=\"НАПРАВО\",$D$6=2),1,0)", quantityConstant: undefined }),
  Object.freeze({ sourceL1Row: 23, catalogRow: 23, sku: "LN-150", description: "Пластина соединительная", unit: "шт.", category: "component", quantityFormula: "=3*$D$6", quantityConstant: undefined }),
  Object.freeze({ sourceL1Row: 24, catalogRow: 24, sku: "LN-160", description: "Пластина соединительная 90 гр.", unit: "шт.", category: "component", quantityFormula: "=$D$6*IF($D$9=90,1,0)", quantityConstant: undefined }),
  Object.freeze({ sourceL1Row: 25, catalogRow: 25, sku: "LN-170", description: "Пластина соединительная 135 гр.", unit: "шт.", category: "component", quantityFormula: "=$D$6*IF($D$9=135,1,0)", quantityConstant: undefined }),
  Object.freeze({ sourceL1Row: 26, catalogRow: 27, sku: "LN-190", description: "Верхняя ось паркуемой двери", unit: "шт.", category: "component", quantityFormula: "=$O$13", quantityConstant: undefined }),
  Object.freeze({ sourceL1Row: 27, catalogRow: 28, sku: "LN-200", description: "Рамка", unit: "шт.", category: "component", quantityFormula: "=$O$13", quantityConstant: undefined }),
  Object.freeze({ sourceL1Row: 28, catalogRow: 29, sku: "LN-TL", description: "Заглушка верхняя рядовая левая", unit: "шт.", category: "component", quantityFormula: "=IF($D$7=\"НАЛЕВО\",2*$D$5-2,0)+IF(AND($D$7=\"ДВУХСТОР\",$D$5<=3),2,0)+IF(AND($D$7=\"ДВУХСТОР\",$D5>3),2*($D$5-2),0)", quantityConstant: undefined }),
  Object.freeze({ sourceL1Row: 29, catalogRow: 30, sku: "LN-TR", description: "Заглушка верхняя рядовая правая", unit: "шт.", category: "component", quantityFormula: "=IF($D$7=\"НАПРАВО\",2*$D$5-2,0)+IF(AND($D$7=\"ДВУХСТОР\",$D$5=2),2,0)+IF($D$7=\"ДВУХСТОР\",2*$D5-2-$O$28)", quantityConstant: undefined }),
  Object.freeze({ sourceL1Row: 30, catalogRow: 31, sku: "LN-TF", description: "Заглушка верхняя боковая плоская", unit: "шт.", category: "component", quantityFormula: "=IF($D$15=\"ДА\",0,2)", quantityConstant: undefined }),
  Object.freeze({ sourceL1Row: 31, catalogRow: 32, sku: "LN-TSL", description: "Заглушка верхняя боковая левая", unit: "шт.", category: "component", quantityFormula: "=IF($D$15=\"ДА\",1,0)", quantityConstant: undefined }),
  Object.freeze({ sourceL1Row: 32, catalogRow: 33, sku: "LN-TSR", description: "Заглушка верхняя боковая правая", unit: "шт.", category: "component", quantityFormula: "=IF($D$15=\"ДА\",1,0)", quantityConstant: undefined }),
  Object.freeze({ sourceL1Row: 33, catalogRow: 34, sku: "LN-BL", description: "Заглушка нижняя рядовая левая", unit: "шт.", category: "component", quantityFormula: "=$O$28", quantityConstant: undefined }),
  Object.freeze({ sourceL1Row: 34, catalogRow: 35, sku: "LN-BR", description: "Заглушка нижняя рядовая правая", unit: "шт.", category: "component", quantityFormula: "=$O$29", quantityConstant: undefined }),
  Object.freeze({ sourceL1Row: 35, catalogRow: 36, sku: "LN-BF", description: "Заглушка нижняя боковая плоская", unit: "шт.", category: "component", quantityFormula: "=$O$30", quantityConstant: undefined }),
  Object.freeze({ sourceL1Row: 36, catalogRow: 37, sku: "LN-BSL", description: "Заглушка нижняя боковая левая", unit: "шт.", category: "component", quantityFormula: "=$O$31", quantityConstant: undefined }),
  Object.freeze({ sourceL1Row: 37, catalogRow: 38, sku: "LN-BSR", description: "Заглушка нижняя боковая правая", unit: "шт.", category: "component", quantityFormula: "=$O$32", quantityConstant: undefined }),
  Object.freeze({ sourceL1Row: 38, catalogRow: 39, sku: "LN-T90", description: "Заглушка верхняя 90 гр. (пара)", unit: "пара", category: "component", quantityFormula: "=$D$8*IF($D$9=90,1,0)", quantityConstant: undefined }),
  Object.freeze({ sourceL1Row: 39, catalogRow: 40, sku: "LN-B90", description: "Заглушка нижняя 90 гр. (пара)", unit: "пара", category: "component", quantityFormula: "=O38", quantityConstant: undefined }),
  Object.freeze({ sourceL1Row: 40, catalogRow: 41, sku: "LN-210", description: "Верхняя петля + 2 башмака + винты (комплект)", unit: "шт.", category: "component", quantityFormula: undefined, quantityConstant: "0" }),
  Object.freeze({ sourceL1Row: 41, catalogRow: 42, sku: "LN-220", description: "Нижняя петля + 2 башмака + винты (комплект)", unit: "шт.", category: "component", quantityFormula: undefined, quantityConstant: "0" }),
  Object.freeze({ sourceL1Row: 42, catalogRow: 43, sku: "LN-230", description: "Замок в пол (комплект)", unit: "шт.", category: "component", quantityFormula: "=IF( $D$19=\"ДА\",1,0  )", quantityConstant: undefined }),
  Object.freeze({ sourceL1Row: 43, catalogRow: 44, sku: "LN-240", description: "Башмак для напольного доводчика", unit: "шт.", category: "component", quantityFormula: "=IF( $D$20=\"ДА\",$D$6,0  )", quantityConstant: undefined }),
  Object.freeze({ sourceL1Row: 44, catalogRow: 45, sku: "AA-010", description: "Полосовая щётка, 1,6 м", unit: "шт.", category: "component", quantityFormula: "=ROUNDUP(  2*$O$7 / (Настройки!$L$7 * Настройки!$P$21/1000),0)", quantityConstant: undefined }),
])

export const LINE_MATERIAL_CATALOG_SOURCES = Object.freeze({
  COMPLETATION: 'JV-комплектация 08.10.2026.xlsm',
  RETAIL: 'JV-розница 08.10.2026.xlsm',
})
