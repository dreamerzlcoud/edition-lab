(() => {
  "use strict";

  const data = window.EDITION_DATA;
  const byId = (id) => document.getElementById(id);
  const collection = byId("collection");
  const week = byId("week");
  const quantity = byId("quantity");
  const number = new Intl.NumberFormat("en-US");
  const decimal = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
  const dateLabel = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  const displayDate = (iso) => dateLabel.format(new Date(iso + "T00:00:00Z"));
  const text = (id, value) => { byId(id).textContent = value; };
  let evaluation;

  function renderTable(rows) {
    byId("week-table").replaceChildren(...rows.map((row) => {
      const tr = document.createElement("tr");
      const start = document.createElement("th");
      start.scope = "row";
      start.textContent = displayDate(data.dates[row.index]);
      tr.append(start);
      for (const field of ["actual", "baseline", "regression"]) {
        const cell = document.createElement("td");
        cell.textContent = field === "actual" ? number.format(row[field]) : decimal.format(row[field]);
        tr.append(cell);
      }
      return tr;
    }));
  }

  function renderScores({ baseline, regression }) {
    text("mean-mae", decimal.format(baseline.mae));
    text("reg-mae", decimal.format(regression.mae));
    const difference = Math.abs(baseline.mae - regression.mae);
    const winner = regression.mae < baseline.mae ? "Regression" : "The 4-week mean";
    const percent = 100 * difference / Math.max(baseline.mae, regression.mae, 1);
    text("score-change", decimal.format(percent));
    text("score-note", difference === 0 ? "Both models had the same average error."
      : "Lower error with " + (winner === "Regression" ? "regression" : "the 4-week mean") + " in the 12 test weeks.");
  }

  function selectedWeek() {
    return evaluation.rows[Number(week.value)];
  }

  function updateScenario() {
    const units = Number(quantity.value);
    const actual = selectedWeek().actual;
    const result = ForecastLab.simulate(units, actual);
    text("stock-label", number.format(units));
    quantity.setAttribute("aria-valuetext", number.format(units) + " pairs");
    text("sold", number.format(result.sold));
    text("leftover", number.format(result.leftover));
    text("unfilled", number.format(result.unfilled));
    text("week-actual", number.format(actual) + " sales");
  }

  function setFromModel(key) {
    quantity.value = String(Math.round(selectedWeek()[key]));
    updateScenario();
  }

  function setWeek() {
    const row = selectedWeek();
    const high = Math.max(1, row.actual, row.baseline, row.regression);
    quantity.max = String(Math.max(100, Math.ceil(high * 1.5 / 100) * 100));
    text("range-max", number.format(Number(quantity.max)));
    setFromModel("baseline");
  }

  function updateCollection() {
    evaluation = ForecastLab.evaluate(data.series[collection.value], 12);
    EditionChart.render(byId("chart"), evaluation.rows, data.dates);
    renderScores(evaluation.metrics);
    renderTable(evaluation.rows);
    text("sim-collection", collection.selectedOptions[0].textContent);
    setWeek();
  }

  const testWeeks = data.dates.slice(-12);
  week.replaceChildren(...testWeeks.map((iso, i) => new Option(displayDate(iso), String(i))));
  week.value = String(testWeeks.length - 1);
  collection.addEventListener("change", updateCollection);
  week.addEventListener("change", setWeek);
  quantity.addEventListener("input", updateScenario);
  byId("use-mean").addEventListener("click", () => setFromModel("baseline"));
  byId("use-reg").addEventListener("click", () => setFromModel("regression"));
  updateCollection();
})();
