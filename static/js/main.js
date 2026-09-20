/* ============================================================
   NAV DOTS
   ============================================================ */
const scroller = document.getElementById('scroller');
const dots = document.querySelectorAll('#dotnav a');
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (e.isIntersecting) {
      dots.forEach((d) => d.classList.remove('active'));
      const match = document.querySelector(`#dotnav a[href="#${e.target.id}"]`);
      if (match) match.classList.add('active');
    }
  });
}, { root: scroller, threshold: 0.5 });
document.querySelectorAll('section').forEach((s) => io.observe(s));
dots.forEach((d) => d.addEventListener('click', (e) => {
  e.preventDefault();
  document.querySelector(d.getAttribute('href')).scrollIntoView({ behavior: 'smooth' });
}));

/* ============================================================
   ALGORITHM BLURBS (page 1 cards)
   ============================================================ */
const ALGO_DESC = {
  fcfs: 'Runs processes strictly in arrival order. Simple and fair on paper, but a long job at the front makes everyone behind it wait.',
  rr: 'Every process gets a fixed time slice in rotation. No process waits too long for its turn.',
  sjf: 'Once the CPU is free, the process with the smallest total burst time goes next.',
  srt: 'The preemptive form of SJF — a newly arrived shorter job interrupts the one currently running.',
  hrn: 'Picks the process with the highest response ratio, (waiting + burst) / burst, balancing short jobs against long-waiting ones.',
  priority: 'The lowest priority number among arrived processes runs first. Ties break by arrival order.',
};
document.querySelectorAll('.algo-desc').forEach((el) => {
  el.textContent = ALGO_DESC[el.dataset.algo] || '';
});

/* ============================================================
   PROCESS INPUT TABLE
   ============================================================ */
const processBody = document.getElementById('processBody');
const algoSelect = document.getElementById('algoSelect');
const quantumField = document.getElementById('quantumField');
const colPriority = document.getElementById('colPriority');
let rowCount = 0;

