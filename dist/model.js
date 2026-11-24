/* Each input is one complete week of sampled resale transaction counts, in date order. */
(function (root) {
  "use strict";

  function features(counts, week) {
    const recentFour = counts.slice(week - 4, week);
    return [counts[week - 1], recentFour.reduce((total, n) => total + n, 0) / 4];
  }

  function mean(values) {
    return values.reduce((total, n) => total + n, 0) / values.length;
  }

  function dot(left, right) {
    return left.reduce((total, n, index) => total + n * right[index], 0);
  }

  function regressionForecast(history, next) {
    const average = [0, 1, 2].map((column) => mean(history.map((row) => row[column])));
    const centered = (column) => history.map((row) => row[column] - average[column]);
    const lag = centered(0);
    const recent = centered(1);
    const sales = centered(2);
    const lagSS = dot(lag, lag);
    const recentSS = dot(recent, recent);

    // Orthogonalize the four-week mean against last week's count before fitting.
    // A constant or redundant column adds no independent signal to the fit.
    const projection = lagSS > 0 ? dot(lag, recent) / lagSS : 0;
    const residual = recent.map((value, index) => value - projection * lag[index]);
    const residualSS = dot(residual, residual);
    const lagSlope = lagSS > 0 ? dot(lag, sales) / lagSS : 0;
    const residualSlope = residualSS > 1e-12 * recentSS ? dot(residual, sales) / residualSS : 0;
    const nextLag = next[0] - average[0];
    const nextResidual = next[1] - average[1] - projection * nextLag;
    return Math.max(0, average[2] + lagSlope * nextLag + residualSlope * nextResidual);
  }

  function accuracy(rows, model) {
    const errors = rows.map((row) => row[model] - row.actual);
    const actualTotal = rows.reduce((total, row) => total + row.actual, 0);
    const absoluteTotal = errors.reduce((total, error) => total + Math.abs(error), 0);
    return {
      mae: absoluteTotal / rows.length,
      rmse: Math.sqrt(dot(errors, errors) / rows.length),
      wape: actualTotal > 0 ? absoluteTotal / actualTotal : null
    };
  }

  function isCount(value) {
    return Number.isSafeInteger(value) && value >= 0;
  }

  function evaluate(counts, holdout = 12) {
    if (!Array.isArray(counts) || Array.from(counts).some((count) => !isCount(count))) {
      throw new TypeError("Use a sequence of nonnegative integer weekly transaction counts.");
    }
    if (!Number.isInteger(holdout) || holdout < 1 || counts.length - holdout < 7) {
      throw new RangeError("The holdout needs at least one week and seven preceding weeks of training data.");
    }

    const firstTestWeek = counts.length - holdout;
    const history = [];
    const rows = [];
    for (let week = 4; week < counts.length; week++) {
      const predictors = features(counts, week);
      if (week >= firstTestWeek) {
        rows.push({
          index: week,
          actual: counts[week],
          baseline: predictors[1],
          regression: regressionForecast(history, predictors)
        });
      }
      // Only after making this week's forecast can its actual enter later training sets.
      history.push([...predictors, counts[week]]);
    }
    return { rows, metrics: { baseline: accuracy(rows, "baseline"), regression: accuracy(rows, "regression") } };
  }

  // Single-week scenario: one unit per sampled sale, all units available at the
  // start, no replenishment, no carryover. Unfilled units compare the plan with
  // the observed sample, which does not identify lost sales or latent demand.
  function simulate(units, observed) {
    if (!isCount(units) || !isCount(observed)) {
      throw new RangeError("Use nonnegative whole numbers for available units and observed sales.");
    }
    const sold = Math.min(units, observed);
    return { leftover: units - sold, unfilled: observed - sold, sold };
  }

  const api = Object.freeze({ evaluate, simulate });
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ForecastLab = api;
})(globalThis);
