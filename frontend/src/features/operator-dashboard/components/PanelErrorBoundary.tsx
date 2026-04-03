import { Component, type ReactNode } from "react";
import { useTheme } from "../../../context/ThemeContext";

interface PanelErrorBoundaryProps {
  title: string;
  children: ReactNode;
}

interface PanelErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class PanelErrorBoundary extends Component<
  PanelErrorBoundaryProps,
  PanelErrorBoundaryState
> {
  constructor(props: PanelErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: unknown): PanelErrorBoundaryState {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return { hasError: true, message };
  }

  override render() {
    if (this.state.hasError) {
      return <PanelErrorFallback title={this.props.title} message={this.state.message} />;
    }
    return this.props.children;
  }
}

function PanelErrorFallback({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  const { theme } = useTheme();
  return (
    <div
      role="alert"
      style={{
        padding: theme.spacing.lg,
        border: `1px solid ${theme.colors.danger}`,
        borderRadius: "10px",
        background: theme.colors.surface,
        display: "flex",
        flexDirection: "column",
        gap: theme.spacing.sm,
      }}
    >
      <span
        style={{ color: theme.colors.danger, fontWeight: 600, fontSize: "14px" }}
      >
        ⚠ {title} failed to load
      </span>
      {message.length > 0 && (
        <span style={{ color: theme.colors.textSecondary, fontSize: "12px" }}>
          {message}
        </span>
      )}
    </div>
  );
}
