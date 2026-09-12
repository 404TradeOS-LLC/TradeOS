#!/usr/bin/env python3
"""Parse the full INDOT CY2025 Unit Price Summary workbook using stdlib only.

The parser downloads the authoritative XLSX workbook, reads every worksheet row,
identifies the pay-item table by header names, validates each pay-item row, and
emits a normalized JSON snapshot. It deliberately preserves INDOT composite
installed bid-price semantics; it does not decompose values into material,
labor, equipment, overhead, or margin components.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.request
import zipfile
from dataclasses import asdict, dataclass
from io import BytesIO
from pathlib import Path
from typing import Iterable
from xml.etree import ElementTree as ET

SOURCE_URL = "https://www.in.gov/indot/doing-business-with-indot/files/CY2025-Unit-Price-Summary.xlsx"
INDEX_URL = "https://www.in.gov/indot/doing-business-with-indot/home/contracts/standards/indot-pay-items-listunit-price-summaries/"
REGIONAL_BASIS = "Indiana statewide awarded INDOT contracts"
PAY_ITEM_RE = re.compile(r"^\d{3}-\d{5}$")
EXPECTED_FIRST_PAY_ITEM = "105-06807"
EXPECTED_LAST_PAY_ITEM = "809-94971"

NS = {"main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
REL_NS = {"rel": "http://schemas.openxmlformats.org/package/2006/relationships"}
OFFICE_REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"


@dataclass(frozen=True)
class IndotUnitPriceRow:
    payItemNumber: str
    description: str
    unit: str
    lowPrice: float
    highPrice: float
    averagePrice: float
    totalQuantity: float


def _column_index(cell_ref: str) -> int:
    letters = "".join(ch for ch in cell_ref if ch.isalpha()).upper()
    result = 0
    for ch in letters:
        result = result * 26 + (ord(ch) - ord("A") + 1)
    return result - 1


def _shared_strings(archive: zipfile.ZipFile) -> list[str]:
    try:
        raw = archive.read("xl/sharedStrings.xml")
    except KeyError:
        return []
    root = ET.fromstring(raw)
    values: list[str] = []
    for si in root.findall("main:si", NS):
        text = "".join(node.text or "" for node in si.iterfind(".//main:t", NS))
        values.append(text)
    return values


def _first_sheet_path(archive: zipfile.ZipFile) -> str:
    workbook = ET.fromstring(archive.read("xl/workbook.xml"))
    sheets = workbook.find("main:sheets", NS)
    if sheets is None or len(sheets) == 0:
        raise ValueError("Workbook contains no worksheets")
    first = sheets[0]
    rel_id = first.attrib.get(f"{{{OFFICE_REL_NS}}}id")
    if not rel_id:
        raise ValueError("First worksheet is missing a relationship id")

    rels = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
    for relationship in rels.findall("rel:Relationship", REL_NS):
        if relationship.attrib.get("Id") == rel_id:
            target = relationship.attrib["Target"].lstrip("/")
            if target.startswith("xl/"):
                return target
            return f"xl/{target}"
    raise ValueError(f"Worksheet relationship {rel_id} not found")


def _cell_value(cell: ET.Element, shared: list[str]) -> str:
    cell_type = cell.attrib.get("t")
    if cell_type == "inlineStr":
        return "".join(node.text or "" for node in cell.iterfind(".//main:t", NS)).strip()
    value = cell.find("main:v", NS)
    if value is None or value.text is None:
        return ""
    raw = value.text.strip()
    if cell_type == "s":
        return shared[int(raw)].strip()
    return raw


def _worksheet_rows(archive: zipfile.ZipFile) -> Iterable[list[str]]:
    shared = _shared_strings(archive)
    sheet_path = _first_sheet_path(archive)
    root = ET.fromstring(archive.read(sheet_path))
    sheet_data = root.find("main:sheetData", NS)
    if sheet_data is None:
        raise ValueError("Worksheet has no sheetData")

    for row in sheet_data.findall("main:row", NS):
        values: dict[int, str] = {}
        max_index = -1
        for cell in row.findall("main:c", NS):
            ref = cell.attrib.get("r", "A1")
            index = _column_index(ref)
            values[index] = _cell_value(cell, shared)
            max_index = max(max_index, index)
        yield [values.get(index, "") for index in range(max_index + 1)] if max_index >= 0 else []


def _normalize_header(value: str) -> str:
    return re.sub(r"[^A-Z0-9]+", " ", value.upper()).strip()


def _find_header(rows: list[list[str]]) -> tuple[int, dict[str, int]]:
    aliases = {
        "payItemNumber": ("PAY ITEM", "ITEM NUMBER", "PAY ITEM NUMBER"),
        "description": ("DESCRIPTION", "ITEM DESCRIPTION"),
        "unit": ("UNIT",),
        "lowPrice": ("LOW", "LOW PRICE", "LOW UNIT PRICE"),
        "highPrice": ("HIGH", "HIGH PRICE", "HIGH UNIT PRICE"),
        "averagePrice": ("AVERAGE", "AVG", "AVERAGE PRICE", "AVERAGE UNIT PRICE"),
        "totalQuantity": ("QUANTITY", "QTY", "TOTAL QUANTITY"),
    }

    for row_index, row in enumerate(rows):
        normalized = [_normalize_header(cell) for cell in row]
        mapping: dict[str, int] = {}
        for field, options in aliases.items():
            for index, value in enumerate(normalized):
                if value in options:
                    mapping[field] = index
                    break
        if all(field in mapping for field in aliases):
            return row_index, mapping
    raise ValueError("Could not locate the INDOT unit-price table header")


def _number(value: str, field: str, pay_item: str) -> float:
    cleaned = value.replace("$", "").replace(",", "").strip()
    if not cleaned:
        raise ValueError(f"{pay_item}: missing {field}")
    try:
        number = float(cleaned)
    except ValueError as exc:
        raise ValueError(f"{pay_item}: invalid {field}: {value!r}") from exc
    if number < 0:
        raise ValueError(f"{pay_item}: negative {field}: {number}")
    return number


def parse_workbook_bytes(payload: bytes) -> list[IndotUnitPriceRow]:
    with zipfile.ZipFile(BytesIO(payload)) as archive:
        rows = list(_worksheet_rows(archive))

    header_index, columns = _find_header(rows)
    parsed: list[IndotUnitPriceRow] = []
    seen: set[str] = set()

    for raw in rows[header_index + 1 :]:
        def cell(field: str) -> str:
            index = columns[field]
            return raw[index].strip() if index < len(raw) else ""

        pay_item = cell("payItemNumber")
        if not PAY_ITEM_RE.match(pay_item):
            continue
        if pay_item in seen:
            raise ValueError(f"Duplicate pay item {pay_item}")

        record = IndotUnitPriceRow(
            payItemNumber=pay_item,
            description=cell("description"),
            unit=cell("unit"),
            lowPrice=_number(cell("lowPrice"), "lowPrice", pay_item),
            highPrice=_number(cell("highPrice"), "highPrice", pay_item),
            averagePrice=_number(cell("averagePrice"), "averagePrice", pay_item),
            totalQuantity=_number(cell("totalQuantity"), "totalQuantity", pay_item),
        )
        if not record.description or not record.unit:
            raise ValueError(f"{pay_item}: description and unit are required")
        if record.lowPrice > record.averagePrice or record.averagePrice > record.highPrice:
            raise ValueError(
                f"{pay_item}: expected low <= average <= high, got "
                f"{record.lowPrice} <= {record.averagePrice} <= {record.highPrice}"
            )
        parsed.append(record)
        seen.add(pay_item)

    if not parsed:
        raise ValueError("No INDOT pay-item rows were parsed")
    if parsed[0].payItemNumber != EXPECTED_FIRST_PAY_ITEM:
        raise ValueError(
            f"Unexpected first pay item {parsed[0].payItemNumber}; expected {EXPECTED_FIRST_PAY_ITEM}"
        )
    if parsed[-1].payItemNumber != EXPECTED_LAST_PAY_ITEM:
        raise ValueError(
            f"Unexpected last pay item {parsed[-1].payItemNumber}; expected {EXPECTED_LAST_PAY_ITEM}"
        )
    return parsed


def download_workbook(url: str = SOURCE_URL) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "TradeOS-Costbook/1.0"})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, help="Parse a local XLSX instead of downloading INDOT")
    parser.add_argument("--output", type=Path, default=Path("app/data/indot-cy2025-unit-prices.json"))
    args = parser.parse_args()

    payload = args.input.read_bytes() if args.input else download_workbook()
    rows = parse_workbook_bytes(payload)
    units = sorted({row.unit for row in rows})
    snapshot = {
        "sourceUrl": SOURCE_URL,
        "indexUrl": INDEX_URL,
        "sourceYear": 2025,
        "regionalBasis": REGIONAL_BASIS,
        "rowCount": len(rows),
        "units": units,
        "firstPayItem": rows[0].payItemNumber,
        "lastPayItem": rows[-1].payItemNumber,
        "rows": [asdict(row) for row in rows],
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(snapshot, indent=2) + "\n", encoding="utf-8")
    print(
        json.dumps(
            {
                "output": str(args.output),
                "rowCount": len(rows),
                "firstPayItem": rows[0].payItemNumber,
                "lastPayItem": rows[-1].payItemNumber,
                "units": units,
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
