# CRFS pbd2 Integration (C2)

## 1) Compile protobuf classes

From repository root:

```bash
python backend/tools/compile_pbd2.py
```

This generates:

- `backend/app/integrations/crfs/generated/pbd2_pb2.py`

## 2) Environment settings

Add to `docker/.env` or backend runtime env:

- `CRFS_ENABLED=true`
- `CRFS_HOST=0.0.0.0`
- `CRFS_PORT=9400`
- `CRFS_IDLE_TIMEOUT_SECONDS=30`
- `CRFS_MAX_MESSAGE_BYTES=1048576`
- `CRFS_LENGTH_ENDIAN=big`
- `CRFS_SIGNAL_POWER_ALERT_THRESHOLD=-45`
- `CRFS_AOA_DELTA_ALERT_THRESHOLD_DEG=20`
- `REDIS_URL=redis://redis:6379/0` (optional)
- `CRFS_REDIS_STREAM=crfs.events`

## 3) Message framing

The ingest listener expects:

1. 4-byte unsigned frame length
2. serialized `CRFS.Data.pbd2.DataGeneric` payload

Byte order for the length prefix is configured with `CRFS_LENGTH_ENDIAN`.

## 4) APIs

- `GET /crfs/health`
- `POST /crfs/ingest/start`
- `POST /crfs/ingest/stop`
- `GET /crfs/streams`
- `GET /crfs/signals`
- `GET /crfs/locations`
- `GET /crfs/events`
- `GET /crfs/alerts`
- `GET /crfs/dashboard/operator`
- `GET /crfs/nodes`
- `POST /crfs/nodes`
- `PATCH /crfs/nodes/{node_name}`
- `WS /crfs/ws/live`

## 5) RBAC

Permission resource: `crfs`

- ADMIN: `read`, `write`, `replay`
- OPERATOR: `read`

## 6) Smoke test sender

After backend startup, send sample pbd2 frames:

```bash
python scripts/crfs_stream_smoke_test.py --host 127.0.0.1 --port 9400 --count 20 --interval 0.2
```

Then verify:

- `GET /crfs/signals`
- `GET /crfs/locations`
- `GET /crfs/events`
- Operator dashboard feed at `GET /crfs/dashboard/operator`

## 7) Production notes

- Use Redis stream for decoupled event fanout by setting `REDIS_URL`.
- Place CRFS TCP listener behind a dedicated ingestion network segment.
- Keep `CRFS_MAX_MESSAGE_BYTES` conservative to reduce abuse risk.
- Run database retention jobs for `crfs_signals`, `crfs_locations`, and `crfs_events`.
