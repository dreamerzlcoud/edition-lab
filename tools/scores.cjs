// Print the same holdout scores used in the browser, with no external packages.
"use strict";

global.window = {};
require("../dist/weekly.js");
const { evaluate } = require("../dist/model.js");

const rows = [];
for (const [collection, counts] of Object.entries(window.EDITION_DATA.series)) {
  const { metrics } = evaluate(counts, 12);
  for (const [model, metric] of Object.entries(metrics)) {
    rows.push({
      collection,
      model,
      MAE: metric.mae.toFixed(2),
      RMSE: metric.rmse.toFixed(2),
      "WAPE (%)": (metric.wape * 100).toFixed(2)
    });
  }
}
console.table(rows);
