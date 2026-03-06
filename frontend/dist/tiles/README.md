# Offline XYZ Tiles

Place your offline XYZ map tiles in this directory using this structure:

- `{z}/{x}/{y}.png`

Example:

- `public/tiles/12/2420/1536.png`

The frontend is configured to use:

- `/tiles/{z}/{x}/{y}.png`

If a requested tile does not exist, the map automatically falls back to blank offline mode while keeping all platform overlays (assets, alerts, signals) operational.
