"""Inventory original workbook formulas without loading macros or cached values.

Install openpyxl 3.1.5 and run from the repository root:
  python tools/jv/inventory-excel-coverage.py DIRECTORY_WITH_ORIGINALS
"""
import argparse
import csv
import hashlib
import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as ET

from openpyxl.formula import Tokenizer
from openpyxl.formula.tokenizer import TokenizerError
from openpyxl.formula.translate import Translator

NAMES = {
    "COMPLETATION": "JV-комплектация 08.10.2026.xlsm",
    "RETAIL": "JV-розница 08.10.2026.xlsm",
}
NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
REL = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
SLOT = re.compile(r"([LZSF])([1-7])$")
EVIDENCE = {
    "LINE_ADDITIONAL_BOM_PARITY.json": ("line-calculator.ts", "Line additional BOM, captured prices and amounts"),
    "LINE_FULL_PRICE_PARITY.json": ("line-calculator.ts", "Line price"),
    "LINE_FINAL_PRICE_PARITY.json": ("commercial-line.ts", "Line final price"),
    "ZIGZAG_PRICE_PARITY.json": ("zigzag/commercial-cost.ts", "Zigzag prices"),
    "ZIGZAG_ORDER_PR10G_PARITY.json": ("zigzag/order-calculation.ts", "Zigzag order"),
    "SLIDER_GEOMETRY_PARITY.json": ("slider/geometry.ts", "Slider L3 geometry"),
    "SLIDER_L3_BOM_PARITY.json": ("slider/bom.ts", "Slider L3 BOM"),
    "SLIDER_L5_PRICE_PARITY.json": ("slider/l5-pricing.ts", "Slider L5 price"),
    "SLIDER_X3_PRICE_PARITY.json": ("slider/l5-pricing.ts", "Slider X3 price"),
    "SLIDER_X5_PRICE_PARITY.json": ("slider/l5-pricing.ts", "Slider X5 price"),
    "FRONT_EXCEL_PARITY.json": ("front/calculator.ts", "Front geometry and materials"),
    "FRONT_COMMERCIAL_COMPONENTS_PARITY.json": ("front/commercial.ts", "Front commercial components"),
    "FRONT_MATERIAL_PRICE_PARITY.json": ("front/commercial.ts", "Front material prices"),
    "JV_UI_F28_PARITY.json": ("unified-order.ts", "F28=2, main totals and shared inputs"),
    "FRONT_SLOT7_B26_R2_PARITY.json": ("front/commercial.ts", "F7, separately measured Main B26"),
    "GLASS_OFF_ALL_SEVEN_PARITY.json": ("unified-order.ts", "glass-off fixture, limited inputs"),
    "JV_FRONT_DOOR_PARITY.json": ("front/commercial.ts", "door fixture, limited inputs"),
    "JV_F28_MODE3_EXCEL_PARITY.json": ("unified-order.ts", "F28=3 core only"),
}
FIXED_SOURCE_SHEETS = {
    "LINE_ADDITIONAL_BOM_PARITY.json": "L1", "LINE_FINAL_PRICE_PARITY.json": "L1",
    "SLIDER_GEOMETRY_PARITY.json": "S1", "SLIDER_L3_BOM_PARITY.json": "S1",
    "ZIGZAG_PRICE_PARITY.json": "Z1",

}
STATUS_ORDER = ("EXACT", "NUMERICALLY_EQUIVALENT", "DISPLAY_MATCH", "UNVERIFIED", "MISMATCH")
ROOT = Path(__file__).resolve().parents[2]
DOCS = ROOT / "docs/jv"

def records(data, profile=None):
    if isinstance(data, dict):
        profile = data.get("profile", profile)
        if profile in NAMES:
            yield profile, data
        for node in data.values():
            yield from records(node, profile)
    elif isinstance(data, list):
        for node in data:
            yield from records(node, profile)

EXPANDED_ARTIFACT = "JV_F28_MODE3_EXPANDED_PARITY.json"
EXPANDED_ENGINE = "74c9ead01616fbbcb88970b4bda838b6d01c6b2f"
EXPANDED_CODE = {
    "Главная": "unified-order.ts",
    "L": "line-calculator.ts",
    "Z": "zigzag/order-calculation.ts",
    "F": "front/commercial.ts",
}

