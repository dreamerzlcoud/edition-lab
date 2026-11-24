"""Rebuild weekly StockX resale counts with Python's standard library.

Run: python aggregate.py original.xlsx weekly.json
Workbook: https://s3.amazonaws.com/stockx-sneaker-analysis/wp-content/uploads/2019/02/StockX-Data-Contest-2019-3.xlsx
"""

import argparse
from collections import Counter
from datetime import date, timedelta
import hashlib
import json
from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZipFile


ARTICLE = "https://stockx.com/news/the-2019-data-contest/"
WORKBOOK = "https://s3.amazonaws.com/stockx-sneaker-analysis/wp-content/uploads/2019/02/StockX-Data-Contest-2019-3.xlsx"
T = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
BRANDS = {"Yeezy": "yeezy", "Off-White": "offwhite"}
EXPECTED = {"yeezy": 72162, "offwhite": 27794}
DAY = timedelta(days=1)


def load_counts(workbook):
    daily = Counter()
    with ZipFile(workbook) as package:
        string_table = ET.fromstring(package.read("xl/sharedStrings.xml"))
        strings = ["".join(x.itertext()) for x in string_table]
        # Sheet 2 is 'Raw Data' in the 2019 StockX workbook.
        with package.open("xl/worksheets/sheet2.xml") as sheet:
            for _, row in ET.iterparse(sheet, events=("end",)):
                if row.tag != T + "row":
                    continue
                cells = row.findall(T + "c")
                order_date, brand = [c.findtext(T + "v") for c in cells[:2]]
                if row.attrib["r"] == "1":
                    if [strings[int(i)] for i in (order_date, brand)] != ["Order Date", "Brand"]:
                        raise ValueError("Unexpected column headers")
                else:
                    day = date(1899, 12, 30) + timedelta(days=int(order_date))
                    group = BRANDS[strings[int(brand)].strip()]
                    daily[day, group] += 1
                row.clear()
    return daily


def aggregate(workbook):
    daily = load_counts(workbook)
    first = min(day for day, _ in daily)
    last = max(day for day, _ in daily)
    monday = first + DAY * (-first.weekday() % 7)
    sunday = last - DAY * ((last.weekday() + 1) % 7)
    dates = []
    series = {"all": [], "yeezy": [], "offwhite": []}
    for offset in range(0, (sunday - monday).days + 1, 7):
        week = monday + DAY * offset
        dates.append(week.isoformat())
        for group in EXPECTED:
            series[group].append(sum(daily[week + DAY * d, group] for d in range(7)))
        series["all"].append(sum(series[group][-1] for group in EXPECTED))

    totals = Counter()
    for (_, group), count in daily.items():
        totals[group] += count
    if dict(totals) != EXPECTED:
        raise ValueError(f"Workbook counts disagree with StockX's announcement: {totals}")
    return {
        "dates": dates,
        "series": series,
        "meta": {
            "source": ARTICLE,
            "workbook": WORKBOOK,
            "sha256": hashlib.sha256(workbook.read_bytes()).hexdigest(),
            "sampleStart": first.isoformat(),
            "sampleEnd": last.isoformat(),
            "rawCounts": {"all": totals.total(), **totals},
            "fullWeekStart": monday.isoformat(),
            "fullWeekEnd": sunday.isoformat(),
            "completeWeekCounts": {k: sum(v) for k, v in series.items()},
            "excludedFirstPartialWeek": sum(n for (d, _), n in daily.items() if d < monday),
            "excludedLastPartialWeek": sum(n for (d, _), n in daily.items() if d > sunday),
        },
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("workbook", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    result = aggregate(args.workbook)
    args.output.write_text(json.dumps(result, separators=(",", ":")) + "\n", encoding="utf-8")
    print(json.dumps(result["meta"], indent=2))
