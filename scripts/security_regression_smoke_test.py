from __future__ import annotations

import argparse
import asyncio
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from http.cookies import SimpleCookie

import websockets
from websockets.exceptions import InvalidStatus


@dataclass
class CheckResult:
    name: str
    ok: bool
    detail: str = ""


def request_json(
    method: str,
    url: str,
    body: dict | None = None,
    headers: dict[str, str] | None = None,
    timeout: int = 20,
):
    req_headers = {"Content-Type": "application/json"}
    if headers:
        req_headers.update(headers)

    data = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")

    request = urllib.request.Request(url=url, data=data, headers=req_headers, method=method)

    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            raw = response.read().decode("utf-8")
            payload = json.loads(raw) if raw else None
            return response.status, payload, response.headers
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        try:
            payload = json.loads(raw) if raw else None
        except json.JSONDecodeError:
            payload = {"raw": raw}
        return exc.code, payload, exc.headers


def _extract_access_cookie(set_cookie_headers: list[str]) -> str | None:
    for set_cookie in set_cookie_headers:
        cookie = SimpleCookie()
        cookie.load(set_cookie)
        if "access_token" in cookie:
            return cookie["access_token"].value
    return None


async def websocket_unauth_should_fail(ws_url: str) -> tuple[bool, str]:
    try:
        async with websockets.connect(ws_url):
            return False, "Unexpected websocket connect without auth"
    except InvalidStatus as exc:
        status = getattr(exc, "status_code", None)
        if status is None:
            response = getattr(exc, "response", None)
            status = getattr(response, "status_code", None)
        if status is None:
            status = -1
        return status in {401, 403}, f"status={status}"
    except Exception as exc:  # noqa: BLE001
        return False, f"unauth ws error: {exc}"


async def websocket_auth_should_connect(ws_url: str, token: str) -> tuple[bool, str]:
    auth_url = f"{ws_url}?token={urllib.parse.quote(token)}"
    try:
        async with websockets.connect(auth_url) as websocket:
            await websocket.send("ping")
            await asyncio.sleep(0.2)
            return True, "connected"
    except Exception as exc:  # noqa: BLE001
        return False, f"auth ws error: {exc}"


def main() -> int:
    parser = argparse.ArgumentParser(description="Security regression smoke test for auth/websocket/rate-limits")
    parser.add_argument("--base-url", default="http://localhost:8000", help="Backend base URL")
    parser.add_argument("--username", default="admin", help="Login username")
    parser.add_argument("--password", default="password", help="Login password")
    parser.add_argument("--timeout", type=int, default=20, help="HTTP timeout in seconds")
    args = parser.parse_args()

    base = args.base_url.rstrip("/")
    ws_base = base.replace("http://", "ws://").replace("https://", "wss://")

    checks: list[CheckResult] = []

    login_status, login_payload, login_headers = request_json(
        "POST",
        f"{base}/auth/login",
        body={"username": args.username, "password": args.password},
        timeout=args.timeout,
    )
    token = (login_payload or {}).get("token") if isinstance(login_payload, dict) else None
    access_cookie = _extract_access_cookie(login_headers.get_all("Set-Cookie", []))

    checks.append(
        CheckResult(
            "auth/login success",
            login_status == 200 and bool(token) and bool(access_cookie),
            f"status={login_status}",
        )
    )

    if not token or not access_cookie:
        for result in checks:
            print(f"[{'PASS' if result.ok else 'FAIL'}] {result.name}: {result.detail}")
        return 1

    me_status, me_payload, _ = request_json(
        "GET",
        f"{base}/auth/me",
        headers={"Cookie": f"access_token={access_cookie}"},
        timeout=args.timeout,
    )
    me_ok = me_status == 200 and isinstance(me_payload, dict) and me_payload.get("token") is None
    checks.append(CheckResult("auth/me via cookie", me_ok, f"status={me_status}"))

    bad_login_status, _, _ = request_json(
        "POST",
        f"{base}/auth/login",
        body={"username": args.username, "password": "bad-password"},
        timeout=args.timeout,
    )
    checks.append(CheckResult("auth/login rejects bad credentials", bad_login_status == 401, f"status={bad_login_status}"))

    reset_status, reset_payload, _ = request_json(
        "POST",
        f"{base}/auth/password-reset/request",
        body={"identifier": args.username},
        timeout=args.timeout,
    )
    reset_ok = reset_status in {200, 429} and isinstance(reset_payload, dict)
    checks.append(
        CheckResult(
            "password reset request",
            reset_ok,
            f"status={reset_status}",
        )
    )

    weak_reset_status, weak_reset_payload, _ = request_json(
        "POST",
        f"{base}/auth/password-reset/confirm",
        body={"token": "fake-token", "new_password": "weakpass"},
        timeout=args.timeout,
    )
    weak_detail = str((weak_reset_payload or {}).get("detail", "")) if isinstance(weak_reset_payload, dict) else ""
    weak_ok = weak_reset_status in {400, 429} and (
        "Password must" in weak_detail or weak_reset_status == 429
    )
    checks.append(CheckResult("password policy enforcement", weak_ok, f"status={weak_reset_status} detail={weak_detail}"))

    # This endpoint is limited to 3 calls / 15 minutes. We already made one call above.
    rate_limit_statuses: list[int] = []
    for _ in range(4):
        status, _, _ = request_json(
            "POST",
            f"{base}/auth/password-reset/request",
            body={"identifier": args.username},
            timeout=args.timeout,
        )
        rate_limit_statuses.append(status)
        time.sleep(0.15)
    checks.append(
        CheckResult(
            "password reset rate limit",
            429 in rate_limit_statuses,
            f"statuses={rate_limit_statuses}",
        )
    )

    unauth_ok, unauth_detail = asyncio.run(websocket_unauth_should_fail(f"{ws_base}/ws/alerts"))
    checks.append(CheckResult("ws/alerts unauth rejected", unauth_ok, unauth_detail))

    auth_ok, auth_detail = asyncio.run(websocket_auth_should_connect(f"{ws_base}/ws/alerts", token))
    checks.append(CheckResult("ws/alerts auth accepted", auth_ok, auth_detail))

    all_ok = True
    for result in checks:
        if not result.ok:
            all_ok = False
        print(f"[{'PASS' if result.ok else 'FAIL'}] {result.name}: {result.detail}")

    return 0 if all_ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
