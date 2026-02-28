import { useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { useTheme } from "../../context/ThemeContext";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        background: theme.colors.background,
      }}
    >
      {!isSidebarVisible && (
        <div
          onMouseEnter={() => setIsSidebarVisible(true)}
          style={{
            width: "10px",
            cursor: "pointer",
            background: theme.colors.surface,
            borderRight: `1px solid ${theme.colors.border}`,
          }}
          title="Show menu"
        />
      )}

      {isSidebarVisible && (
        <div onMouseLeave={() => setIsSidebarVisible(false)}>
          <Sidebar onNavigate={() => setIsSidebarVisible(false)} />
        </div>
      )}

      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <Topbar
          isSidebarVisible={isSidebarVisible}
          onToggleSidebar={() => setIsSidebarVisible((prev) => !prev)}
        />
        <div
          style={{
            padding: theme.spacing.xl,
            overflowY: "auto",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}