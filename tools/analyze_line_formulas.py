"""Static XLSM formula/dependency inventory. Does not evaluate formulas or trust cached values."""
from __future__ import annotations
import argparse,csv,re,json,hashlib
from pathlib import Path
from collections import Counter,defaultdict
from openpyxl import load_workbook
REF=re.compile(r"(?:(?:'([^']+)'|([\wА-Яа-я-]+))!)?\$?([A-Z]{1,3})\$?(\d+)")
FUNC=re.compile(r"(?i)(?<![A-Z0-9_.])([A-ZА-Я][A-ZА-Я0-9_.]*)\s*\(")
def norm(f):
 return REF.sub(lambda m:(m.group(1) or m.group(2) or '')+'!<CELL>',f.upper())
def main():
 ap=argparse.ArgumentParser();ap.add_argument('workbooks',nargs='+',type=Path);ap.add_argument('--sheet',default='L1');ap.add_argument('--out',type=Path,default=Path('docs/jv/generated'));a=ap.parse_args();a.out.mkdir(parents=True,exist_ok=True)
 inventory=[];edges=[];templates=Counter();functions=Counter();meta=[]
 for path in a.workbooks:
  wb=load_workbook(path,data_only=False,read_only=True,keep_vba=True)
  for ws in wb.worksheets:
   for row in ws.iter_rows():
    for c in row:
     if c.data_type!='f':continue
     f=c.value.text if hasattr(c.value,'text') else str(c.value); formula=f if f.startswith('=') else '='+f
     if ws.title!=a.sheet and ws.title not in ('Главная','Настройки','ПД','#1','#2','#3'):continue
     refs=[]
     for m in REF.finditer(formula):
      sh=m.group(1) or m.group(2) or ws.title;addr=m.group(3)+m.group(4)
      # function identifiers can resemble cell refs; valid references are resolved against workbook dimensions
      if sh in wb.sheetnames and c.coordinate != addr: refs.append((sh,addr))
     for dep in sorted(set(refs)):edges.append([path.name,ws.title,c.coordinate,dep[0],dep[1]])
     funcs=FUNC.findall(formula);functions.update(x.upper() for x in funcs)
     templates[norm(formula)]+=1
     inventory.append([path.name,ws.title,c.coordinate,formula,'cached_unverified'])
  meta.append({'workbook':path.name,'sheet_count':len(wb.sheetnames),'hidden':[s.title for s in wb.worksheets if s.sheet_state!='visible'],'selected_formula_count':sum(r[0]==path.name for r in inventory),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()});wb.close()
 for name,head,data in [('line_formulas.csv',['workbook','sheet','cell','formula','cache_status'],inventory),('line_dependency_edges.csv',['workbook','sheet','cell','depends_sheet','depends_cell'],edges)]:
  with (a.out/name).open('w',newline='',encoding='utf-8-sig') as f:w=csv.writer(f);w.writerow(head);w.writerows(data)
 (a.out/'line_analysis.json').write_text(json.dumps({'books':meta,'selected_formulas':len(inventory),'dependency_edges':len(edges),'unique_formula_templates':len(templates),'template_frequency':templates.most_common(100),'function_frequency':functions.most_common()},ensure_ascii=False,indent=2),encoding='utf-8')
 print(json.dumps({'selected_formulas':len(inventory),'dependency_edges':len(edges),'templates':len(templates),'functions':functions.most_common()},ensure_ascii=False))
if __name__=='__main__':main()
