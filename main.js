
const FILES = {
  usMexicoNational: "data/clean/us_mexico_national.json",      // Entity, Year, Cause, Deaths
  usStates: "data/clean/us_states_top10.json"                 // State, Year, Cause Name, Deaths
};

let usMexicoRows = [];
let usStatesRows = [];

async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path} (${res.status})`);
  return await res.json();
}

function unique(arr) { return [...new Set(arr)]; }
function safeNum(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function fmt(n) {
  const x = safeNum(n);
  return x.toLocaleString();
}

function pctChange(a, b) {
  const x = safeNum(a), y = safeNum(b);
  if (x === 0) return null;
  return ((y - x) / x) * 100;
}

function insightGap(us, mx, year, cause) {
  const u = safeNum(us), m = safeNum(mx);
  const diff = u - m;
  const ratio = (m === 0) ? null : (u / m);
  const bigger = diff === 0 ? "the same" : (diff > 0 ? "higher" : "lower");
  const parts = [
    `In ${year}, the U.S. recorded ${fmt(u)} deaths from ${cause}; Mexico recorded ${fmt(m)}.`
  ];
  parts.push(`The U.S. total is ${bigger} than Mexico by ${fmt(Math.abs(diff))} deaths.`);
  if (ratio !== null && Number.isFinite(ratio) && ratio !== 0) {
    parts.push(`That’s about ${(ratio).toFixed(2)}× Mexico’s count.`);
  }
  parts.push("Use the trend view to see whether this gap grows or shrinks over time.");
  return parts;
}

function hasUSStateDataForCause(cause) {
  return usStatesRows.some(r => (r["Cause Name"] || r["Cause"]) === cause);
}

function updateVizAvailability() {
  const cause = document.getElementById("causeSelect")?.value;
  const vizSelect = document.getElementById("vizSelect");
  if (!vizSelect) return;

  const hasState = hasUSStateDataForCause(cause);
  // Disable state views if we don't have state-level data for the selected cause (ex: Mental health/suicide).
  [...vizSelect.options].forEach(opt => {
    if (opt.value === "usStateBar" || opt.value === "usBubble") {
      opt.disabled = !hasState;
      if (!hasState) opt.textContent = opt.textContent.replace(" (disabled)", "") + " (disabled)";
      else opt.textContent = opt.textContent.replace(" (disabled)", "");
    }
    if (opt.value === "mhCompare") {
      // mhCompare needs a non-mental-health cause selected.
      opt.disabled = (cause === "Mental health/suicide");
      if (opt.disabled) opt.textContent = opt.textContent.replace(" (disabled)", "") + " (disabled)";
      else opt.textContent = opt.textContent.replace(" (disabled)", "");
    }
  });

  // If the currently selected viz is disabled, fall back to bar.
  const current = vizSelect.value;
  const currentOpt = [...vizSelect.options].find(o => o.value === current);
  if (currentOpt && currentOpt.disabled) {
    vizSelect.value = "bar";
  }
}

function setNote(text) {
  const el = document.getElementById("chartNote");
  if (el) el.textContent = text || "";
}

function setInsights(items) {
  const ul = document.getElementById("insights");
  if (!ul) return;
  ul.innerHTML = "";
  items.forEach(t => {
    const li = document.createElement("li");
    li.textContent = t;
    ul.appendChild(li);
  });
}

function populateCauseDropdown() {
  const causes = unique(usMexicoRows.map(r => r.Cause)).sort();
  const select = document.getElementById("causeSelect");
  select.innerHTML = "";

  causes.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    select.appendChild(opt);
  });

  select.value = causes.includes("Heart disease") ? "Heart disease" : causes[0];
  updateVizAvailability();
}

/* ---------- Bar: US vs Mexico (selected year) ---------- */
function renderBar(cause, year) {
  setNote("");
  const rows = usMexicoRows.filter(r => r.Cause === cause && Number(r.Year) === Number(year));

  const us = rows.find(r => r.Entity === "United States");
  const mx = rows.find(r => r.Entity === "Mexico");

  const x = ["United States", "Mexico"];
  const y = [safeNum(us?.Deaths), safeNum(mx?.Deaths)];

  Plotly.newPlot("chart", [{
    type: "bar",
    x, y
  }], {
    title: `${cause} deaths (US vs Mexico) — ${year}`,
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { color: "#f8f9fa" },
    yaxis: { title: "Deaths" }
  }, { responsive: true });

  setInsights(insightGap(y[0], y[1], year, cause));
}

/* ---------- Scatter-by-year: US vs Mexico ---------- */
function renderTrendScatter(cause) {
  setNote("");
  const rows = usMexicoRows.filter(r => r.Cause === cause);

  const us = rows.filter(r => r.Entity === "United States").sort((a,b)=>a.Year-b.Year);
  const mx = rows.filter(r => r.Entity === "Mexico").sort((a,b)=>a.Year-b.Year);

  Plotly.newPlot("chart", [
    { type:"scatter", mode:"markers+lines", name:"United States", x: us.map(r=>r.Year), y: us.map(r=>safeNum(r.Deaths)) },
    { type:"scatter", mode:"markers+lines", name:"Mexico", x: mx.map(r=>r.Year), y: mx.map(r=>safeNum(r.Deaths)) }
  ], {
    title: `${cause}: US vs Mexico (Scatter by Year)`,
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { color: "#f8f9fa" },
    xaxis: { title: "Year" },
    yaxis: { title: "Deaths" }
  }, { responsive: true });

    // Insight: change from first to last year (using the data actually present)
  const years = usSeries.map(d=>Number(d.Year));
  const firstY = years[0], lastY = years[years.length-1];
  const usFirst = safeNum(usSeries[0]?.Deaths), usLast = safeNum(usSeries[usSeries.length-1]?.Deaths);
  const mxFirst = safeNum(mxSeries[0]?.Deaths), mxLast = safeNum(mxSeries[mxSeries.length-1]?.Deaths);

  const usPct = pctChange(usFirst, usLast);
  const mxPct = pctChange(mxFirst, mxLast);

  const insight = [
    `From ${firstY} to ${lastY}, U.S. ${cause} deaths changed from ${fmt(usFirst)} to ${fmt(usLast)}${usPct===null ? "" : ` (${usPct.toFixed(1)}%)`}.`,
    `From ${firstY} to ${lastY}, Mexico ${cause} deaths changed from ${fmt(mxFirst)} to ${fmt(mxLast)}${mxPct===null ? "" : ` (${mxPct.toFixed(1)}%)`}.`,
    `Compare the two lines to see whether the gap widens, narrows, or stays stable over time.`
  ];
  setInsights(insight);
}


/* ---------- US “heat” bubble map (scattergeo) ---------- */
function renderUSBubble(cause, year) {
  setNote("");

  const rowsCause = usStatesRows.filter(r => (r["Cause Name"] || r["Cause"]) === cause);
  if (!rowsCause.length) {
    Plotly.purge("chart");
    setNote("No US state rows found for this cause in us_states_top10.json");
    setInsights([
      "Check that your US state JSON includes this cause.",
      "Make sure the key is 'Cause Name' (or 'Cause').",
      "Try another cause."
    ]);
    return;
  }

  const rows = rowsCause.filter(r => Number(r.Year) === Number(year));
  const latestYear = year;

  const stateToAbbr = {
    "Alabama":"AL","Alaska":"AK","Arizona":"AZ","Arkansas":"AR","California":"CA","Colorado":"CO","Connecticut":"CT",
    "Delaware":"DE","District of Columbia":"DC","Florida":"FL","Georgia":"GA","Hawaii":"HI","Idaho":"ID","Illinois":"IL",
    "Indiana":"IN","Iowa":"IA","Kansas":"KS","Kentucky":"KY","Louisiana":"LA","Maine":"ME","Maryland":"MD","Massachusetts":"MA",
    "Michigan":"MI","Minnesota":"MN","Mississippi":"MS","Missouri":"MO","Montana":"MT","Nebraska":"NE","Nevada":"NV","New Hampshire":"NH",
    "New Jersey":"NJ","New Mexico":"NM","New York":"NY","North Carolina":"NC","North Dakota":"ND","Ohio":"OH","Oklahoma":"OK","Oregon":"OR",
    "Pennsylvania":"PA","Rhode Island":"RI","South Carolina":"SC","South Dakota":"SD","Tennessee":"TN","Texas":"TX","Utah":"UT","Vermont":"VT",
    "Virginia":"VA","Washington":"WA","West Virginia":"WV","Wisconsin":"WI","Wyoming":"WY"
  };

  const locations = [];
  const size = [];
  const text = [];

  rows.forEach(r => {
    const abbr = stateToAbbr[r.State];
    if (!abbr) return;
    const d = safeNum(r.Deaths);
    locations.push(abbr);
    size.push(Math.max(4, Math.sqrt(d) / 2));
    text.push(`${r.State}<br>Deaths: ${d.toLocaleString()}`);
  });

  Plotly.newPlot("chart", [{
    type: "scattergeo",
    locationmode: "USA-states",
    locations,
    text,
    marker: { size, opacity: 0.8 }
  }], {
    title: `US “Heat” Bubble Map: ${cause} — ${latestYear}`,
    geo: { scope: "usa", bgcolor: "rgba(0,0,0,0)" },
    paper_bgcolor: "rgba(0,0,0,0)",
    font: { color: "#f8f9fa" }
  }, { responsive: true });

  const top = [...rows].sort((a,b)=>safeNum(b.Deaths)-safeNum(a.Deaths)).slice(0,3);
  setInsights([
    `Top US states in ${latestYear}: ${top.map(s => `${s.State} (${safeNum(s.Deaths).toLocaleString()})`).join(", ")}.`,
    `Bubble size indicates magnitude of deaths (larger = more deaths).`,
    `This supports geographic pattern identification for leading causes and mental health context.`
  ]);
}


/* ---------- US states bar chart (all states in one chart) ---------- */
function renderUSStatesBar(cause, year) {
  setNote("");
  const rows = usStatesRows
    .filter(r => (r["Cause Name"] || r["Cause"]) === cause && Number(r.Year) === Number(year))
    .sort((a,b)=>safeNum(b.Deaths)-safeNum(a.Deaths));

  if (!rows.length) {
    Plotly.purge("chart");
    setNote("No US state rows found for this cause/year.");
    setInsights([
      "Try a different year (2000/2005/2010/2015).",
      "Or switch to a different cause."
    ]);
    return;
  }

  const x = rows.map(r => r.State);
  const y = rows.map(r => safeNum(r.Deaths));

  Plotly.newPlot("chart", [{
    type: "bar",
    x, y
  }], {
    title: `US States: ${cause} deaths — ${year}`,
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { color: "#f8f9fa" },
    xaxis: { title: "State", tickangle: -45, automargin: true },
    yaxis: { title: "Deaths" }
  }, { responsive: true });

  const top = rows.slice(0,3);
  setInsights([
    `Top 3 states in ${year}: ${top.map(s => `${s.State} (${safeNum(s.Deaths).toLocaleString()})`).join(", ")}.`,
    "This view shows the full distribution across states (not just the top few).",
    "Use the bubble map to spot geographic clustering patterns."
  ]);
}

/* ---------- Mental health relationship: disease vs mental health ---------- */
function renderMentalHealthCompare(cause) {
  setNote("");
  if (cause === "Mental health/suicide") {
    Plotly.purge("chart");
    setNote("Pick a cause other than 'Mental health/suicide' for this relationship view.");
    setInsights([
      "This plot compares a selected cause against Mental health/suicide deaths.",
      "Choose Heart disease, Cancer, Stroke, etc."
    ]);
    return;
  }

  const years = [2000, 2005, 2010, 2015];

  function getDeaths(entity, c, y) {
    const r = usMexicoRows.find(r => r.Entity === entity && r.Cause === c && Number(r.Year) === Number(y));
    return safeNum(r?.Deaths);
  }

  const points = [];
  ["United States","Mexico"].forEach(entity => {
    years.forEach(y => {
      points.push({
        Entity: entity,
        Year: y,
        Disease: getDeaths(entity, cause, y),
        Mental: getDeaths(entity, "Mental health/suicide", y)
      });
    });
  });

  Plotly.newPlot("chart", [
    {
      type: "scatter",
      mode: "markers+text",
      name: "United States",
      x: points.filter(p=>p.Entity==="United States").map(p=>p.Disease),
      y: points.filter(p=>p.Entity==="United States").map(p=>p.Mental),
      text: points.filter(p=>p.Entity==="United States").map(p=>String(p.Year)),
      textposition: "top center"
    },
    {
      type: "scatter",
      mode: "markers+text",
      name: "Mexico",
      x: points.filter(p=>p.Entity==="Mexico").map(p=>p.Disease),
      y: points.filter(p=>p.Entity==="Mexico").map(p=>p.Mental),
      text: points.filter(p=>p.Entity==="Mexico").map(p=>String(p.Year)),
      textposition: "top center"
    }
  ], {
    title: `${cause} deaths vs Mental health/suicide deaths (2000/2005/2010/2015)`,
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { color: "#f8f9fa" },
    xaxis: { title: `${cause} deaths` },
    yaxis: { title: "Mental health/suicide deaths" }
  }, { responsive: true });

  setInsights([
    "Each point is a 5-year snapshot (year labels on points).",
    "If points move up/right over time, both the cause and mental health burden are increasing together.",
    "Compare the US vs Mexico point clouds to see whether the relationship looks similar across countries."
  ]);
}

function renderFromUI() {
  const cause = document.getElementById("causeSelect").value;
  const viz = document.getElementById("vizSelect").value;
  const year = document.getElementById("yearSelect").value;

  // Guard: if selected viz needs state-level rows but the selected cause has none, don’t error—fall back nicely.
  if ((viz === "usStateBar" || viz === "usBubble") && !hasUSStateDataForCause(cause)) {
    setNote("State-level data is not available for this cause. Switching to the national view.");
    document.getElementById("vizSelect").value = "bar";
    renderBar(cause, year);
    return;
  }

  if (viz === "bar") renderBar(cause, year);
  else if (viz === "trend") renderTrendScatter(cause);
  else if (viz === "usStateBar") renderUSStatesBar(cause, year);
  else if (viz === "usBubble") renderUSBubble(cause, year);
  else if (viz === "mhCompare") renderMentalHealthCompare(cause);
}

async function init() {
  try {
    usMexicoRows = await loadJSON(FILES.usMexicoNational);
    usStatesRows = await loadJSON(FILES.usStates);

    populateCauseDropdown();
    updateVizAvailability();
    document.getElementById("causeSelect").addEventListener("change", () => { updateVizAvailability(); renderFromUI(); });
    document.getElementById("vizSelect").addEventListener("change", renderFromUI);
    document.getElementById("yearSelect").addEventListener("change", renderFromUI);
    renderFromUI();
  } catch (err) {
    console.error(err);
    setNote("ERROR loading JSON files. Open DevTools Console to see details.");
  }
}

document.addEventListener("DOMContentLoaded", init);
