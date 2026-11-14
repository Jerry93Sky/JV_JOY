"""Extract only source literals and blanks from the two original Front price books."""
import hashlib
import json
import pathlib
import warnings
import openpyxl

warnings.filterwarnings('ignore', category=UserWarning, module='openpyxl')
ROOT = pathlib.Path(__file__).resolve().parents[2]
SOURCE = ROOT.parent
OUTPUT = ROOT / 'docs/jv/fixtures/front-commercial-component-snapshots.json'

def raw(sheet, address):
    cell = sheet[address]
    value = cell.value
    if value is None:
        text = ''
    elif isinstance(value, bool):
        text = 'TRUE' if value else 'FALSE'
    elif isinstance(value, (int, float)):
        text = str(value)
    else:
        raise ValueError(f'Formula-backed source requires a rule: {sheet.title}!{address} = {value}')
    return {'value': text, 'sourceCell': f'{sheet.title}!{address}', 'sourceFormula': text}

sources = []
for profile, filename in [('COMPLETATION', 'JV-комплектация 08.10.2026.xlsm'), ('RETAIL', 'JV-розница 08.10.2026.xlsm')]:
    path = SOURCE / filename
    sha = hashlib.sha256(path.read_bytes()).hexdigest()
    book = openpyxl.load_workbook(path, read_only=True, data_only=False)
    glass = book['Прайс-Стекло']
    front = book['Прайс-Front']
    service = book['Прайс-сб+монт']
    settings = book['Настройки']
    base = json.loads((ROOT / 'docs/jv/fixtures/front-material-price-snapshots.json').read_text(encoding='utf-8'))['sources']
    material = next(x for x in base if x['profile'] == profile)
    assert material['workbookSha256'] == sha
    sources.append({**material, 'version': f'FRONT-COMPONENT-{profile}-{sha[:12]}',
                    'glassRates': {str(i): raw(glass, f'D{i + 4}') for i in range(1, 13)},
                    'assemblyRates': {str(i): raw(front, f'F{i}') for i in range(5, 19)},
                    'paintRates': {str(i): raw(front, f'G{i}') for i in range(5, 19)},
                    'serviceRates': {key: raw(service, key) for key in ('C16', 'C17', 'C18', 'C23', 'C24', 'C25')},
                    'settings': {**material['settings'], **{key: raw(settings, key) for key in ('L17', 'L18', 'L9', 'L10', 'L11', 'D32', 'D34')}}})
    book.close()
OUTPUT.write_text(json.dumps({'schemaVersion': '1.0', 'sources': sources}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(OUTPUT)
