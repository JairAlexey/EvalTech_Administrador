#!/usr/bin/env python3
import argparse
import os
import time
import urllib.error
import urllib.request


DEFAULT_BASE_URL = os.getenv("BASE_URL", "https://backend-production-b180.up.railway.app")
DEFAULT_PATH = os.getenv(
    "BACKEND_TEST_PATH", "/events/api/events-status/pending-start/"
)


def build_url(base_url: str, path: str) -> str:
    return f"{base_url.rstrip('/')}/{path.lstrip('/')}"


def request_once(url: str, headers: dict, timeout: float):
    start = time.perf_counter()
    status = None
    error = None
    try:
        req = urllib.request.Request(url, headers=headers, method="GET")
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            resp.read()
            status = resp.status
    except urllib.error.HTTPError as exc:
        status = exc.code
        error = str(exc)
        try:
            exc.read()
        except Exception:
            pass
    except Exception as exc:
        error = str(exc)
    duration_ms = (time.perf_counter() - start) * 1000
    return status, error, duration_ms


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Simple backend response time check."
    )
    parser.add_argument("--url", default=None)
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL)
    parser.add_argument("--path", default=DEFAULT_PATH)
    parser.add_argument("--bearer", default=os.getenv("BACKEND_BEARER_TOKEN", ""))
    parser.add_argument("--count", type=int, default=5)
    parser.add_argument("--pause-ms", type=int, default=0)
    parser.add_argument("--timeout", type=float, default=30.0)
    args = parser.parse_args()

    url = args.url or build_url(args.base_url, args.path)
    headers = {}
    if args.bearer:
        headers["Authorization"] = f"Bearer {args.bearer}"

    durations = []
    ok_count = 0
    fail_count = 0

    print(f"[NF] URL: {url}")
    for idx in range(args.count):
        status, error, duration_ms = request_once(url, headers, args.timeout)
        durations.append(duration_ms)
        ok = status is not None and 200 <= status < 400
        if ok:
            ok_count += 1
        else:
            fail_count += 1
        status_text = status if status is not None else "ERR"
        print(f"[{idx + 1}/{args.count}] status={status_text} ms={duration_ms:.2f}")
        if error:
            print(f"  error={error}")
        if args.pause_ms > 0 and idx + 1 < args.count:
            time.sleep(args.pause_ms / 1000.0)

    if durations:
        avg_ms = sum(durations) / len(durations)
        min_ms = min(durations)
        max_ms = max(durations)
    else:
        avg_ms = min_ms = max_ms = 0.0

    print(
        f"[NF] Summary: ok={ok_count} fail={fail_count} "
        f"avgMs={avg_ms:.2f} minMs={min_ms:.2f} maxMs={max_ms:.2f}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
