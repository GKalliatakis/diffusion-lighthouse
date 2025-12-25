# scripts/utils.py
import json
import os
import time
from typing import Any, Dict


def read_json(path, default):
    # type: (str, Any) -> Any
    if not os.path.exists(path):
        return default
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def write_json(path, obj):
    # type: (str, Any) -> None
    d = os.path.dirname(path)
    if d:
        os.makedirs(d, exist_ok=True)

    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2, sort_keys=True)
    os.replace(tmp, path)


def append_jsonl(path, obj):
    # type: (str, Dict[str, Any]) -> None
    d = os.path.dirname(path)
    if d:
        os.makedirs(d, exist_ok=True)

    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(obj, ensure_ascii=False) + "\n")


def now_utc_iso():
    # type: () -> str
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def sleep_backoff(attempt):
    # type: (int) -> None
    base = min(60, 2 ** attempt)
    time.sleep(base + (attempt % 3))
