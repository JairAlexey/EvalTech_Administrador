#!/usr/bin/env python3
import argparse
import json
import os
import time
import urllib.error
import urllib.request
from typing import Any, Dict, Optional, Set


DEFAULT_BASE_URL = os.getenv("BASE_URL", "https://backend-production-b180.up.railway.app")
DEFAULT_LOGIN_PATH = "/auth/login/"
DEFAULT_USER_INFO_PATH = "/auth/user-info/"
DEFAULT_VERIFY_PATH = "/auth/verify-token/"
DEFAULT_ROLES_PATH = "/auth/roles/"


def build_url(base_url: str, path: str) -> str:
    return f"{base_url.rstrip('/')}/{path.lstrip('/')}"


def request_json(
    method: str,
    url: str,
    headers: Dict[str, str],
    body: Optional[Dict[str, Any]],
    timeout: float,
):
    data = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers = {**headers, "Content-Type": "application/json"}

    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    status = None
    error = None
    payload = None
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            status = resp.status
            raw = resp.read().decode("utf-8") if resp else ""
    except urllib.error.HTTPError as exc:
        status = exc.code
        error = str(exc)
        try:
            raw = exc.read().decode("utf-8")
        except Exception:
            raw = ""
    except Exception as exc:
        error = str(exc)
        raw = ""

    if raw:
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            payload = {"raw": raw}
    return status, error, payload


def expect_status(label: str, status: Optional[int], expected: Set[int]) -> bool:
    ok = status in expected
    expected_text = ", ".join(str(item) for item in sorted(expected))
    status_text = status if status is not None else "ERR"
    print(f"[NF] {label}: status={status_text} expected={expected_text} ok={ok}")
    return ok


def main() -> int:
    parser = argparse.ArgumentParser(
        description="JWT access control validation (basic auth/security)."
    )
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL)
    parser.add_argument("--login-path", default=DEFAULT_LOGIN_PATH)
    parser.add_argument("--user-info-path", default=DEFAULT_USER_INFO_PATH)
    parser.add_argument("--verify-path", default=DEFAULT_VERIFY_PATH)
    parser.add_argument("--roles-path", default=DEFAULT_ROLES_PATH)
    parser.add_argument("--email", default=os.getenv("AUTH_EMAIL", ""))
    parser.add_argument("--password", default=os.getenv("AUTH_PASSWORD", ""))
    parser.add_argument("--token", default=os.getenv("AUTH_TOKEN", ""))
    parser.add_argument("--timeout", type=float, default=30.0)
    parser.add_argument("--skip-role-check", action="store_true")
    args = parser.parse_args()

    login_url = build_url(args.base_url, args.login_path)
    user_info_url = build_url(args.base_url, args.user_info_path)
    verify_url = build_url(args.base_url, args.verify_path)
    roles_url = build_url(args.base_url, args.roles_path)

    print("[NF] JWT access control validation")
    print(f"[NF] base_url={args.base_url}")

    ok = True

    status, error, payload = request_json(
        "GET", user_info_url, headers={}, body=None, timeout=args.timeout
    )
    ok = expect_status("missing-auth", status, {401}) and ok
    if error:
        print(f"[NF] missing-auth error={error}")
    if payload:
        print(f"[NF] missing-auth payload={payload}")

    status, error, payload = request_json(
        "GET",
        user_info_url,
        headers={"Authorization": "Bearer invalid.token.value"},
        body=None,
        timeout=args.timeout,
    )
    ok = expect_status("invalid-token", status, {401}) and ok
    if error:
        print(f"[NF] invalid-token error={error}")
    if payload:
        print(f"[NF] invalid-token payload={payload}")

    token = args.token.strip()
    if not token:
        if not args.email or not args.password:
            print("[NF] Missing credentials. Provide --token or --email/--password.")
            return 2
        status, error, payload = request_json(
            "POST",
            login_url,
            headers={},
            body={"email": args.email, "password": args.password},
            timeout=args.timeout,
        )
        ok = expect_status("login", status, {200}) and ok
        if error:
            print(f"[NF] login error={error}")
        if payload:
            print(f"[NF] login payload={payload}")
        token = (payload or {}).get("token", "").strip()
        if not token:
            print("[NF] login did not return a token")
            return 2
    else:
        print("[NF] using provided token")

    status, error, payload = request_json(
        "GET",
        user_info_url,
        headers={"Authorization": f"Bearer {token}"},
        body=None,
        timeout=args.timeout,
    )
    ok = expect_status("user-info", status, {200}) and ok
    if error:
        print(f"[NF] user-info error={error}")
    if payload:
        print(f"[NF] user-info payload={payload}")

    role = ""
    if isinstance(payload, dict):
        role = payload.get("role", "")

    status, error, payload = request_json(
        "POST",
        verify_url,
        headers={},
        body={"token": token},
        timeout=args.timeout,
    )
    ok = expect_status("verify-token", status, {200}) and ok
    if error:
        print(f"[NF] verify-token error={error}")
    if payload:
        print(f"[NF] verify-token payload={payload}")
    if isinstance(payload, dict) and payload.get("valid") is not True:
        ok = False
        print("[NF] verify-token expected valid=true")

    if not args.skip_role_check:
        expected = {200} if role == "superadmin" else {403}
        status, error, payload = request_json(
            "GET",
            roles_url,
            headers={"Authorization": f"Bearer {token}"},
            body=None,
            timeout=args.timeout,
        )
        ok = expect_status("roles", status, expected) and ok
        if error:
            print(f"[NF] roles error={error}")
        if payload:
            print(f"[NF] roles payload={payload}")
        print(f"[NF] role-check role={role or 'unknown'} expected={expected}")

    print(f"[NF] summary ok={ok}")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
