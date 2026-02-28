import argparse
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass


@dataclass
class CheckResult:
    name: str
    status: int
    ok: bool
    detail: str = ""


def request_json(method: str, url: str, body: dict | None = None, token: str | None = None, timeout: int = 20):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    data = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")

    req = urllib.request.Request(url=url, data=data, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8")
            payload = json.loads(raw) if raw else None
            return resp.status, payload
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        try:
            payload = json.loads(raw) if raw else None
        except json.JSONDecodeError:
            payload = {"raw": raw}
        return exc.code, payload


def main() -> int:
    parser = argparse.ArgumentParser(description="SMS API smoke test for C2 platform")
    parser.add_argument("--base-url", default="http://localhost:8000", help="Backend base URL")
    parser.add_argument("--username", default="admin", help="Login username")
    parser.add_argument("--password", default="password", help="Login password")
    parser.add_argument("--timeout", type=int, default=20, help="HTTP timeout in seconds")
    args = parser.parse_args()

    base = args.base_url.rstrip("/")
    timeout = args.timeout

    checks: list[CheckResult] = []

    status, login_payload = request_json(
        "POST",
        f"{base}/auth/login",
        body={"username": args.username, "password": args.password},
        timeout=timeout,
    )
    token = (login_payload or {}).get("token") if isinstance(login_payload, dict) else None
    checks.append(CheckResult("auth/login", status, status == 200 and bool(token), detail=str((login_payload or {}).get("detail", ""))))

    if not token:
        for result in checks:
            print(f"[{ 'PASS' if result.ok else 'FAIL' }] {result.name}: HTTP {result.status} {result.detail}".strip())
        return 1

    status, payload = request_json("GET", f"{base}/sms/adapter/health", token=token, timeout=timeout)
    checks.append(CheckResult("sms/adapter/health", status, status == 200 and isinstance(payload, dict), detail=""))

    status, payload = request_json("GET", f"{base}/sms/nodes", token=token, timeout=timeout)
    checks.append(CheckResult("sms/nodes", status, status == 200 and isinstance(payload, list), detail=""))

    sample_ingest = {
        "source_node": "smoke-node-1",
        "metrics": {"cpu": 31.2, "temperature_c": 52.5},
        "detections": [
            {
                "timestamp": "2026-02-28T10:00:00Z",
                "frequency_hz": 2450000000,
                "bandwidth_hz": 200000,
                "power_dbm": -41.2,
                "snr_db": 18.7,
                "modulation": "OFDM",
                "confidence": 0.93,
                "lat": 12.9716,
                "lon": 77.5946,
                "doa_deg": 37.0,
            }
        ],
    }

    status, payload = request_json("POST", f"{base}/sms/adapter/ingest", body=sample_ingest, token=token, timeout=timeout)
    accepted_ok = isinstance(payload, dict) and payload.get("accepted", 0) >= 1
    checks.append(CheckResult("sms/adapter/ingest", status, status == 200 and accepted_ok, detail=""))

    qs = urllib.parse.urlencode({"source_node": "smoke-node-1", "limit": 5})
    status, payload = request_json("GET", f"{base}/sms/detections?{qs}", token=token, timeout=timeout)
    has_rows = isinstance(payload, list) and len(payload) >= 1
    checks.append(CheckResult("sms/detections", status, status == 200 and has_rows, detail=""))

    all_ok = True
    for result in checks:
        if not result.ok:
            all_ok = False
        print(f"[{ 'PASS' if result.ok else 'FAIL' }] {result.name}: HTTP {result.status} {result.detail}".strip())

    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main())
