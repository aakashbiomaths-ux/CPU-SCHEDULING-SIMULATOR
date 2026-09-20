"""
database.py
Tiny SQLite persistence layer. Every time the user clicks "Generate Schedule",
the run (algorithm + resulting stats) and each process's numbers are stored,
so the fourth page can show a short history pulled straight from the database.
"""
import sqlite3
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "cpu_scheduler.db")


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_connection()
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            algorithm TEXT NOT NULL,
            quantum INTEGER,
            created_at TEXT NOT NULL,
            avg_tat REAL,
            avg_wt REAL,
            cpu_utilization REAL,
            throughput REAL,
            total_time INTEGER
        );

        CREATE TABLE IF NOT EXISTS processes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            run_id INTEGER NOT NULL,
            pid TEXT NOT NULL,
            arrival_time INTEGER NOT NULL,
            burst_time INTEGER NOT NULL,
            priority INTEGER,
            completion_time INTEGER,
            turnaround_time INTEGER,
            waiting_time INTEGER,
            FOREIGN KEY (run_id) REFERENCES runs (id)
        );
        """
    )
    conn.commit()
    conn.close()


def save_run(algorithm, quantum, stats, results):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """INSERT INTO runs (algorithm, quantum, created_at, avg_tat, avg_wt,
                              cpu_utilization, throughput, total_time)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            algorithm,
            quantum,
            datetime.utcnow().isoformat(timespec="seconds"),
            stats["avg_tat"],
            stats["avg_wt"],
            stats["cpu_utilization"],
            stats["throughput"],
            stats["total_time"],
        ),
    )
    run_id = cur.lastrowid
    for r in results:
        cur.execute(
            """INSERT INTO processes (run_id, pid, arrival_time, burst_time, priority,
                                       completion_time, turnaround_time, waiting_time)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (run_id, r["pid"], r["at"], r["bt"], r.get("priority"), r["ct"], r["tat"], r["wt"]),
        )
    conn.commit()
    conn.close()
    return run_id


def get_recent_runs(limit=8):
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM runs ORDER BY id DESC LIMIT ?", (limit,)
    ).fetchall()
    conn.close()
    return [dict(row) for row in rows]
