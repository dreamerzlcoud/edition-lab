/* Compare walk-forward predictions with the observed count for each test week. */
(function (root) {
  "use strict";
  const svgNS = "http://www.w3.org/2000/svg";
  const observers = new WeakMap();
  const salesKeys = ["actual", "baseline", "regression"];
  const forecastKeys = ["baseline", "regression"];
  const colors = { actual: "#2f4bd2", baseline: "#616b85", regression: "#bd4324" };
  const labels = { actual: "Actual sales", baseline: "4-week mean", regression: "Regression" };
  const format = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
  const signedFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1, signDisplay: "exceptZero" });
  const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  const tickDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  let nextId = 0;

  function html(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function svg(tag, attrs, text) {
    const node = document.createElementNS(svgNS, tag);
    for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function niceStep(raw) {
    const power = 10 ** Math.floor(Math.log10(Math.max(1, raw)));
    const options = [1, 2, 2.5, 5, 10].map(n => Math.max(1, Math.round(n * power)));
    return options.reduce((best, n) => Math.abs(n - raw) < Math.abs(best - raw) ? n : best);
  }

  function render(container, rows, dates) {
    observers.get(container)?.disconnect();
    container.replaceChildren();
    if (!rows.length) {
      container.textContent = "No weeks available for comparison.";
      return;
    }
    const chartId = ++nextId;
    const dateValues = rows.map(r => new Date(dates[r.index] + "T00:00:00Z"));
    const toolbar = html("div", "ec-toolbar");
    const controls = html("div", "ec-switch");
    controls.setAttribute("role", "group");
    controls.setAttribute("aria-label", "Chart view");
    const legend = html("div", "ec-legend");
    const unit = html("p", "ec-unit");
    unit.id = "ec-unit-" + chartId;
    const surface = html("div", "ec-plot");
    surface.tabIndex = 0;
    surface.setAttribute("role", "slider");
    surface.setAttribute("aria-valuemin", "1");
    surface.setAttribute("aria-valuemax", rows.length);
    surface.setAttribute("aria-describedby", unit.id);
    const canvas = svg("svg", { "aria-hidden": "true", focusable: "false" });
    const tip = html("div", "ec-tip");
    tip.setAttribute("aria-hidden", "true");
    tip.hidden = true;
    toolbar.append(controls, legend);
    surface.append(canvas, tip);
    container.classList.add("edition-chart");
    container.append(toolbar, unit, surface);

    let mode = container.dataset.view === "error" ? "error" : "sales";
    let active = rows.length - 1;
    let showing = false;
    let plot;
    const selection = svg("g", {});
    const keys = () => mode === "sales" ? salesKeys : forecastKeys;
    const value = (r, key) => mode === "sales" ? r[key] : r[key] - r.actual;
    const display = n => mode === "sales" ? format.format(n) : signedFormat.format(n);
    const x = i => plot.left + (i + 0.5) * plot.interval;
    const y = n => plot.bottom - (n - plot.min) * (plot.bottom - plot.top) / (plot.max - plot.min);
    const barWidth = () => Math.min(12, plot.interval * 0.31);
    const barCenter = (i, key) => x(i) + (key === "regression" ? 0.58 : -0.58) * barWidth();

    function showWeek(index, visible) {
      active = index;
      showing = visible;
      const row = rows[index];
      const date = dateFormat.format(dateValues[index]);
      const readings = keys().map(key => labels[key] + " " + display(value(row, key)));
      surface.setAttribute("aria-valuenow", index + 1);
      surface.setAttribute("aria-valuetext", "Week of " + date + ". " + readings.join(", ") + " pairs.");
      selection.replaceChildren();
      tip.hidden = !visible;
      if (!visible || !plot) return;
      selection.append(svg("line", {
        x1: x(index), x2: x(index), y1: plot.top, y2: plot.bottom,
        stroke: "#8993a8", "stroke-dasharray": "3 4"
      }));
      tip.replaceChildren(html("strong", "", date));
      keys().forEach(key => {
        const number = value(row, key);
        selection.append(svg("circle", {
          cx: mode === "sales" ? x(index) : barCenter(index, key), cy: y(number),
          r: 4, fill: colors[key], stroke: "white", "stroke-width": 1.4
        }));
        const line = html("div", "ec-tip-row");
        const label = html("span", "", labels[key]);
        label.style.color = colors[key];
        line.append(label, html("span", "ec-tip-num", display(number)));
        tip.append(line);
      });
      const preferred = x(index) + 12 + tip.offsetWidth <= plot.width ? x(index) + 12 : x(index) - 12 - tip.offsetWidth;
      tip.style.left = Math.max(0, Math.min(plot.width - tip.offsetWidth, preferred)) + "px";
      tip.style.top = (plot.top + 2) + "px";
    }

    function draw() {
      const width = surface.clientWidth;
      const height = surface.clientHeight;
      if (!width || !height) return;
      const largest = Math.max(1, ...rows.flatMap(row => keys().map(key => Math.abs(value(row, key)))));
      const step = niceStep(largest / (mode === "sales" ? 4.5 : 2));
      const max = step * Math.ceil(largest / step);
      const min = mode === "sales" ? 0 : -max;
      const left = Math.max(35, display(max).length * 7 + 11);
      const right = width - 6;
      plot = { width, top: 11, bottom: height - 32, left, right, interval: (right - left) / rows.length, min, max };
      canvas.setAttribute("viewBox", [0, 0, width, height].join(" "));
      canvas.replaceChildren();
      const stops = svg("linearGradient", { id: "ec-area-" + chartId, x1: 0, y1: 0, x2: 0, y2: 1, gradientUnits: "objectBoundingBox" });
      stops.append(svg("stop", { offset: "0%", "stop-color": colors.actual, "stop-opacity": 0.17 }),
        svg("stop", { offset: "100%", "stop-color": colors.actual, "stop-opacity": 0.025 }));
      const defs = svg("defs", {});
      defs.append(stops);
      canvas.append(defs);
      for (let tick = min; tick <= max; tick += step) {
        canvas.append(svg("line", { x1: left, x2: right, y1: y(tick), y2: y(tick),
          stroke: tick === 0 ? "#9aa4b6" : "#e1e5eb", "stroke-width": tick === 0 ? 1.2 : 1 }));
        canvas.append(svg("text", { x: left - 7, y: y(tick) + 4, "text-anchor": "end", class: "ec-axis" }, display(tick)));
      }
      const ticks = Math.min(rows.length, Math.max(2, Math.floor((right - left) / 72) + 1));
      for (let i = 0; i < ticks; i++) {
        const index = Math.round(i * (rows.length - 1) / Math.max(1, ticks - 1));
        const label = tickDate.format(dateValues[index]);
        const half = label.length * 3.4;
        const tickX = Math.max(half, Math.min(width - half, x(index)));
        canvas.append(svg("text", { x: tickX, y: plot.bottom + 22, "text-anchor": "middle", class: "ec-axis" }, label));
      }
      if (mode === "sales") {
        const points = key => rows.map((r, i) => [x(i), y(r[key])].join(",")).join(" ");
        const area = [x(0) + "," + plot.bottom, points("actual"), x(rows.length - 1) + "," + plot.bottom].join(" ");
        canvas.append(svg("polygon", { points: area, fill: "url(#ec-area-" + chartId + ")" }));
        for (const key of ["baseline", "regression", "actual"]) {
          const line = svg("polyline", { points: points(key), fill: "none", stroke: colors[key],
            "stroke-width": key === "actual" ? 2.8 : 2, "stroke-linecap": "round", "stroke-linejoin": "round" });
          if (key === "baseline") line.setAttribute("stroke-dasharray", "5 4");
          canvas.append(line);
        }
        rows.forEach((row, i) => canvas.append(svg("circle", {
          cx: x(i), cy: y(row.actual), r: 3.3, fill: "#273faa", stroke: "white", "stroke-width": 1.2
        })));
      } else {
        rows.forEach((row, i) => forecastKeys.forEach(key => {
          const barEnd = y(value(row, key));
          canvas.append(svg("rect", { x: barCenter(i, key) - barWidth() / 2, width: barWidth(),
            y: Math.min(y(0), barEnd), height: Math.abs(y(0) - barEnd), rx: 1, fill: colors[key] }));
        }));
      }
      canvas.append(selection);
      showWeek(active, showing);
    }

    function setView(nextMode) {
      mode = nextMode;
      container.dataset.view = mode;
      showing = false;
      for (const button of controls.children) button.setAttribute("aria-pressed", String(button.value === mode));
      unit.textContent = mode === "sales" ? "Sampled sales (pairs)" : "Forecast minus actual (pairs). Positive values indicate overestimates.";
      const title = mode === "sales" ? "Weekly sales and forecasts." : "Weekly forecast errors.";
      surface.setAttribute("aria-label", title + " Use the left and right arrow keys to explore weeks.");
      legend.replaceChildren(...keys().map(key => {
        const item = html("span", "ec-legend-item");
        item.append(html("i", "ec-key ec-key-" + key), document.createTextNode(labels[key]));
        return item;
      }));
      draw();
    }
    for (const [key, label] of [["sales", "Sales"], ["error", "Forecast error"]]) {
      const button = html("button", "", label);
      button.type = "button";
      button.value = key;
      button.addEventListener("click", () => setView(key));
      controls.append(button);
    }
    function point(event) {
      if (!plot) return;
      const local = event.clientX - surface.getBoundingClientRect().left - plot.left;
      const index = Math.max(0, Math.min(rows.length - 1, Math.floor(local / plot.interval)));
      if (index !== active || !showing) showWeek(index, true);
    }
    surface.addEventListener("pointerdown", point);
    surface.addEventListener("pointermove", e => { if (e.pointerType !== "touch") point(e); });
    surface.addEventListener("pointerleave", () => { if (!surface.matches(":focus")) showWeek(active, false); });
    surface.addEventListener("focus", () => showWeek(active, true));
    surface.addEventListener("blur", () => showWeek(active, false));
    surface.addEventListener("keydown", event => {
      const last = rows.length - 1;
      const next = { ArrowLeft: active - 1, ArrowDown: active - 1, ArrowRight: active + 1, ArrowUp: active + 1, Home: 0, End: last };
      if (event.key === "Escape") showWeek(active, false);
      if (!Object.hasOwn(next, event.key)) return;
      event.preventDefault();
      showWeek(Math.max(0, Math.min(last, next[event.key])), true);
    });
    setView(mode);
    const observer = new ResizeObserver(draw);
    observer.observe(surface);
    observers.set(container, observer);
  }
  root.EditionChart = Object.freeze({ render });
})(globalThis);
