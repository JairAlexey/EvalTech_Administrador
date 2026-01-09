import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta
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


def _list_evaluators(api_base, token):
    status, body = _request_json(f"{api_base}/auth/users", token=token)
    data = _json_or_text(body)
    if status != 200:
        raise RuntimeError(f"get evaluators failed: {data}")
    return data.get("users", [])


def _create_evaluator(api_base, super_token, email, password):
    payload = {
        "email": email,
        "password": password,
        "firstName": "Eval",
        "lastName": "System",
        "role": "evaluator",
    }
    status, body = _request_json(
        f"{api_base}/auth/create-user/", method="POST", token=super_token, payload=payload
    )
    data = _json_or_text(body)
    if status not in (200, 201):
        raise RuntimeError(f"create evaluator failed: {data}")
    return data.get("user")


def _find_participant_by_email(api_base, token, email):
    search = urllib.parse.quote(email)
    status, body = _request_json(
        f"{api_base}/events/api/participants?search={search}", token=token
    )
    data = _json_or_text(body)
    if status != 200:
        raise RuntimeError(f"search participant failed: {data}")
    for participant in data.get("participants", []):
        if participant.get("email") == email:
            return participant
    return None


def _create_participant(api_base, token, first_name, last_name, email):
    payload = {"first_name": first_name, "last_name": last_name, "email": email}
    status, body = _request_json(
        f"{api_base}/events/api/participants", method="POST", token=token, payload=payload
    )
    data = _json_or_text(body)
    if status != 200:
        raise RuntimeError(f"create participant failed: {data}")
    return {"id": data.get("id"), "name": data.get("name"), "email": email}


def _build_schedule():
    now = datetime.utcnow()
    start = (now + timedelta(minutes=5)).replace(second=0, microsecond=0)
    close = start + timedelta(minutes=7)
    if close.date() != start.date():
        start = (now + timedelta(days=1)).replace(hour=10, minute=0, second=0, microsecond=0)
        close = start + timedelta(minutes=7)
    return start, close


def _create_event(api_base, token, evaluator_id, participants, event_name):
    start, close = _build_schedule()
    payload = {
        "eventName": event_name,
        "description": "System test event",
        "startDate": start.strftime("%Y-%m-%d"),
        "startTime": start.strftime("%H:%M"),
        "closeTime": close.strftime("%H:%M"),
        "evaluator": evaluator_id,
        "duration": 15,
        "timezone": "UTC",
        "participants": [{"id": p["id"], "selected": True} for p in participants],
        "blockedWebsites": [],
    }
    status, body = _request_json(
        f"{api_base}/events/api/events", method="POST", token=token, payload=payload
    )
    data = _json_or_text(body)
    if status != 200:
        raise RuntimeError(f"create event failed: {data}")
    return data.get("id"), start, close


def main():
    parser = argparse.ArgumentParser(description="Prepare system test event data")
    parser.add_argument("--api-base", default=DEFAULT_API_BASE)
    parser.add_argument("--superadmin-email", required=True)
    parser.add_argument("--superadmin-password", required=True)
    parser.add_argument("--participants", type=int, default=1)
    args = parser.parse_args()

    super_token = _login(args.api_base, args.superadmin_email, args.superadmin_password)
    if not super_token:
        raise RuntimeError("superadmin login did not return token")

    evaluators = _list_evaluators(args.api_base, super_token)
    evaluator = evaluators[0] if evaluators else None

    if not evaluator:
        evaluator_email = f"evaluator.systemtest.{int(datetime.utcnow().timestamp())}@example.com"
        evaluator = _create_evaluator(args.api_base, super_token, evaluator_email, "Eval1234")
        evaluators = _list_evaluators(args.api_base, super_token)
        evaluator = evaluators[0] if evaluators else evaluator

    if not evaluator:
        raise RuntimeError("no evaluator available, create one manually or provide superadmin creds")

    participants = []
    for idx in range(args.participants):
        email = f"participant{idx + 1}.systemtest@example.com"
        existing = _find_participant_by_email(args.api_base, super_token, email)
        if existing:
            participants.append(existing)
            continue
        created = _create_participant(
            args.api_base, super_token, f"Participant{idx + 1}", "System", email
        )
        participants.append(created)

    event_name = f"System Test {datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
    event_id, start, close = _create_event(
        args.api_base, super_token, evaluator.get("id"), participants, event_name
    )

    state = {
        "api_base": args.api_base,
        "event": {
            "id": event_id,
            "name": event_name,
            "start_utc": start.isoformat(),
            "close_utc": close.isoformat(),
        },
        "evaluator": evaluator,
        "participants": participants,
        "created_at": datetime.utcnow().isoformat(),
    }
    STATE_PATH.write_text(json.dumps(state, indent=2), encoding="utf-8")

    print("System test event created")
    print(f"Event ID: {event_id}")
    print(f"Start (UTC): {start.isoformat()}")
    print(f"Close (UTC): {close.isoformat()}")
    print(f"State saved to: {STATE_PATH}")
    print("Next: get event keys for the app")
    print(f"  python system_tests/get_event_keys.py --event-id {event_id}")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Error: {exc}")
        sys.exit(1)
