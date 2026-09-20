# CPU Scheduling Simulator

A 4-page scrolling web app for simulating CPU scheduling algorithms, built with a
Python **Flask** backend, a **SQLite** database, and a "liquid glass" (glassmorphism)
HTML/CSS/JS frontend.

## Pages (single scrolling site)

1. **Algorithms** — introduces the simulator and lists every supported policy.
2. **Input & Run** — add processes (arrival time, burst time, priority), pick an
   algorithm, set the time quantum for Round Robin, and click **Generate Schedule**.
   Shows the resulting **Gantt chart** plus turnaround/waiting time analytics.
3. **TAT / WT** — a clean table of turnaround time and waiting time per process.
4. **Process Table** — full breakdown (burst time, arrival time, priority, completion
   time), CPU utilization / busy / idle time, and a **history panel pulled live from
   SQLite** showing your most recent runs.

## Algorithms implemented

| Key      | Algorithm                        | Type          |
|----------|-----------------------------------|---------------|
| fcfs     | First Come, First Served          | Non-preemptive|
| sjf      | Shortest Job First                | Non-preemptive|
| srt      | Shortest Remaining Time           | Preemptive    |
| rr       | Round Robin                       | Preemptive    |
| hrn      | Highest Response Ratio Next       | Non-preemptive|
| priority | Priority Scheduling               | Non-preemptive|

All algorithms live in `scheduler.py` as plain Python functions, independent of Flask,
so they're easy to test or extend.

## Project structure

```
cpu_scheduling_simulator/
├── app.py              # Flask app & API routes
├── scheduler.py         # scheduling algorithms (pure Python)
├── database.py           # SQLite helpers (init, save run, fetch history)
├── requirements.txt
├── templates/
│   └── index.html         # all 4 scrolling sections
└── static/
    ├── css/style.css       # liquid glass theme
    └── js/main.js           # process table, fetch calls, gantt + charts
```

## Setup

```bash
cd cpu_scheduling_simulator
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Then open **http://127.0.0.1:5000** in your browser.

The SQLite file `cpu_scheduler.db` is created automatically on first run
(tables `runs` and `processes`) — no manual setup needed.

## API

- `POST /api/schedule` — body `{ algorithm, quantum, processes: [{pid, at, bt, priority}] }`
  → returns `{ gantt, results, stats }` and saves the run to SQLite.
- `GET /api/history` — returns the last 8 saved runs.

## Notes

- Burst times are treated as whole time units (integers); SRT and Round Robin are
  simulated one time unit at a time.
- Priority: **lower number = higher priority**.
- The "liquid glass" look uses `backdrop-filter: blur()` — for best results view in a
  recent version of Chrome, Edge, or Safari.
