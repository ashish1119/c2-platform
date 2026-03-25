import { useTheme } from "../../../context/ThemeContext";

type SimulationControlsProps = {
  running: boolean;
  centerFrequencyMhz: number;
  noiseFloorDbm: number;
  onCenterFrequencyMhzChange: (value: number) => void;
  onNoiseFloorDbmChange: (value: number) => void;
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
};

export default function SimulationControls({
  running,
  centerFrequencyMhz,
  noiseFloorDbm,
  onCenterFrequencyMhzChange,
  onNoiseFloorDbmChange,
  onStart,
  onStop,
  onReset,
}: SimulationControlsProps) {
  const { theme } = useTheme();

  return (
    <div style={{ display: "grid", gap: theme.spacing.md }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: theme.spacing.sm, alignItems: "center" }}>
        <button
          type="button"
          onClick={onStart}
          disabled={running}
          style={{
            border: "none",
            borderRadius: theme.radius.md,
            background: theme.colors.success,
            color: "#ffffff",
            padding: `${theme.spacing.sm} ${theme.spacing.md}`,
            cursor: running ? "not-allowed" : "pointer",
            opacity: running ? 0.75 : 1,
          }}
        >
          Start
        </button>

        <button
          type="button"
          onClick={onStop}
          disabled={!running}
          style={{
            border: "none",
            borderRadius: theme.radius.md,
            background: theme.colors.warning,
            color: "#ffffff",
            padding: `${theme.spacing.sm} ${theme.spacing.md}`,
            cursor: running ? "pointer" : "not-allowed",
            opacity: running ? 1 : 0.75,
          }}
        >
          Stop
        </button>

        <button
          type="button"
          onClick={onReset}
          style={{
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radius.md,
            background: theme.colors.surfaceAlt,
            color: theme.colors.textPrimary,
            padding: `${theme.spacing.sm} ${theme.spacing.md}`,
            cursor: "pointer",
          }}
        >
          Reset
        </button>

        <span
          style={{
            padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
            borderRadius: theme.radius.md,
            border: `1px solid ${running ? theme.colors.success : theme.colors.border}`,
            color: running ? theme.colors.success : theme.colors.textSecondary,
            background: theme.colors.surfaceAlt,
          }}
        >
          {running ? "Running" : "Stopped"}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gap: theme.spacing.md,
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        }}
      >
        <label style={{ display: "grid", gap: theme.spacing.xs }}>
          <span style={{ color: theme.colors.textSecondary }}>Center Frequency (MHz)</span>
          <input
            type="number"
            value={centerFrequencyMhz}
            min={30}
            max={6000}
            step={0.1}
            onChange={(event) => onCenterFrequencyMhzChange(Number(event.target.value))}
            style={{
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.radius.md,
              background: theme.colors.surfaceAlt,
              color: theme.colors.textPrimary,
              padding: theme.spacing.sm,
            }}
          />
        </label>

        <label style={{ display: "grid", gap: theme.spacing.xs }}>
          <span style={{ color: theme.colors.textSecondary }}>Noise Floor (dBm)</span>
          <input
            type="number"
            value={noiseFloorDbm}
            min={-130}
            max={-60}
            step={1}
            onChange={(event) => onNoiseFloorDbmChange(Number(event.target.value))}
            style={{
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.radius.md,
              background: theme.colors.surfaceAlt,
              color: theme.colors.textPrimary,
              padding: theme.spacing.sm,
            }}
          />
        </label>
      </div>
    </div>
  );
}
