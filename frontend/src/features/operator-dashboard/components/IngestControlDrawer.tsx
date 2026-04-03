import { useEffect, useRef } from "react";
import { useTheme } from "../../../context/ThemeContext";
import RFUploader from "../../../components/operator-dashboard/RFUploader";
import StreamInput from "../../../components/operator-dashboard/StreamInput";
import StatusPanel from "../../../components/operator-dashboard/StatusPanel";
import type { DashboardStatus } from "../../../components/operator-dashboard/StatusPanel";

interface IngestControlDrawerProps {
  open: boolean;
  onClose: () => void;

  // Uploader
  fileSourceNode: string;
  uploadingFile: boolean;
  canWriteSms: boolean;
  simulationMode: boolean;
  status: DashboardStatus;
  onFileSourceNodeChange: (v: string) => void;
  onUpload: (file: File, sourceNode: string) => Promise<void>;

  // Stream
  streamUrl: string;
  streamSourceNode: string;
  streamActive: boolean;
  streamBusy: boolean;
  onStreamUrlChange: (v: string) => void;
  onStreamSourceNodeChange: (v: string) => void;
  onConnectStream: () => Promise<void>;
  onDisconnectStream: () => void | Promise<void>;
}

export default function IngestControlDrawer({
  open,
  onClose,
  fileSourceNode,
  uploadingFile,
  canWriteSms,
  simulationMode,
  status,
  onFileSourceNodeChange,
  onUpload,
  streamUrl,
  streamSourceNode,
  streamActive,
  streamBusy,
  onStreamUrlChange,
  onStreamSourceNodeChange,
  onConnectStream,
  onDisconnectStream,
}: IngestControlDrawerProps) {
  const { theme } = useTheme();
  const drawerRef = useRef<HTMLDivElement | null>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Focus drawer on open
  useEffect(() => {
    if (open) {
      drawerRef.current?.focus();
    }
  }, [open]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.45)",
          zIndex: 200,
        }}
      />

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Ingest Controls"
        tabIndex={-1}
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "420px",
          maxWidth: "100vw",
          background: theme.colors.surface,
          borderLeft: `1px solid ${theme.colors.border}`,
          zIndex: 201,
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: `${theme.spacing.md} ${theme.spacing.lg}`,
            borderBottom: `1px solid ${theme.colors.border}`,
            position: "sticky",
            top: 0,
            background: theme.colors.surface,
            zIndex: 1,
          }}
        >
          <span
            style={{ fontWeight: 600, fontSize: "15px", color: theme.colors.textPrimary }}
          >
            Ingest Controls
          </span>
          <button
            type="button"
            aria-label="Close ingest controls"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: theme.colors.textSecondary,
              fontSize: "20px",
              lineHeight: 1,
              padding: "4px",
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            padding: theme.spacing.lg,
            display: "grid",
            gap: theme.spacing.lg,
          }}
        >
          <RFUploader
            sourceNode={fileSourceNode}
            uploading={uploadingFile}
            disabled={!canWriteSms || simulationMode}
            lastUploadedFile={status.fileName ?? null}
            onSourceNodeChange={onFileSourceNodeChange}
            onUpload={onUpload}
          />

          <StreamInput
            streamUrl={streamUrl}
            sourceNode={streamSourceNode}
            active={streamActive}
            busy={streamBusy}
            disabled={!canWriteSms || simulationMode}
            onStreamUrlChange={onStreamUrlChange}
            onSourceNodeChange={onStreamSourceNodeChange}
            onConnect={onConnectStream}
            onDisconnect={onDisconnectStream}
          />

          <StatusPanel status={{ ...status, streamActive }} />
        </div>
      </div>
    </>
  );
}
