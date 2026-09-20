"""
scheduler.py
CPU scheduling algorithms: FCFS, SJF, SRT, RR, HRN, Priority (non-preemptive).
Every function takes a list of process dicts:
    {"pid": "P1", "at": 0, "bt": 5, "priority": 1, "idx": 0}
and returns (gantt, results) where:
    gantt   = [{"pid": "P1", "start": 0, "end": 5}, ...]   ("idle" pid = CPU idle)
    results = [{"pid","at","bt","ct","tat","wt","idx"}, ...]  (unsorted / completion order)
"""


def _make_result(p, ct):
    return {
        "pid": p["pid"],
        "at": p["at"],
        "bt": p["bt"],
        "ct": ct,
        "tat": ct - p["at"],
        "wt": ct - p["at"] - p["bt"],
        "idx": p["idx"],
    }


def fcfs(procs):
    order = sorted(procs, key=lambda p: (p["at"], p["idx"]))
    time = 0
    gantt, results = [], []
    for p in order:
        if time < p["at"]:
            gantt.append({"pid": "idle", "start": time, "end": p["at"]})
            time = p["at"]
        start, end = time, time + p["bt"]
        gantt.append({"pid": p["pid"], "start": start, "end": end})
        time = end
        results.append(_make_result(p, end))
    return gantt, results


def _non_preemptive(procs, sort_key_fn):
    """sort_key_fn(current_time) -> function(p) -> sort key; smallest key runs next."""
    n = len(procs)
    done = set()
    time = 0
    completed = 0
    gantt, results = [], []
    while completed < n:
        candidates = [p for p in procs if p["idx"] not in done and p["at"] <= time]
        if not candidates:
            remaining = [p for p in procs if p["idx"] not in done]
            next_at = min(p["at"] for p in remaining)
            if next_at > time:
                gantt.append({"pid": "idle", "start": time, "end": next_at})
                time = next_at
            continue
        key_fn = sort_key_fn(time)
        p = min(candidates, key=key_fn)
        start, end = time, time + p["bt"]
        gantt.append({"pid": p["pid"], "start": start, "end": end})
        time = end
        done.add(p["idx"])
        completed += 1
        results.append(_make_result(p, end))
    return gantt, results


def sjf(procs):
    return _non_preemptive(procs, lambda t: (lambda p: (p["bt"], p["at"], p["idx"])))


def priority_np(procs):
    return _non_preemptive(procs, lambda t: (lambda p: (p["priority"], p["at"], p["idx"])))


def hrn(procs):
    # Highest Response Ratio Next: response ratio = (waiting + burst) / burst
    # Pick the process with the HIGHEST ratio -> negate it so `min()` still works.
    def key_at(t):
        def key(p):
            ratio = ((t - p["at"]) + p["bt"]) / p["bt"]
            return (-ratio, p["at"], p["idx"])
        return key
    return _non_preemptive(procs, key_at)


def srt(procs):
    n = len(procs)
    remaining = {p["idx"]: p["bt"] for p in procs}
    completion = {}
    time = 0
    completed = 0
    raw_gantt = []
    last_pid = None
    seg_start = 0
    guard = sum(p["bt"] for p in procs) + max(p["at"] for p in procs) + 5

    while completed < n and time < guard:
        idx = -1
        min_rem = float("inf")
        for p in procs:
            if p["at"] <= time and remaining[p["idx"]] > 0 and remaining[p["idx"]] < min_rem:
                min_rem = remaining[p["idx"]]
                idx = p["idx"]
        current_pid = "idle" if idx == -1 else next(p["pid"] for p in procs if p["idx"] == idx)

        if current_pid != last_pid:
            if last_pid is not None:
                raw_gantt.append({"pid": last_pid, "start": seg_start, "end": time})
            seg_start = time
            last_pid = current_pid

        if idx != -1:
            remaining[idx] -= 1
            time += 1
            if remaining[idx] == 0:
                completed += 1
                completion[idx] = time
        else:
            time += 1

    if last_pid is not None:
        raw_gantt.append({"pid": last_pid, "start": seg_start, "end": time})

    results = [_make_result(p, completion[p["idx"]]) for p in procs]
    return raw_gantt, results


def round_robin(procs, quantum):
    n = len(procs)
    remaining = {p["idx"]: p["bt"] for p in procs}
    completion = {}
    in_queue = {p["idx"]: False for p in procs}
    arrival_order = sorted(procs, key=lambda p: (p["at"], p["idx"]))
    ptr = 0
    time = 0
    completed = 0
    queue = []
    gantt = []

    def enqueue_up_to(t):
        nonlocal ptr
        while ptr < n and arrival_order[ptr]["at"] <= t:
            idx = arrival_order[ptr]["idx"]
            if not in_queue[idx] and remaining[idx] > 0:
                queue.append(idx)
                in_queue[idx] = True
            ptr += 1

    enqueue_up_to(time)
    if not queue and ptr < n:
        time = arrival_order[0]["at"]
        enqueue_up_to(time)

    by_idx = {p["idx"]: p for p in procs}

    while completed < n:
        if not queue:
            time = arrival_order[ptr]["at"]
            enqueue_up_to(time)
            continue
        idx = queue.pop(0)
        in_queue[idx] = False
        run = min(quantum, remaining[idx])
        start = time
        time += run
        remaining[idx] -= run
        gantt.append({"pid": by_idx[idx]["pid"], "start": start, "end": time})
        enqueue_up_to(time)
        if remaining[idx] > 0:
            queue.append(idx)
            in_queue[idx] = True
        else:
            completed += 1
            completion[idx] = time

    merged = []
    for seg in gantt:
        if merged and merged[-1]["pid"] == seg["pid"] and merged[-1]["end"] == seg["start"]:
            merged[-1]["end"] = seg["end"]
        else:
            merged.append(dict(seg))

    results = [_make_result(p, completion[p["idx"]]) for p in procs]
    return merged, results


ALGORITHMS = {
    "fcfs": lambda procs, quantum: fcfs(procs),
    "sjf": lambda procs, quantum: sjf(procs),
    "srt": lambda procs, quantum: srt(procs),
    "rr": lambda procs, quantum: round_robin(procs, quantum),
    "hrn": lambda procs, quantum: hrn(procs),
    "priority": lambda procs, quantum: priority_np(procs),
}


def run_algorithm(algo_key, procs, quantum=2):
    if algo_key not in ALGORITHMS:
        raise ValueError(f"Unknown algorithm: {algo_key}")
    gantt, results = ALGORITHMS[algo_key](procs, quantum)
    results.sort(key=lambda r: r["idx"])

    total_time = max(seg["end"] for seg in gantt) if gantt else 0
    busy_time = sum(seg["end"] - seg["start"] for seg in gantt if seg["pid"] != "idle")
    n = len(results)
    avg_tat = sum(r["tat"] for r in results) / n if n else 0
    avg_wt = sum(r["wt"] for r in results) / n if n else 0
    cpu_utilization = (busy_time / total_time * 100) if total_time else 0
    throughput = (n / total_time) if total_time else 0

    stats = {
        "total_time": total_time,
        "busy_time": busy_time,
        "idle_time": total_time - busy_time,
        "avg_tat": round(avg_tat, 2),
        "avg_wt": round(avg_wt, 2),
        "cpu_utilization": round(cpu_utilization, 2),
        "throughput": round(throughput, 4),
    }
    return gantt, results, stats
