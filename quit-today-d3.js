(function () {
  if (typeof d3 === "undefined") return;

  const curveJsonUrl = "../assets/quit-today-curve.json";

  function riskAtPackYears(packYears, curve) {
    if (packYears <= curve[0][0]) return curve[0][1];
    if (packYears >= curve[curve.length - 1][0]) return curve[curve.length - 1][1];
    let segment = 0;
    while (segment < curve.length - 1 && curve[segment + 1][0] < packYears) segment++;
    const [packLo, riskLo] = curve[segment];
    const [packHi, riskHi] = curve[segment + 1];
    return riskLo + ((packYears - packLo) / (packHi - packLo)) * (riskHi - riskLo);
  }

  fetch(curveJsonUrl)
    .then(function (response) {
      if (!response.ok) throw new Error("HTTP " + response.status);
      return response.json();
    })
    .then(function (config) {
      const empiricalCurve = config.curve;
      const horizonYears = config.horizonYears;
      const packYearsMin = config.ranges.packYears.min;
      const packYearsMax = config.ranges.packYears.max;
      const packYearsStep = config.pyStep;
      const cigsPerDayMin = Math.round(config.ranges.cigsPerDay.min);
      const cigsPerDayMax = Math.round(config.ranges.cigsPerDay.max);
      const packYearSliderSteps = Math.max(1, Math.round((packYearsMax - packYearsMin) / packYearsStep));
      const startingPackSliderValue = Math.max(
        0,
        Math.min(packYearSliderSteps, Math.round((config.defaults.packYears - packYearsMin) / packYearsStep))
      );
      const startingCigsPerDay = Math.max(
        cigsPerDayMin,
        Math.min(cigsPerDayMax, Math.round(config.defaults.cigsPerDay))
      );

      const packYearsSlider = document.getElementById("py-slider");
      const cigsPerDaySlider = document.getElementById("cpd-slider");
      const packYearsReadout = document.getElementById("py-val");
      const cigsPerDayReadout = document.getElementById("cpd-val");
      const chartSvg = document.getElementById("quit-chart-svg");
      if (!packYearsSlider || !cigsPerDaySlider || !chartSvg) return;

      packYearsSlider.min = 0;
      packYearsSlider.max = packYearSliderSteps;
      packYearsSlider.step = 1;
      packYearsSlider.value = startingPackSliderValue;
      cigsPerDaySlider.min = cigsPerDayMin;
      cigsPerDaySlider.max = cigsPerDayMax;
      cigsPerDaySlider.step = 1;
      cigsPerDaySlider.value = startingCigsPerDay;

      const controls = document.getElementById("controls");
      if (controls) controls.hidden = false;

      const margin = { top: 24, right: 20, bottom: 48, left: 56 };
      const plotWidth = 720 - margin.left - margin.right;
      const plotHeight = 300 - margin.top - margin.bottom;
      const chartWidth = plotWidth + margin.left + margin.right;
      const chartHeight = plotHeight + margin.top + margin.bottom;

      const svg = d3
        .select(chartSvg)
        .attr("viewBox", "0 0 " + chartWidth + " " + chartHeight)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .attr("width", "100%")
        .attr("overflow", "visible");
      const chartGroup = svg
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

      const xScale = d3.scaleLinear().domain([-horizonYears, horizonYears]).range([0, plotWidth]);
      const yScale = d3.scaleLinear().domain([0, 100]).range([plotHeight, 0]);

      chartGroup
        .append("line")
        .attr("x1", xScale(0))
        .attr("x2", xScale(0))
        .attr("y1", 0)
        .attr("y2", plotHeight)
        .attr("stroke", "#9ca3af")
        .attr("stroke-dasharray", "4 4");

      chartGroup
        .append("g")
        .attr("transform", "translate(0," + plotHeight + ")")
        .call(
          d3
            .axisBottom(xScale)
            .ticks(Math.min(2 * horizonYears + 1, 12))
            .tickFormat(d3.format("d"))
        );

      chartGroup.append("g").call(d3.axisLeft(yScale).ticks(6));

      svg
        .append("text")
        .attr("x", margin.left + plotWidth / 2)
        .attr("y", chartHeight - 8)
        .attr("text-anchor", "middle")
        .attr("fill", "#1a1a1a")
        .text("Years from today");

      svg
        .append("text")
        .attr(
          "transform",
          "translate(" + margin.left / 2 + "," + (margin.top + plotHeight / 2) + ") rotate(-90)"
        )
        .attr("text-anchor", "middle")
        .attr("fill", "#1a1a1a")
        .text("Chance of Cancer");

      const linePath = d3
        .line()
        .x(function (point) {
          return xScale(point.year);
        })
        .y(function (point) {
          return yScale(point.risk);
        });

      const pathKeepSmoking = chartGroup
        .append("path")
        .attr("fill", "none")
        .attr("stroke", "#dc2626")
        .attr("stroke-width", 2);
      const pathQuitToday = chartGroup
        .append("path")
        .attr("fill", "none")
        .attr("stroke", "#2563eb")
        .attr("stroke-width", 2);

      function redraw() {
        const packYearsToday = packYearsMin + packYearsStep * +packYearsSlider.value;
        const cigsPerDay = +cigsPerDaySlider.value;
        packYearsReadout.textContent = packYearsToday.toFixed(1);
        cigsPerDayReadout.textContent = String(cigsPerDay);

        const pointsKeepSmoking = [];
        for (let yearFromToday = -horizonYears; yearFromToday <= horizonYears; yearFromToday++) {
          const packYearsAtThatYear = Math.max(0, packYearsToday + (cigsPerDay / 20) * yearFromToday);
          pointsKeepSmoking.push({
            year: yearFromToday,
            risk: riskAtPackYears(packYearsAtThatYear, empiricalCurve),
          });
        }

        const riskIfQuitToday = riskAtPackYears(packYearsToday, empiricalCurve);
        const pointsQuitToday = [];
        for (let futureYear = 0; futureYear <= horizonYears; futureYear++) {
          pointsQuitToday.push({ year: futureYear, risk: riskIfQuitToday });
        }

        pathKeepSmoking.datum(pointsKeepSmoking).attr("d", linePath);
        pathQuitToday.datum(pointsQuitToday).attr("d", linePath);
      }

      packYearsSlider.addEventListener("input", redraw);
      cigsPerDaySlider.addEventListener("input", redraw);
      redraw();
    })
    .catch(function (error) {
      const errorMessage = document.getElementById("load-err");
      if (!errorMessage) return;
      errorMessage.hidden = false;
      errorMessage.textContent =
        "Could not load chart data (" +
        (error && error.message ? error.message : "unknown error") +
        "). Use a local HTTP server from the Final Project folder (not file://).";
    });
})();
