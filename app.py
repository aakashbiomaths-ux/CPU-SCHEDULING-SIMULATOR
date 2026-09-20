"""
app.py
CPU Scheduling Simulator - Flask backend.
Run with:  python app.py
Then open: http://127.0.0.1:5000
"""
from flask import Flask, render_template, request, jsonify

from scheduler import run_algorithm, ALGORITHMS
import database

app = Flask(__name__)

ALGO_LABELS = {
    "fcfs": "First Come, First Served",
    "sjf": "Shortest Job First",
    "srt": "Shortest Remaining Time",
    "rr": "Round Robin",
    "hrn": "Highest Response Ratio Next",
    "priority": "Priority Scheduling",
}


@app.route("/")
def index():
    return render_template("index.html", algorithms=ALGO_LABELS)


@app.route("/api/schedule", methods=["POST"])
def api_schedule():
    payload = request.get_json(force=True) or {}
    algo = payload.get("algorithm")
    quantum = int(payload.get("quantum") or 2)
    raw_processes = payload.get("processes") or []

    if algo not in ALGORITHMS:
        return jsonify({"error": "Unknown or missing algorithm."}), 400
    if not raw_processes:
        return jsonify({"error": "At least one process is required."}), 400

    procs = []
    for i, p in enumerate(raw_processes):
        try:
            procs.append(
                {
                    "pid": p.get("pid") or f"P{i + 1}",
                    "at": max(0, int(p.get("at", 0))),
                    "bt": max(1, int(p.get("bt", 1))),
                    "priority": max(1, int(p.get("priority", 1))),
                    "idx": i,
                }
            )
        except (TypeError, ValueError):
            return jsonify({"error": f"Invalid values for process #{i + 1}."}), 400

    try:
        gantt, results, stats = run_algorithm(algo, procs, quantum)
    except Exception as exc:  # pragma: no cover
        return jsonify({"error": str(exc)}), 400

    # attach priority back onto results for display + persistence
    priority_by_idx = {p["idx"]: p["priority"] for p in procs}
    for r in results:
        r["priority"] = priority_by_idx[r["idx"]]

    run_id = database.save_run(algo, quantum if algo == "rr" else None, stats, results)

    return jsonify(
        {
            "run_id": run_id,
            "algorithm": algo,
            "algorithm_label": ALGO_LABELS.get(algo, algo),
            "quantum": quantum,
            "gantt": gantt,
            "results": results,
            "stats": stats,
        }
    )


@app.route("/api/history")
def api_history():
    return jsonify(database.get_recent_runs(limit=8))


if __name__ == "__main__":
    database.init_db()
    app.run(debug=True)