def expanded_evidence(index, artifact):
    capture = json.loads(artifact.read_text(encoding="utf-8-sig"))
    if capture["candidate"] != EXPANDED_ENGINE:
        raise ValueError("Unexpected JV Engine revision in expanded F28 evidence")
    for case in capture["cases"]:
        profile = case["profile"]
        if profile not in NAMES:
            raise ValueError("Unexpected XLSM profile")
        mode = case["F28"]
        b26 = "blank" if case["B26"] is None else case["B26"]
        for cell in case["comparisons"]:
            sheet, address = cell["address"].rsplit("!", 1)
            code = EXPANDED_CODE[sheet[0] if SLOT.fullmatch(sheet) else sheet]
            formula = cell["excel"]["formula"]
            status = cell["status"]
            if not formula or status not in STATUS_ORDER:
                raise ValueError("Incomplete comparison at " + cell["address"])
            scope = f"{case['scenarioId']}/{cell['address']}/F28={mode}/B26={b26}/{cell['rule']}/{status}"
            index[profile, sheet, address, formula].add((EXPANDED_ARTIFACT, code, scope, status))

def evidence_index(expanded_path=None):
    index = defaultdict(set)
    for filename, (code, scope) in EVIDENCE.items():
        artifact = DOCS / filename
        if not artifact.exists():
            if filename != "JV_F28_MODE3_EXCEL_PARITY.json":
                raise FileNotFoundError(artifact)
            continue
        for profile, cell in records(json.loads(artifact.read_text(encoding="utf-8-sig"))):
            address = cell.get("excelAddress") or cell.get("address") or cell.get("sourceCell") or cell.get("cell")
            formula = cell.get("formula")
            status = cell.get("status") or cell.get("classification")
            if isinstance(address, str) and re.fullmatch(r"[A-Z]{1,3}[1-9]\d*", address):
                sheet_name = cell.get("sheet") or FIXED_SOURCE_SHEETS.get(filename)
                if sheet_name:
                    address = f"{sheet_name}!{address}"
            if isinstance(address, str) and "!" in address and isinstance(formula, str) and status in STATUS_ORDER:
                sheet, position = address.rsplit("!", 1)
                index[profile, sheet.strip("'"), position, formula].add((filename, code, scope, status))
    if expanded_path is not None:
        expanded_evidence(index, expanded_path)
    return index

