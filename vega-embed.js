
(function () {
  var VEGA = "https://cdn.jsdelivr.net/npm/vega@6?noext";
  var VEGA_LITE = "https://cdn.jsdelivr.net/npm/vega-lite@6.1.0?noext";
  var VEGA_EMBED = "https://cdn.jsdelivr.net/npm/vega-embed@7?noext";

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = function () {
        resolve();
      };
      s.onerror = function () {
        reject(new Error("Failed to load " + src));
      };
      document.head.appendChild(s);
    });
  }

  var libsPromise = null;
  function ensureLibs() {
    if (!libsPromise) {
      libsPromise = loadScript(VEGA)
        .then(function () {
          return loadScript(VEGA_LITE);
        })
        .then(function () {
          return loadScript(VEGA_EMBED);
        });
    }
    return libsPromise;
  }

  function showError(host, message) {
    host.innerHTML = "";
    var p = document.createElement("p");
    p.className = "vl-error";
    p.textContent = message;
    host.appendChild(p);
  }
  function reshapeFourUnitHconcatToTwoByTwo(spec) {
    if (!spec || !Array.isArray(spec.hconcat) || spec.hconcat.length !== 4) return;
    var cells = spec.hconcat;
    for (var i = 0; i < 4; i++) {
      var c = cells[i];
      if (
        !c ||
        typeof c !== "object" ||
        c.hconcat ||
        c.vconcat ||
        c.concat ||
        c.facet ||
        c.repeat ||
        c.spec ||
        !c.mark ||
        !c.encoding
      ) {
        return;
      }
    }
    spec.vconcat = [
      { hconcat: [cells[0], cells[1]] },
      { hconcat: [cells[2], cells[3]] },
    ];
    delete spec.hconcat;
  }
  
  function patchSpecResponsive(spec) {
    if (!spec || typeof spec !== "object") return spec;

    reshapeFourUnitHconcatToTwoByTwo(spec);

    function visit(node) {
      if (!node || typeof node !== "object") return;
      if (typeof node.width === "number" && isFinite(node.width)) {
        node.width = "container";
      }
      var concatKeys = ["hconcat", "vconcat", "concat"];
      for (var i = 0; i < concatKeys.length; i++) {
        var arr = node[concatKeys[i]];
        if (!Array.isArray(arr)) continue;
        for (var j = 0; j < arr.length; j++) {
          var child = arr[j];
          visit(child);
          if (
            child &&
            typeof child === "object" &&
            child.mark &&
            child.encoding &&
            !child.layer &&
            (child.width === undefined || child.width === null)
          ) {
            child.width = "container";
          }
        }
      }
      if (Array.isArray(node.layer)) {
        for (var k = 0; k < node.layer.length; k++) {
          visit(node.layer[k]);
        }
      }
      if (node.spec) {
        visit(node.spec);
        if (
          (node.facet || node.repeat) &&
          node.spec &&
          node.spec.mark &&
          node.spec.encoding &&
          !node.spec.layer &&
          (node.spec.width === undefined || node.spec.width === null)
        ) {
          node.spec.width = "container";
        }
      }
    }

    visit(spec);
    return spec;
  }

  function embedOne(host) {
    var url = host.getAttribute("data-vl-spec");
    if (!url) return Promise.resolve();

    return ensureLibs()
      .then(function () {
        return fetch(url);
      })
      .then(function (res) {
        if (!res.ok) throw new Error("Could not load chart (" + res.status + ")");
        return res.json();
      })
      .then(function (spec) {
        return vegaEmbed(host, patchSpecResponsive(spec), {
          actions: false,
          renderer: "svg",
          resize: true,
        });
      })
      .catch(function (err) {
        showError(host, err.message || String(err));
      });
  }

  function init() {
    var hosts = document.querySelectorAll("[data-vl-spec]");
    var tasks = [];
    for (var i = 0; i < hosts.length; i++) {
      tasks.push(embedOne(hosts[i]));
    }
    return Promise.all(tasks);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
