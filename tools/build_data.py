"""Build the browser dataset and downloadable weekly CSV from the StockX workbook."""

import argparse
import csv
import json
from pathlib import Path

from aggregate import aggregate


def write_assets(data, directory):
    directory.mkdir(parents=True, exist_ok=True)
    encoded = json.dumps(data, separators=(",", ":"))
    (directory / "weekly.js").write_text(
        f"window.EDITION_DATA = {encoded};\n", encoding="utf-8"
    )
    groups = ["all", "yeezy", "offwhite"]
    with (directory / "weekly-counts.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["week_start", *groups])
        for i, monday in enumerate(data["dates"]):
            writer.writerow([monday, *(data["series"][group][i] for group in groups)])


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("workbook", type=Path)
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[1] / "dist")
    args = parser.parse_args()
    write_assets(aggregate(args.workbook), args.output)