def inspect(path):
    meta = {"sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "sheets": [], "part_types": {}}
    values = []
    with ZipFile(path) as book:
        parts = book.namelist()
        meta["vba_sha256"] = hashlib.sha256(book.read("xl/vbaProject.bin")).hexdigest()
        for label, pattern in {
            "tables": r"xl/tables/table\d+\.xml$",
            "control_props": r"xl/ctrlProps/ctrlProp\d+\.xml$",
            "external_links": r"xl/externalLinks/externalLink\d+\.xml$",
            "connections": r"xl/connections\.xml$",
            "activex": r"xl/activeX/activeX\d+\.xml$",
            "vml": r"xl/drawings/vmlDrawing\d+\.vml$",
            "pivot_tables": r"xl/pivotTables/pivotTable\d+\.xml$",
            "drawings": r"xl/drawings/drawing\d+\.xml$",
        }.items():
            meta["part_types"][label] = sum(bool(re.fullmatch(pattern, part)) for part in parts)
        workbook = ET.fromstring(book.read("xl/workbook.xml"))
        meta["defined_names"] = [
            [item.attrib, item.text] for item in workbook.findall(f".//{NS}definedName")
        ]
        links = {item.attrib["Id"]: item.attrib["Target"]
                 for item in ET.fromstring(book.read("xl/_rels/workbook.xml.rels"))}
        control_links = []
        for part in parts:
            if re.fullmatch(r"xl/(?:ctrlProps/.+\.xml|drawings/.+\.vml)", part):
                xml = ET.fromstring(book.read(part))
                for item in xml.iter():
                    local = item.tag.rsplit("}", 1)[-1].lower()
                    for key, value in item.attrib.items():
                        if key.lower() in ("fmlalink", "fmlarange", "macroname"):
                            control_links.append([part, key, value])
                    if local in ("fmlalink", "fmlarange", "fmlamacro") and item.text:
                        control_links.append([part, local, item.text])
        meta["control_links"] = control_links
        for sheet in workbook.findall(f".//{NS}sheet"):
            name = sheet.attrib["name"]
            target = links[sheet.attrib[REL]]
            xml = ET.fromstring(book.read(target.lstrip("/") if target.startswith("/") else "xl/" + target))
            cells = list(xml.findall(f".//{NS}c"))
            formulas = [(c.attrib["r"], c.find(f"{NS}f")) for c in cells if c.find(f"{NS}f") is not None]
            shared = {
                f.attrib["si"]: (address, f.text)
                for address, f in formulas if f.attrib.get("t") == "shared" and f.text
            }
            kinds = Counter()
            for address, formula in formulas:
                kind = formula.attrib.get("t", "normal")
                kinds[kind] += 1
                expression = f"={formula.text}" if formula.text else ""
                if kind == "shared" and not expression:
                    origin, body = shared[formula.attrib["si"]]
                    expression = Translator(f"={body}", origin=origin).translate_formula(address)
                values.append((name, address, expression, kind, formula.attrib.get("ref", "") if kind != "shared" else ""))
            validations = [
                [item.attrib, [child.text for child in item]]
                for item in xml.iter() if item.tag.rsplit("}", 1)[-1] == "dataValidation"
            ]
            meta["sheets"].append({
                "name": name, "state": sheet.attrib.get("state", "visible"),
                "formula_kinds": dict(kinds), "validations": validations,
                "conditional_formats": len(xml.findall(f".//{NS}conditionalFormatting")),
            })
    return values, meta

def expressions(formula, sheet, slot, normalize):
    """Keep string literals and cross-slot references unchanged."""
    if not formula:
        return formula, [], [], [], False
    try:
        tokens = Tokenizer(formula).items
    except (TokenizerError, ValueError, IndexError):
        return formula, [], [], [], False
    parts, dependencies, gates, stack, predicates = [], [], [], [], []
    for token in tokens:
        value = token.value
        if token.type == "OPERAND" and token.subtype == "RANGE":
            source = value
            if slot and normalize:
                source = re.sub(rf"^('?[LZSF]){slot}('?!)", r"\1@\2", value)
                source = re.sub(rf"^('?(?:Главная)'?!)(\$?[A-Z]{{1,3}}\$?){10 + slot}(?!\d)",
                                r"\1\2@ROW", source)
                source = re.sub(rf"^('?(?:ПРМ)'?!)(\$?AB\$?){24 + slot}(?!\d)",
                                r"\1\2@AREA", source)
            value = source
            dependencies.append(value)
        if token.subtype == "OPEN":
            function = value[:-1].upper() if token.type == "FUNC" else None
            if function in {"IF", "IFS", "IFERROR", "IFNA", "CHOOSE", "SWITCH", "INDEX", "MATCH",
                            "VLOOKUP", "HLOOKUP", "XLOOKUP", "INDIRECT", "OFFSET", "SUMIF", "SUMIFS", "AND", "OR"}:
                gates.append(function)
            stack.append([function, len(parts) + 1, 0])
        elif token.type == "SEP" and token.subtype == "ARG" and stack:
            function, start, ordinal = stack[-1]
            if (function in {"IF", "IFERROR", "IFNA", "CHOOSE", "SWITCH"} and ordinal == 0
                    or function == "IFS" and ordinal % 2 == 0):
                predicate = "".join(parts[start:]).strip()
                predicates.append(f"{function}:{predicate}")
            stack[-1] = [function, len(parts) + 1, ordinal + 1]
        elif token.subtype == "CLOSE" and stack:
            stack.pop()
        parts.append(value)
    distinct = lambda items: list(dict.fromkeys(items))
    return "=" + "".join(parts), distinct(dependencies), distinct(gates), distinct(predicates), True

def build(args):
    index = evidence_index(args.expanded_parity)
    groups = {}
    inventory = {}
    variants_by_cell = defaultdict(set)
    for profile, name in NAMES.items():
        rows, inventory[profile] = inspect(args.originals / name)
        for sheet, address, original, kind, array_range in rows:
            slot = SLOT.fullmatch(sheet)
            group_sheet = slot[1] + "@" if slot else sheet
            canonical, deps, gates, predicates, tokenized = expressions(original, sheet, int(slot[2]) if slot else None, True)
            rule = (group_sheet, address, canonical, array_range)
            variants_by_cell[profile, group_sheet, address].add(canonical)
            entry = groups.setdefault(rule, {
                "original": original, "representative": f"{profile}:{sheet}!{address}",
                "sources": defaultdict(list), "deps": deps, "gates": gates, "predicates": predicates, "evidence": set(),
                "tested_profiles": set(), "occurrences": 0, "type": set(), "tokenized": tokenized,
                "f28": bool(re.search(r"(?:'Главная'|Главная)!\$?F\$?28(?!\d)", canonical, re.I)),
            })
            entry["type"].add(kind)
            entry["sources"][profile].append(sheet)
            entry["occurrences"] += 1
            matches = index[profile, sheet, address, original]
            entry["evidence"].update(matches)
            if matches:
                entry["tested_profiles"].add(profile)

    def format_row(rule, item):
        sheet, cell, canonical, array_range = rule
        findings = item["evidence"]
        expanded = [finding for finding in findings if finding[0] == EXPANDED_ARTIFACT]
        matched = any(f[3] in STATUS_ORDER[:3] for f in findings)
        earlier = any(f[0] != EXPANDED_ARTIFACT for f in findings)
        parity = sorted({status for _, _, _, status in findings}, key=STATUS_ORDER.index)
        status = ("MISMATCH" if "MISMATCH" in parity else
                  "PARTIAL_IMPLEMENTATION" if matched and any(f[3] == "UNVERIFIED" for f in expanded) else
                  "IMPLEMENTED_VERIFIED" if matched else
                  "IMPLEMENTED_UNVERIFIED" if earlier else "UNCLASSIFIED")
        limitations = []
        if status == "IMPLEMENTED_VERIFIED":
            limitations.append("Listed scenarios only; branch and domain proof pending")
        if item["f28"]:
            status = "MISMATCH" if "MISMATCH" in parity else "PARTIAL_IMPLEMENTATION"
            if expanded:
                limitations.append("Expanded F28 modes measured against PR 24; API keeps guard for mode 3")
            elif any(f[0] == "JV_F28_MODE3_EXCEL_PARITY.json" for f in findings):
                limitations.append("F28=3 verified for listed seven-family core cases; commercial API keeps guard")
            else:
                limitations.append("Commercial transport selector 3 blocked at baseline; predicate compares F28 with 2")
        if expanded:
            limitations.append("Expanded cases: " + " | ".join(sorted({f[2] for f in expanded})))
        if not item["tokenized"]:
            limitations.append("Static dependency tokenization unavailable")
        if any(p in item["deps"] for p in ("INDIRECT", "OFFSET")) or set(item["gates"]) & {"INDIRECT", "OFFSET"}:
            limitations.append("Dynamic references require evaluation")
        if not findings and not limitations:
            limitations.append("Engine equivalence and branch conditions not reviewed")
        prefix = "'" if item["original"].startswith("=") else ""
        return {
            "family_sheet": sheet, "cell": cell,
            "representative": item["representative"],
            "original_formula": prefix + item["original"],
            "normalized_formula": ("'" if canonical.startswith("=") else "") + canonical,
            "profiles_and_sheets": ";".join(f"{p}:{'|'.join(sheets)}" for p, sheets in item["sources"].items()),
            "occurrences": item["occurrences"], "formula_types": "|".join(sorted(item["type"])),
            "array_or_data_table_range": array_range, "dependency_tokens": "|".join(item["deps"]),
            "branch_and_lookup_functions": "|".join(item["gates"]),
            "syntactic_predicates": " | ".join(item["predicates"]),
            "engine_source": "|".join(sorted({f"packages/shared/src/jv/{f[1]}" for f in findings})),
            "parity_artifacts": "|".join(sorted({f[0] for f in findings})),
            "tested_profiles": "|".join(sorted(item["tested_profiles"])),
            "coverage": status, "parity": "|".join(parity) if parity else "UNVERIFIED",
            "conditions_and_limits": "; ".join(limitations),
        }

    formatted = [format_row(rule, item) for rule, item in sorted(groups.items())]
    with args.matrix.open("w", encoding="utf-8", newline="") as output:
        writer = csv.DictWriter(output, fieldnames=list(formatted[0]), lineterminator="\n")
        writer.writeheader()
        writer.writerows(formatted)
    different = []
    for sheet, cell in sorted({key[1:] for key in variants_by_cell}):
        completion = variants_by_cell["COMPLETATION", sheet, cell]
        retail = variants_by_cell["RETAIL", sheet, cell]
        if completion != retail:
            different.append([sheet, cell, sorted(completion), sorted(retail)])
    return {
        "groups": len(formatted),
        "sources": sum(row["occurrences"] for row in formatted),
        "statuses": dict(Counter(row["coverage"] for row in formatted)),
        "with_evidence": sum(bool(row["parity_artifacts"]) for row in formatted),
        "with_f28": sum(item["f28"] for item in groups.values()),
        "f28_occurrences": sum(item["occurrences"] for item in groups.values() if item["f28"]),
        "untokenized_groups": sum(not item["tokenized"] for item in groups.values()),
        "profile_difference_cells": different, "workbooks": inventory,
    }

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("originals", type=Path)
    parser.add_argument("--matrix", type=Path, default=DOCS / "FULL_EXCEL_COVERAGE_MATRIX.csv")
    parser.add_argument("--expanded-parity", type=Path, help="Independent JSON report for published PR #24")
    args = parser.parse_args()
    print(json.dumps(build(args), ensure_ascii=False, indent=2))
