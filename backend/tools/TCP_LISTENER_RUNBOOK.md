# TCP Listener Runbook

## 1) Configure backend environment

Set these environment variables before running backend:

- `TCP_LISTENER_ENABLED=true`
- `TCP_LISTENER_HOST=0.0.0.0`
- `TCP_LISTENER_PORT=9300`
- `TCP_LISTENER_IDLE_TIMEOUT_SECONDS=30`
- `TCP_LISTENER_MAX_LINE_BYTES=16384`

## 2) Start backend

```powershell
Set-Location d:\vivek\c2-platform\backend
$env:TCP_LISTENER_ENABLED = "true"
$env:TCP_LISTENER_HOST = "0.0.0.0"
$env:TCP_LISTENER_PORT = "9300"
C:/Users/ashish.jain/AppData/Local/Programs/Python/Python314/python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## 3) Send test TCP messages

In a new terminal:

```powershell
Set-Location d:\vivek\c2-platform\backend
C:/Users/ashish.jain/AppData/Local/Programs/Python/Python314/python.exe tools/tcp_sender_simulator.py
```

## 4) Verify operator alert behavior

- Open operator map/alert screen in frontend.
- New alerts should appear as `NEW` with severity based on threshold logic.
- WebSocket push occurs on `/ws/alerts`, so operator screen refreshes alert feed in real time.

## 5) Message format (NDJSON)

One JSON message per line:

```json
{"msg_id":"uuid","sender_id":"sensor-01","event_type":"temperature","value":92.7,"unit":"C","severity_hint":"HIGH","ts":"2026-02-28T09:22:11Z","latitude":28.567,"longitude":77.321}
```

## 6) Error handling behavior

- Invalid JSON/schema: rejected and logged, connection remains open.
- Oversized frame: client disconnected.
- Idle timeout: client disconnected after configured timeout.
- Reconnect: sender can reconnect immediately.
