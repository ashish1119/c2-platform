from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass

from jose import jwt
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
            return response.status, payload
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        try:
            payload = json.loads(raw) if raw else None
        except json.JSONDecodeError:
            payload = {"raw": raw}
        return exc.code, payload


async def connect_telecom_ws(base_url: str, token: str) -> tuple[bool, str]:
    ws_base = base_url.replace("http://", "ws://").replace("https://", "wss://")
    ws_url = f"{ws_base}/telecom/ws/live?token={urllib.parse.quote(token)}"
    try:
        async with websockets.connect(ws_url) as websocket:
            await websocket.send("ping")
            await asyncio.sleep(0.2)
        return True, "connected"
    except InvalidStatus as exc:
        status = getattr(exc, "status_code", None)
        if status is None:
            response = getattr(exc, "response", None)
            status = getattr(response, "status_code", None)
        if status is None:
            status = -1
        return False, f"status={status}"
    except Exception as exc:  # noqa: BLE001
        return False, str(exc)


def mint_test_token(secret_key: str, algorithm: str, role: str, permissions: list[str]) -> str:
    now = int(time.time())
    payload = {
        "sub": "00000000-0000-0000-0000-000000000001",
        "role": role,
        "permissions": permissions,
        "iat": now,
        "exp": now + 300,
        "jti": f"rbac-test-{now}-{role.lower()}",
    }
    return jwt.encode(payload, secret_key, algorithm=algorithm)


def main() -> int:
    parser = argparse.ArgumentParser(description="Platform regression test for critical/high bug fixes")
    parser.add_argument("--base-url", default="http://localhost:8000", help="Backend base URL")
    parser.add_argument("--username", default="admin", help="Login username")
    parser.add_argument("--password", default="password", help="Login password")
    parser.add_argument("--timeout", type=int, default=20, help="HTTP timeout in seconds")
    args = parser.parse_args()

    base = args.base_url.rstrip("/")
    checks: list[CheckResult] = []

    health_status, _ = request_json("GET", f"{base}/health", timeout=args.timeout)
    healthz_status, _ = request_json("GET", f"{base}/healthz", timeout=args.timeout)
    checks.append(CheckResult("health endpoints", health_status == 200 and healthz_status == 200, f"health={health_status}, healthz={healthz_status}"))

    login_status, login_payload = request_json(
        "POST",
        f"{base}/auth/login",
        body={"username": args.username, "password": args.password},
        timeout=args.timeout,
    )
    token = (login_payload or {}).get("token") if isinstance(login_payload, dict) else None
    checks.append(CheckResult("login success", login_status == 200 and bool(token), f"status={login_status}"))

    if not token:
        for result in checks:
            print(f"[{'PASS' if result.ok else 'FAIL'}] {result.name}: {result.detail}")
        return 1

    auth_headers = {"Authorization": f"Bearer {token}"}

    tcp_status, tcp_payload = request_json("GET", f"{base}/tcp-listener/client/status", headers=auth_headers, timeout=args.timeout)
    tcp_ok = tcp_status == 200 and isinstance(tcp_payload, dict) and "connected" in tcp_payload
    checks.append(CheckResult("tcp listener client status", tcp_ok, f"status={tcp_status}"))

    ws_ok, ws_detail = asyncio.run(connect_telecom_ws(base, token))
    checks.append(CheckResult("telecom websocket admin allowed", ws_ok, ws_detail))

    secret_key = os.getenv("SECRET_KEY", "")
    algorithm = os.getenv("ALGORITHM", "HS256")
    if not secret_key:
        checks.append(CheckResult("telecom websocket rbac deterministic checks", False, "SECRET_KEY missing in runtime env"))
    else:
        denied_token = mint_test_token(secret_key, algorithm, role="OPERATOR", permissions=[])
        denied_ok, denied_detail = asyncio.run(connect_telecom_ws(base, denied_token))
        checks.append(
            CheckResult(
                "telecom websocket rbac deny",
                (not denied_ok) and ("status=403" in denied_detail or "status=401" in denied_detail),
                denied_detail,
            )
        )

        allowed_token = mint_test_token(secret_key, algorithm, role="OPERATOR", permissions=["telecom:read"])
        allowed_ok, allowed_detail = asyncio.run(connect_telecom_ws(base, allowed_token))
        checks.append(CheckResult("telecom websocket rbac allow", allowed_ok, allowed_detail))

    logout_status, _ = request_json("POST", f"{base}/auth/logout", headers=auth_headers, timeout=args.timeout)
    me_status, _ = request_json("GET", f"{base}/auth/me", headers=auth_headers, timeout=args.timeout)
    checks.append(CheckResult("logout revokes bearer", logout_status == 200 and me_status == 401, f"logout={logout_status}, me={me_status}"))

    # Validate per-user lockout does not collateral-block another user on same source IP.
    probe_statuses: list[int] = []
    for _ in range(12):
        status, _ = request_json(
            "POST",
            f"{base}/auth/login",
            body={"username": "__rate_limit_probe_user__", "password": "definitely-wrong"},
            timeout=args.timeout,
        )
        probe_statuses.append(status)

    admin_status_after_probe, _ = request_json(
        "POST",
        f"{base}/auth/login",
        body={"username": args.username, "password": args.password},
        timeout=args.timeout,
    )

    no_collateral_ok = (429 in probe_statuses) and (admin_status_after_probe == 200)
    checks.append(
        CheckResult(
            "per-user login lockout isolation",
            no_collateral_ok,
            f"probe={probe_statuses[-3:]}, admin={admin_status_after_probe}",
        )
    )

    all_ok = True
    for result in checks:
        if not result.ok:
            all_ok = False
        print(f"[{'PASS' if result.ok else 'FAIL'}] {result.name}: {result.detail}")

    return 0 if all_ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
