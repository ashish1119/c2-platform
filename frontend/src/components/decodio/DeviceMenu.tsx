import React, { useState } from "react";
import DeviceSelectorPage from "../../pages/operator/DeviceSelectorPage";

const menuStyle: React.CSSProperties = {
  position: "absolute",
  top: 38,
  left: 60,
  background: "#fff",
  border: "1px solid #ccc",
  borderRadius: 4,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  minWidth: 220,
  zIndex: 1000,
  padding: 0,
};

const itemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 16px",
  fontSize: 15,
  color: "#222",
  cursor: "pointer",
  background: "#fff",
  border: 0,
  width: "100%",
  textAlign: "left",
  transition: "background 0.15s",
};

const iconStyle: React.CSSProperties = {
  width: 20,
  height: 20,
  display: "inline-block",
};

const menuItems = [
  { label: "New Device", icon: "\uD83D\uDD0C" },
  { label: "Start Selected", icon: "\u25B6\uFE0F", shortcut: "Ctrl+R", onClick: () => alert("Start Selected clicked") },
  { label: "Stop Selected", icon: "\u23F9\uFE0F", shortcut: "Ctrl+T", onClick: () => alert("Stop Selected clicked") },
  { label: "Start All", icon: "\u25B6\uFE0F", shortcut: "Ctrl+Shift+R", onClick: () => alert("Start All clicked") },
  { label: "Stop All", icon: "\u23F9\uFE0F", shortcut: "Ctrl+Shift+T", onClick: () => alert("Stop All clicked") },
];

export default function DeviceMenu({ onClose, onNewDevice }: { onClose: () => void, onNewDevice?: () => void }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  return (
    <div style={menuStyle} onMouseLeave={onClose}>
      {menuItems.map((item, idx) => (
        <button
          key={item.label}
          style={{
            ...itemStyle,
            background: hoveredIdx === idx ? "#c6def6" : "#fff",
            borderRadius: hoveredIdx === idx ? 4 : 0,
          }}
          onClick={() => {
            if (item.label === "New Device" && onNewDevice) {
              onNewDevice();
            } else if (item.onClick) {
              item.onClick();
              onClose();
            }
          }}
          onMouseEnter={() => setHoveredIdx(idx)}
          onMouseLeave={() => setHoveredIdx(null)}
        >
          <span style={iconStyle}>{item.icon}</span> {item.label}
          {item.shortcut && (
            <span style={{ marginLeft: "auto", color: "#888", fontSize: 13 }}>{item.shortcut}</span>
          )}
        </button>
      ))}
    </div>
  );
}
