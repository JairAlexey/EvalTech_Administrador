import argparse
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path


DEFAULT_API_BASE = "https://backend-production-b180.up.railway.app"
STATE_PATH = Path(__file__).resolve().parent / "system_run.json"


def _request_json(url, method="GET", token=None, payload=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = None
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req) as response:
            body = response.read().decode("utf-8")
            return response.status, body
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8")
        return exc.code, body


def _json_or_text(body):
    if not body:
        return {}
    try:
        return json.loads(body)
    except json.JSONDecodeError:
        return {"_raw": body}


def _login(api_base, email, password):
    status, body = _request_json(
        f"{api_base}/auth/login/",
        method="POST",
        payload={"email": email, "password": password},
    )
    data = _json_or_text(body)
    if status != 200:
        raise RuntimeError(f"login failed: {data}")
    return data.get("token")


def _load_state():
    if not STATE_PATH.exists():
        return {}
    return json.loads(STATE_PATH.read_text(encoding="utf-8"))


def main():
    parser = argparse.ArgumentParser(description="Verify system test results")
    parser.add_argument("--api-base", default=DEFAULT_API_BASE)
    parser.add_argument("--superadmin-email", required=True)
    parser.add_argument("--superadmin-password", required=True)
    parser.add_argument("--event-id")
    args = parser.parse_args()

    state = _load_state()
    api_base = args.api_base or state.get("api_base", DEFAULT_API_BASE)
    event_id = args.event_id or state.get("event", {}).get("id")
    participants = state.get("participants", [])

    if not event_id:
        raise RuntimeError("event id is required (use --event-id or system_run.json)")

    admin_token = _login(api_base, args.superadmin_email, args.superadmin_password)

    status, body = _request_json(
        f"{api_base}/events/api/events/{event_id}", token=admin_token
    )
    event_data = _json_or_text(body)
    if status != 200:
        raise RuntimeError(f"event detail failed: {event_data}")

    event_status = event_data.get("event", {}).get("status")
    print(f"Event status: {event_status}")

    failures = 0
    if not participants:
        print("No participants in state file, skipping participant checks")
    else:
        for participant in participants:
            participant_id = participant.get("id")
            if not participant_id:
                continue
            status_url = (
                f"{api_base}/analysis/status/{event_id}/participants/{participant_id}/"
            )
            report_url = (
                f"{api_base}/analysis/report/{event_id}/participants/{participant_id}/"
            )

            status_code, status_body = _request_json(
                status_url, token=admin_token
            )
            status_data = _json_or_text(status_body)
            if status_code != 200:
                print(f"analysis status failed for participant {participant_id}: {status_data}")
                failures += 1
                continue
            print(
                f"participant {participant_id} analysis status: "
                f"{status_data.get('analysis', {}).get('status')}"
            )

            report_code, report_body = _request_json(
                report_url, token=admin_token
            )
            report_data = _json_or_text(report_body)
            if report_code != 200:
                print(f"analysis report failed for participant {participant_id}: {report_data}")
                failures += 1
            else:
                stats = report_data.get("statistics", {})
                print(
                    f"participant {participant_id} report: videos={stats.get('total_videos')}, "
                    f"screenshots={stats.get('total_screenshots')}"
                )

            logs_code, logs_body = _request_json(
                f"{api_base}/events/api/events/{event_id}/participants/{participant_id}/logs/",
                token=admin_token,
            )
            logs_data = _json_or_text(logs_body)
            if logs_code == 200:
                print(
                    f"participant {participant_id} logs total: {logs_data.get('total')}"
                )

    if failures:
        print(f"Verification failed with {failures} issue(s)")
        sys.exit(1)

    print("Verification complete")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Error: {exc}")
        sys.exit(1)