function addRow(at, bt, pr) {
  rowCount++;
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><span class="pid-badge">P${rowCount}</span></td>
    <td><input type="number" min="0" step="1" class="atInput" value="${at}"></td>
    <td><input type="number" min="1" step="1" class="btInput" value="${bt}"></td>
    <td class="prCell ${algoSelect.value === 'priority' ? 'show' : ''}"><input type="number" min="1" step="1" class="prInput" value="${pr}"></td>
    <td><button class="rm-btn" title="remove">&times;</button></td>`;
  tr.querySelector('.rm-btn').addEventListener('click', () => { tr.remove(); renumberRows(); });
  processBody.appendChild(tr);
}

function renumberRows() {
  rowCount = 0;
  [...processBody.children].forEach((tr) => {
    rowCount++;
    tr.querySelector('.pid-badge').textContent = `P${rowCount}`;
  });
}

function updateAlgoUI() {
  const algo = algoSelect.value;
  quantumField.classList.toggle('show', algo === 'rr');
  colPriority.classList.toggle('show', algo === 'priority');
  document.querySelectorAll('.prCell').forEach((td) => td.classList.toggle('show', algo === 'priority'));
}

document.getElementById('addRowBtn').addEventListener('click', () => addRow(0, 1, 1));
document.getElementById('resetBtn').addEventListener('click', () => {
  processBody.innerHTML = '';
  rowCount = 0;
  seedDefaultRows();
});
algoSelect.addEventListener('change', updateAlgoUI);

function seedDefaultRows() {
  addRow(0, 5, 2);
  addRow(1, 3, 1);
  addRow(2, 8, 3);
  addRow(3, 6, 4);
}
seedDefaultRows();
updateAlgoUI();

/* ============================================================
   GENERATE — call the Flask API, render pages 2 / 3 / 4
   ============================================================ */
const PALETTE = ['#59D9C4', '#F2A65A', '#E5637A', '#8D7BE0', '#6FB1F2', '#C9E05C', '#F294D4', '#5CE0A0'];
let pidColor = {};

function buildProcesses() {
  return [...processBody.children].map((tr, i) => ({
    pid: `P${i + 1}`,
    at: parseInt(tr.querySelector('.atInput').value, 10) || 0,
    bt: parseInt(tr.querySelector('.btInput').value, 10) || 1,
    priority: parseInt(tr.querySelector('.prInput').value, 10) || 1,
  }));
}

function assignColors(results) {
  pidColor = {};
  results.forEach((r, i) => { pidColor[r.pid] = PALETTE[i % PALETTE.length]; });
  pidColor.idle = '#cfd8e0';
}

document.getElementById('generateBtn').addEventListener('click', async () => {
  const processes = buildProcesses();
  if (processes.length === 0) { alert('Add at least one process.'); return; }

  const body = {
    algorithm: algoSelect.value,
    quantum: parseInt(document.getElementById('quantumInput').value, 10) || 2,
    processes,
  };

  const btn = document.getElementById('generateBtn');
  btn.textContent = 'Running…';
  btn.disabled = true;

  try {
    const res = await fetch('/api/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error || 'Something went wrong.'); return; }

    assignColors(data.results);
    renderGantt(data);
    renderResultsTable(data);
    renderFullTable(data);
    loadHistory();

    document.getElementById('ganttSection').style.display = 'block';
    document.getElementById('page2').querySelector('.panel-wide').scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    alert('Could not reach the server. Is the Flask app running?');
  } finally {
    btn.textContent = 'Generate Schedule';
    btn.disabled = false;
  }
});

/* ---------- gantt + bar chart (page 2) ---------- */
function renderGantt(data) {
  document.getElementById('ganttAlgoName').textContent = `${data.algorithm_label}${data.algorithm === 'rr' ? ' · quantum ' + data.quantum : ''}`;

  const row = document.getElementById('ganttRow');
  const ruler = document.getElementById('ganttRuler');
  row.innerHTML = ''; ruler.innerHTML = '';

  const total = data.stats.total_time || 1;
  const pxPerUnit = Math.max(16, Math.min(56, 600 / total));

  data.gantt.forEach((seg) => {
    const dur = seg.end - seg.start;
    if (dur <= 0) return;
    const block = document.createElement('div');
    block.className = `gantt-block${seg.pid === 'idle' ? ' idle' : ''}`;
    block.style.width = `${dur * pxPerUnit}px`;
    if (seg.pid !== 'idle') block.style.background = pidColor[seg.pid];
    block.innerHTML = `<b>${seg.pid === 'idle' ? '—' : seg.pid}</b><span style="font-size:9.5px;opacity:.75">${dur}u</span>`;
    row.appendChild(block);

    const tick = document.createElement('div');
    tick.className = 'tick';
    tick.style.width = `${dur * pxPerUnit}px`;
    tick.textContent = seg.start;
    ruler.appendChild(tick);
  });
  const lastTick = document.createElement('div');
  lastTick.className = 'tick';
  lastTick.textContent = total;
  ruler.appendChild(lastTick);

  const legend = document.getElementById('ganttLegend');
  legend.innerHTML = '';
  Object.keys(pidColor).filter((k) => k !== 'idle').forEach((pid) => {
    legend.insertAdjacentHTML('beforeend', `<span><i style="background:${pidColor[pid]}"></i>${pid}</span>`);
  });
  legend.insertAdjacentHTML('beforeend', '<span><i style="background:#cfd8e0"></i>idle</span>');

  document.getElementById('avgTat').textContent = data.stats.avg_tat;
  document.getElementById('avgWt').textContent = data.stats.avg_wt;
  document.getElementById('cpuUtil').textContent = `${data.stats.cpu_utilization}%`;
  document.getElementById('throughput').textContent = data.stats.throughput;

  drawBarChart(data.results);
}

function drawBarChart(results) {
  const svg = document.getElementById('barChart');
  svg.innerHTML = '';
  const w = 480, h = 240, padL = 34, padB = 34, padT = 12;
  const maxVal = Math.max(1, ...results.map((r) => Math.max(r.tat, r.wt)));
  const groupW = (w - padL - 10) / results.length;
  const barW = Math.min(26, groupW / 2 - 6);

  svg.insertAdjacentHTML('beforeend', `<line x1="${padL}" y1="${padT}" x2="${padL}" y2="${h - padB}" stroke="#1B243033"/>`);
  svg.insertAdjacentHTML('beforeend', `<line x1="${padL}" y1="${h - padB}" x2="${w}" y2="${h - padB}" stroke="#1B243033"/>`);

  results.forEach((r, i) => {
    const gx = padL + i * groupW + groupW / 2;
    const tatH = (r.tat / maxVal) * (h - padB - padT);
    const wtH = (r.wt / maxVal) * (h - padB - padT);
    svg.insertAdjacentHTML('beforeend', `<rect x="${gx - barW - 3}" y="${h - padB - tatH}" width="${barW}" height="${tatH}" fill="#59D9C4" rx="3"/>`);
    svg.insertAdjacentHTML('beforeend', `<rect x="${gx + 3}" y="${h - padB - wtH}" width="${barW}" height="${wtH}" fill="#F2A65A" rx="3"/>`);
    svg.insertAdjacentHTML('beforeend', `<text x="${gx}" y="${h - padB + 16}" font-size="10.5" fill="#5B6B7C" text-anchor="middle" font-family="JetBrains Mono, monospace">${r.pid}</text>`);
  });
  for (let i = 0; i <= 4; i++) {
    const val = Math.round((maxVal * i) / 4);
    const y = h - padB - (i / 4) * (h - padB - padT);
    svg.insertAdjacentHTML('beforeend', `<text x="${padL - 8}" y="${y + 4}" font-size="10" fill="#5B6B7C" text-anchor="end" font-family="JetBrains Mono, monospace">${val}</text>`);
  }
}

/* ---------- results table (page 3) ---------- */
function renderResultsTable(data) {
  document.getElementById('resultsEmpty').style.display = 'none';
  document.getElementById('resultsContent').style.display = 'block';
  const body = document.getElementById('resultsBody');
  body.innerHTML = '';
  data.results.forEach((r) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><span class="pid-badge" style="color:${pidColor[r.pid]}">${r.pid}</span></td>
      <td class="mono">${r.at}</td><td class="mono">${r.bt}</td><td class="mono">${r.ct}</td>
      <td class="mono">${r.tat}</td><td class="mono">${r.wt}</td>`;
    body.appendChild(tr);
  });
}

