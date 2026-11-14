export default function FormulaHints() {
  return (
    <div className="space-y-6 max-w-2xl text-sm">
      <div className="border rounded-lg p-4 space-y-3">
        <h3 className="font-semibold">Арифметические операции</h3>
        <div className="space-y-1 font-mono text-xs">
          <div className="flex gap-4"><span className="text-muted-foreground w-32">Сложение</span><span>width + 100</span></div>
          <div className="flex gap-4"><span className="text-muted-foreground w-32">Вычитание</span><span>height - 50</span></div>
          <div className="flex gap-4"><span className="text-muted-foreground w-32">Умножение</span><span>width * count</span></div>
          <div className="flex gap-4"><span className="text-muted-foreground w-32">Деление</span><span>area / 1000000</span></div>
          <div className="flex gap-4"><span className="text-muted-foreground w-32">Остаток</span><span>width % 100</span></div>
          <div className="flex gap-4"><span className="text-muted-foreground w-32">Степень</span><span>width ** 2</span></div>
          <div className="flex gap-4"><span className="text-muted-foreground w-32">Скобки</span><span>(width + 50) * 2</span></div>
        </div>
      </div>

      <div className="border rounded-lg p-4 space-y-3">
        <h3 className="font-semibold">Условия: if(условие, если_да, если_нет)</h3>
        <div className="space-y-2 font-mono text-xs">
          <div>
            <div className="text-muted-foreground mb-0.5">Простое условие:</div>
            <div>if(width &gt; 1000, width * 2, width)</div>
          </div>
          <div>
            <div className="text-muted-foreground mb-0.5">Вложенное условие:</div>
            <div>if(count &gt; 5, price * 0.9, if(count &gt; 3, price * 0.95, price))</div>
          </div>
          <div>
            <div className="text-muted-foreground mb-0.5">Операторы сравнения:</div>
            <div className="text-muted-foreground">{'== != < > <= >='}</div>
          </div>
          <div>
            <div className="text-muted-foreground mb-0.5">Логические операторы:</div>
            <div>if(width &gt; 500 &amp;&amp; height &gt; 500, 2, 1)</div>
            <div>if(type == 'A' || type == 'B', 10, 5)</div>
          </div>
        </div>
      </div>

      <div className="border rounded-lg p-4 space-y-3">
        <h3 className="font-semibold">Встроенные функции</h3>
        <div className="space-y-1 font-mono text-xs">
          <div className="flex gap-4"><span className="text-muted-foreground w-40">round(x, знаков)</span><span>round(width / 3, 2)</span></div>
          <div className="flex gap-4"><span className="text-muted-foreground w-40">floor(x)</span><span>floor(height / 100)</span></div>
          <div className="flex gap-4"><span className="text-muted-foreground w-40">ceil(x)</span><span>ceil(area / 500)</span></div>
          <div className="flex gap-4"><span className="text-muted-foreground w-40">min(a, b)</span><span>min(width, 2000)</span></div>
          <div className="flex gap-4"><span className="text-muted-foreground w-40">max(a, b)</span><span>max(height, 500)</span></div>
          <div className="flex gap-4"><span className="text-muted-foreground w-40">abs(x)</span><span>abs(width - 1000)</span></div>
          <div className="flex gap-4"><span className="text-muted-foreground w-40">sqrt(x)</span><span>sqrt(area)</span></div>
        </div>
      </div>

      <div className="border rounded-lg p-4 space-y-3">
        <h3 className="font-semibold">Примеры реальных формул</h3>
        <div className="space-y-3 text-xs">
          <div>
            <div className="text-muted-foreground mb-1">Количество профиля (мм → шт по 6м):</div>
            <div className="font-mono bg-muted rounded p-2">ceil((width * 2 + height * sections) / 6000)</div>
          </div>
          <div>
            <div className="text-muted-foreground mb-1">Площадь остекления (м²):</div>
            <div className="font-mono bg-muted rounded p-2">round(width * height / 1000000, 3)</div>
          </div>
          <div>
            <div className="text-muted-foreground mb-1">Количество секций с учётом типа:</div>
            <div className="font-mono bg-muted rounded p-2">if(type == 'double', sections * 2, sections)</div>
          </div>
          <div>
            <div className="text-muted-foreground mb-1">Длина уплотнителя с запасом 10%:</div>
            <div className="font-mono bg-muted rounded p-2">round((width * 2 + height * 2) * sections * 1.1, 0)</div>
          </div>
        </div>
      </div>
    </div>
  )
}
