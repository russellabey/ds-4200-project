(function () {
  if (typeof d3 === "undefined") return;

  const DATA_URL = "../assets/quit-today-curve.json";

  function riskFromPY(py, c) {
    if (py <= c[0][0]) return c[0][1];
    if (py >= c[c.length - 1][0]) return c[c.length - 1][1];
    let i = 0;
    while (i < c.length - 1 && c[i + 1][0] < py) i++;
    const [x0, y0] = c[i],
      [x1, y1] = c[i + 1];
    return y0 + ((py - x0) / (x1 - x0)) * (y1 - y0);
  }

  fetch(DATA_URL)
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function (cfg) {
      const curve = cfg.curve;
      const H = cfg.horizonYears;
      const pyMin = cfg.ranges.packYears.min;
      const pyMax = cfg.ranges.packYears.max;
      const pyStep = cfg.pyStep;
      const cpdLo = Math.round(cfg.ranges.cigsPerDay.min);
      const cpdHi = Math.round(cfg.ranges.cigsPerDay.max);
      const nPy = Math.max(1, Math.round((pyMax - pyMin) / pyStep));
      const pyIdx = Math.max(0, Math.min(nPy, Math.round((cfg.defaults.packYears - pyMin) / pyStep)));
      const cpd = Math.max(cpdLo, Math.min(cpdHi, Math.round(cfg.defaults.cigsPerDay)));

      const pySlider = document.getElementById("py-slider");
      const cpdSlider = document.getElementById("cpd-slider");
      const pyVal = document.getElementById("py-val");
      const cpdVal = document.getElementById("cpd-val");
      const svgEl = document.getElementById("quit-chart-svg");
      if (!pySlider || !cpdSlider || !svgEl) return;

      pySlider.min = 0;
      pySlider.max = nPy;
      pySlider.step = 1;
      pySlider.value = pyIdx;
      cpdSlider.min = cpdLo;
      cpdSlider.max = cpdHi;
      cpdSlider.step = 1;
      cpdSlider.value = cpd;

      var controls = document.getElementById("controls");
      if (controls) controls.hidden = false;

      var m = { t: 24, r: 20, b: 48, l: 56 };
      var w = 720 - m.l - m.r;
      var h = 300 - m.t - m.b;
      var svgW = w + m.l + m.r;
      var svgH = h + m.t + m.b;

      var svg = d3
        .select(svgEl)
        .attr("width", svgW)
        .attr("height", svgH)
        .attr("overflow", "visible");
      var g = svg.append("g").attr("transform", "translate(" + m.l + "," + m.t + ")");

      var x = d3.scaleLinear().domain([-H, H]).range([0, w]);
      var y = d3.scaleLinear().domain([0, 100]).range([h, 0]);

      g.append("line")
        .attr("x1", x(0))
        .attr("x2", x(0))
        .attr("y1", 0)
        .attr("y2", h)
        .attr("stroke", "#9ca3af")
        .attr("stroke-dasharray", "4 4");

      g.append("g")
        .attr("transform", "translate(0," + h + ")")
        .call(d3.axisBottom(x).ticks(Math.min(2 * H + 1, 12)).tickFormat(d3.format("d")));

      g.append("g").call(d3.axisLeft(y).ticks(6));

      svg
        .append("text")
        .attr("x", m.l + w / 2)
        .attr("y", svgH - 8)
        .attr("text-anchor", "middle")
        .attr("fill", "#1a1a1a")
        .text("Years from today");

      svg
        .append("text")
        .attr("transform", "translate(" + m.l / 2 + "," + (m.t + h / 2) + ") rotate(-90)")
        .attr("text-anchor", "middle")
        .attr("fill", "#1a1a1a")
        .text("Chance of Cancer");

      var lineGen = d3
        .line()
        .x(function (d) {
          return x(d.year);
        })
        .y(function (d) {
          return y(d.risk);
        });

      var lineKeep = g
        .append("path")
        .attr("fill", "none")
        .attr("stroke", "#dc2626")
        .attr("stroke-width", 2);
      var lineQuit = g
        .append("path")
        .attr("fill", "none")
        .attr("stroke", "#2563eb")
        .attr("stroke-width", 2);

      function redraw() {
        var py0 = pyMin + pyStep * +pySlider.value;
        var cpdN = +cpdSlider.value;
        pyVal.textContent = py0.toFixed(1);
        cpdVal.textContent = String(cpdN);

        var keep = [];
        for (var yr = -H; yr <= H; yr++) {
          var pyT = Math.max(0, py0 + (cpdN / 20) * yr);
          keep.push({ year: yr, risk: riskFromPY(pyT, curve) });
        }
        var q = riskFromPY(py0, curve);
        var quit = [];
        for (var yq = 0; yq <= H; yq++) quit.push({ year: yq, risk: q });

        lineKeep.datum(keep).attr("d", lineGen);
        lineQuit.datum(quit).attr("d", lineGen);
      }

      pySlider.addEventListener("input", redraw);
      cpdSlider.addEventListener("input", redraw);
      redraw();
    })
    .catch(function (e) {
      var errEl = document.getElementById("load-err");
      if (!errEl) return;
      errEl.hidden = false;
      errEl.textContent =
        "Could not load chart data (" +
        (e && e.message ? e.message : "unknown error") +
        "). Use a local HTTP server from the Final Project folder (not file://).";
    });
})();
