(function () {
  "use strict";
  const stage = document.getElementById("shoe-stage");
  if (!stage) return;
  const base = new URL(".", document.currentScript.src);
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const total = 48;
  const perSheet = 12;
  stage.innerHTML = `<div class="shoe-canvas" role="slider" tabindex="0" aria-label="Sneaker viewing angle. Drag, or use the left and right arrow keys." aria-valuemin="0" aria-valuemax="353" aria-valuenow="0" aria-valuetext="0 degrees">
    <div class="shoe-frame"></div></div>
    <div class="shoe-tools"><span class="shoe-caption"><strong>360°</strong> Drag to turn</span>
    <button type="button" class="shoe-toggle" aria-label="Play sneaker rotation"><span class="shoe-toggle-icon" aria-hidden="true">↻</span><span class="shoe-toggle-text">Rotate</span></button></div>`;
  const canvas = stage.querySelector(".shoe-canvas");
  const frame = stage.querySelector(".shoe-frame");
  const toggle = stage.querySelector(".shoe-toggle");
  const label = stage.querySelector(".shoe-toggle-text");
  const icon = stage.querySelector(".shoe-toggle-icon");
  const sheets = new Map();
  let angle = 0;
  let timer = 0;
  let start = null;

  function sheet(number) {
    if (!sheets.has(number)) {
      const src = new URL(`angles-${number}.webp`, base).href;
      const img = new Image();
      const promise = new Promise((resolve, reject) => {
        img.onload = () => resolve(src);
        img.onerror = () => { sheets.delete(number); reject(new Error("Unavailable shoe frame")); };
      });
      sheets.set(number, promise);
      img.src = src;
    }
    return sheets.get(number);
  }

  function show(number) {
    angle = ((number % total) + total) % total;
    const wanted = angle;
    const piece = Math.floor(wanted / perSheet);
    sheet(piece).then((src) => {
      if (wanted !== angle) return;
      const local = angle % perSheet;
      frame.style.backgroundImage = `url("${src}")`;
      frame.style.backgroundSize = "400% 300%";
      frame.style.backgroundPosition = `${(local % 4) * 100 / 3}% ${Math.floor(local / 4) * 50}%`;
      const degrees = Math.round(wanted * 360 / total);
      canvas.setAttribute("aria-valuenow", degrees);
      canvas.setAttribute("aria-valuetext", degrees + " degrees");
      sheet((piece + 1) % 4).catch(() => {});
    }).catch(stop);
  }

  function stop() {
    window.clearInterval(timer);
    timer = 0;
    icon.textContent = "↻";
    label.textContent = "Rotate";
    toggle.setAttribute("aria-label", motion.matches ? "Turn sneaker one step" : "Play sneaker rotation");
  }
  stop();
  toggle.addEventListener("click", () => {
    if (timer) { stop(); return; }
    show(angle + (motion.matches ? 3 : 1));
    if (motion.matches) return;
    icon.textContent = "Ⅱ";
    label.textContent = "Pause";
    toggle.setAttribute("aria-label", "Pause sneaker rotation");
    timer = window.setInterval(() => show(angle + 1), 130);
  });
  canvas.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    stop();
    start = { x: event.clientX, angle, id: event.pointerId };
    canvas.setPointerCapture(event.pointerId);
    sheet(Math.floor(angle / perSheet)).catch(() => {});
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!start || start.id !== event.pointerId) return;
    const steps = Math.round((event.clientX - start.x) * total / canvas.clientWidth);
    const wanted = (start.angle - steps % total + total) % total;
    if (wanted !== angle) show(wanted);
  });
  canvas.addEventListener("lostpointercapture", () => { start = null; });
  canvas.addEventListener("keydown", (event) => {
    const positions = { ArrowLeft: angle - 1, ArrowRight: angle + 1, ArrowDown: angle - 1,
      ArrowUp: angle + 1, Home: 0, End: total - 1 };
    if (!Object.hasOwn(positions, event.key)) return;
    event.preventDefault();
    stop();
    show(positions[event.key]);
  });
  if (motion.addEventListener) motion.addEventListener("change", stop);
  document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); });
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) sheet(0).catch(() => {});
      else stop();
    });
    observer.observe(stage);
  }
})();
