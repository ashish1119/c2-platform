import { useRef, useState } from "react";
import Card from "../ui/Card";
import { useTheme } from "../../context/ThemeContext";

type RFUploaderProps = {
  sourceNode: string;
  uploading: boolean;
  disabled?: boolean;
  lastUploadedFile?: string | null;
  onSourceNodeChange: (value: string) => void;
  onUpload: (file: File, sourceNode: string) => Promise<void>;
};

export default function RFUploader({
  sourceNode,
  uploading,
  disabled = false,
  lastUploadedFile,
  onSourceNodeChange,
  onUpload,
}: RFUploaderProps) {
  const { theme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleUpload = async () => {
    if (!selectedFile || uploading || disabled) {
      return;
    }

    await onUpload(selectedFile, sourceNode.trim());
    setSelectedFile(null);
  };

  return (
    <Card>
      <div style={{ display: "grid", gap: theme.spacing.md }}>
        <div>
          <h3 style={{ margin: 0 }}>RF File Upload</h3>
          <div style={{ color: theme.colors.textSecondary, marginTop: theme.spacing.xs }}>
            Drag and drop RF files or select manually.
          </div>
        </div>

        <label style={{ display: "grid", gap: theme.spacing.xs }}>
          <span style={{ color: theme.colors.textSecondary }}>Source Node</span>
          <input
            value={sourceNode}
            disabled={disabled || uploading}
            onChange={(event) => onSourceNodeChange(event.target.value)}
            placeholder="operator_rf_node_01"
            style={{
              width: "100%",
              padding: theme.spacing.sm,
              borderRadius: theme.radius.sm,
              border: `1px solid ${theme.colors.border}`,
              background: theme.colors.surfaceAlt,
              color: theme.colors.textPrimary,
            }}
          />
        </label>

        <div
          onDragOver={(event) => {
            event.preventDefault();
            if (!disabled && !uploading) {
              setDragOver(true);
            }
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragOver(false);
            if (disabled || uploading) {
              return;
            }
            const file = event.dataTransfer.files?.[0] ?? null;
            setSelectedFile(file);
          }}
          style={{
            border: `2px dashed ${dragOver ? theme.colors.primary : theme.colors.border}`,
            borderRadius: theme.radius.md,
            padding: theme.spacing.lg,
            background: dragOver ? theme.colors.surfaceAlt : theme.colors.surface,
            textAlign: "center",
            color: theme.colors.textSecondary,
            transition: "all 0.15s ease",
          }}
        >
          <div style={{ marginBottom: theme.spacing.sm }}>
            {selectedFile ? `Selected: ${selectedFile.name}` : "Drop .csv, .json, or .ndjson file here"}
          </div>
          <button
            type="button"
            disabled={disabled || uploading}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.radius.sm,
              background: theme.colors.surfaceAlt,
              color: theme.colors.textPrimary,
              cursor: disabled || uploading ? "not-allowed" : "pointer",
              padding: `${theme.spacing.xs} ${theme.spacing.md}`,
            }}
          >
            Choose File
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.json,.ndjson,.jsonl"
            style={{ display: "none" }}
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              setSelectedFile(file);
              event.currentTarget.value = "";
            }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: theme.spacing.sm }}>
          <button
            type="button"
            onClick={() => {
              void handleUpload();
            }}
            disabled={!selectedFile || uploading || disabled}
            style={{
              border: "none",
              borderRadius: theme.radius.md,
              background: theme.colors.primary,
              color: "#ffffff",
              cursor: !selectedFile || uploading || disabled ? "not-allowed" : "pointer",
              opacity: !selectedFile || uploading || disabled ? 0.7 : 1,
              padding: `${theme.spacing.sm} ${theme.spacing.md}`,
            }}
          >
            {uploading ? "Uploading..." : "Upload RF File"}
          </button>

          {lastUploadedFile && (
            <span style={{ color: theme.colors.textSecondary, fontSize: theme.typography.body.fontSize }}>
              Last file: {lastUploadedFile}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