/* ---------- full process table + system stats (page 4) ---------- */
function renderFullTable(data) {
  document.getElementById('tableEmpty').style.display = 'none';
  document.getElementById('tableContent').style.display = 'block';
  const body = document.getElementById('fullTableBody');
  body.innerHTML = '';
  data.results.forEach((r) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><span class="pid-badge" style="color:${pidColor[r.pid]}">${r.pid}</span></td>
      <td class="mono">${r.bt}</td><td class="mono">${r.at}</td><td class="mono">${r.priority}</td><td class="mono">${r.ct}</td>`;
    body.appendChild(tr);
  });
  document.getElementById('totalTimeStat').textContent = data.stats.total_time;
  document.getElementById('busyTimeStat').textContent = data.stats.busy_time;
  document.getElementById('idleTimeStat').textContent = data.stats.idle_time;
  document.getElementById('cpuUtilStat').textContent = `${data.stats.cpu_utilization}%`;
}

/* ---------- recent runs pulled straight from SQLite ---------- */
async function loadHistory() {
  const body = document.getElementById('historyBody');
  try {
    const res = await fetch('/api/history');
    const rows = await res.json();
    if (!rows.length) { body.innerHTML = '<tr><td colspan="6" class="empty-note">No runs saved yet.</td></tr>'; return; }
    body.innerHTML = rows.map((r) => `
      <tr>
        <td class="mono">#${r.id}</td>
        <td class="mono">${r.algorithm.toUpperCase()}${r.quantum ? ' (q=' + r.quantum + ')' : ''}</td>
        <td class="mono">${r.avg_tat}</td>
        <td class="mono">${r.avg_wt}</td>
        <td class="mono">${r.cpu_utilization}%</td>
        <td class="mono">${r.created_at.replace('T', ' ')}</td>
      </tr>`).join('');
  } catch (e) {
    body.innerHTML = '<tr><td colspan="6" class="empty-note">Could not load history.</td></tr>';
  }
}
loadHistory();
