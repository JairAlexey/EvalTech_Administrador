import argparse
import hashlib
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


def _fetch_event(api_base, token, event_id):
    status, body = _request_json(f"{api_base}/events/api/events/{event_id}", token=token)
    data = _json_or_text(body)
    if status != 200:
        raise RuntimeError(f"event detail failed: {data}")
    return data.get("event", {})


def _compute_event_key(event_id, email):
    payload = f"{event_id}{email}".encode("utf-8")
    return hashlib.blake2b(payload, digest_size=8).hexdigest()


def main():
    parser = argparse.ArgumentParser(description="Compute event keys from API data")
    parser.add_argument("--api-base", default=DEFAULT_API_BASE)
    parser.add_argument("--superadmin-email", required=True)
    parser.add_argument("--superadmin-password", required=True)
    parser.add_argument("--event-id")
    args = parser.parse_args()

    event_id = args.event_id
    state = {}
    if not event_id and STATE_PATH.exists():
        state = json.loads(STATE_PATH.read_text(encoding="utf-8"))
        event_id = state.get("event", {}).get("id")

    if not event_id:
        raise RuntimeError("event id is required")

    token = _login(args.api_base, args.superadmin_email, args.superadmin_password)
    event = _fetch_event(args.api_base, token, event_id)
    participants = event.get("participants", [])

    rows = []
    for participant in participants:
        email = participant.get("email")
        participant_id = participant.get("id")
        if not email:
            continue
        rows.append(
            {
                "event_key": _compute_event_key(event_id, email),
                "email": email,
                "participant_id": participant_id,
            }
        )

    if not rows:
        print("No event keys found")
        return

    for row in rows:
        print(f"{row['email']} | participant_id={row['participant_id']} | {row['event_key']}")

    if STATE_PATH.exists():
        state = json.loads(STATE_PATH.read_text(encoding="utf-8"))
        state["event_keys"] = rows
        STATE_PATH.write_text(json.dumps(state, indent=2), encoding="utf-8")
        print(f"Updated {STATE_PATH}")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Error: {exc}")
        sys.exit(1)
