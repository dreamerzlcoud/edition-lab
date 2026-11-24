(() => {
  "use strict";
  const host = document.getElementById("challenge");
  if (!host) return;
  const data = window.EDITION_DATA;
  const collection = document.getElementById("collection");
  const fmt = new Intl.NumberFormat("en-US");
  const dateFormat = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  const available = data.dates.map((_, index) => index).filter((index) => index >= 30 && index < data.dates.length - 12);
  let deck = [];
  let week;
  let round;
  let revealed;

  host.innerHTML = `
    <div class="decision-card">
      <div class="decision-brief">
        <p class="decision-label" data-role="collection"></p>
        <p class="decision-week-label">Week starting</p>
        <h3 class="decision-week" tabindex="-1" data-role="week"></h3>
        <div class="decision-hints">
          <div><span class="decision-model decision-mean">4-week mean</span><strong data-role="mean"></strong></div>
          <div><span class="decision-model decision-reg">Regression</span><strong data-role="regression"></strong></div>
        </div>
        <p class="decision-footnote">One-week forecasts in pairs, rounded to whole numbers.</p>
      </div>
      <div class="decision-play">
        <form data-role="form">
          <h3><label for="decision-quantity">How many pairs would you stock?</label></h3>
          <p>Set your quantity before you see the week’s sampled sales.</p>
          <div class="decision-control">
            <div class="decision-number"><input id="decision-quantity" type="number" inputmode="numeric" min="0" step="1" required placeholder="0" autocomplete="off"><span aria-hidden="true">pairs</span></div>
            <button type="submit">Reveal sales</button>
          </div>
        </form>
        <div class="decision-result" data-role="result" hidden>
          <h3 tabindex="-1" data-role="headline"></h3>
          <div class="decision-bars">
            <div class="decision-bar-row"><span>Your stock</span><div class="decision-track" aria-hidden="true"><i data-role="stock-bar"></i></div><strong data-role="stock-count"></strong></div>
            <div class="decision-bar-row"><span>Sample sales</span><div class="decision-track" aria-hidden="true"><i data-role="sales-bar"></i></div><strong data-role="sales-count"></strong></div>
          </div>
          <div class="decision-errors">
            <p>Absolute error in pairs</p>
            <dl>
              <div><dt>Your plan</dt><dd data-role="your-error"></dd></div>
              <div><dt>4-week mean</dt><dd data-role="mean-error"></dd></div>
              <div><dt>Regression</dt><dd data-role="reg-error"></dd></div>
            </dl>
          </div>
          <p class="decision-comparison" data-role="comparison"></p>
          <button type="button" data-role="next">Try another week</button>
        </div>
      </div>
    </div>`;
  const el = (name) => host.querySelector(`[data-role="${name}"]`);
  const input = host.querySelector("input");

  function nextWeek() {
    if (deck.length === 0) {
      deck = [...available];
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
      if (deck.length > 1 && deck.at(-1) === week) {
        [deck[0], deck[deck.length - 1]] = [deck.at(-1), deck[0]];
      }
    }
    return deck.pop();
  }

  function startRound(focusWeek = false) {
    week = nextWeek();
    const throughTarget = data.series[collection.value].slice(0, week + 1);
    const prediction = ForecastLab.evaluate(throughTarget, 1).rows[0];
    round = { actual: prediction.actual, baseline: Math.round(prediction.baseline), regression: Math.round(prediction.regression) };
    revealed = false;
    el("collection").textContent = collection.selectedOptions[0].textContent;
    el("week").textContent = dateFormat.format(new Date(data.dates[week] + "T00:00:00Z"));
    el("mean").textContent = fmt.format(round.baseline);
    el("regression").textContent = fmt.format(round.regression);
    el("form").reset();
    input.setCustomValidity("");
    el("result").hidden = true;
    el("form").hidden = false;
    if (focusWeek) el("week").focus({ preventScroll: true });
  }

  function pairs(n) {
    return fmt.format(n) + (n === 1 ? " pair" : " pairs");
  }

  function reveal(event) {
    event.preventDefault();
    if (revealed) return;
    const stock = input.valueAsNumber;
    if (!Number.isSafeInteger(stock) || stock < 0) {
      input.setCustomValidity("Enter a nonnegative whole number of pairs.");
      input.reportValidity();
      return;
    }
    revealed = true;
    const result = ForecastLab.simulate(stock, round.actual);
    let outcome = "Your plan matched the week’s sales.";
    if (result.leftover) outcome = pairs(result.leftover) + " left over.";
    if (result.unfilled) outcome = pairs(result.unfilled) + " short.";
    el("headline").textContent = outcome;
    el("stock-count").textContent = fmt.format(stock);
    el("sales-count").textContent = fmt.format(round.actual);
    const scale = Math.max(1, stock, round.actual);
    el("stock-bar").style.width = 100 * stock / scale + "%";
    el("sales-bar").style.width = 100 * round.actual / scale + "%";
    const meanError = Math.abs(round.baseline - round.actual);
    const regressionError = Math.abs(round.regression - round.actual);
    const yourError = Math.abs(stock - round.actual);
    const errors = [yourError, meanError, regressionError];
    const best = Math.min(...errors);
    const labels = ["Your plan", "The 4-week mean", "Regression"];
    const winners = labels.filter((_, index) => errors[index] === best);
    el("your-error").textContent = fmt.format(yourError);
    el("mean-error").textContent = fmt.format(meanError);
    el("reg-error").textContent = fmt.format(regressionError);
    if (winners.length === 1) el("comparison").textContent = winners[0] + " came closest this week.";
    else if (winners.length === 2) el("comparison").textContent = winners[0] + " and " + winners[1].toLowerCase() + " tied for closest this week.";
    else el("comparison").textContent = "All three estimates tied this week.";
    el("form").hidden = true;
    el("result").hidden = false;
    el("headline").focus({ preventScroll: true });
  }

  input.addEventListener("input", () => input.setCustomValidity(""));
  el("form").addEventListener("submit", reveal);
  el("next").addEventListener("click", () => startRound(true));
  collection.addEventListener("change", () => startRound());
  startRound();
})();
