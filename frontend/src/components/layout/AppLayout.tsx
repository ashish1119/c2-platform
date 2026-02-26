import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { useTheme } from "../../context/ThemeContext";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        background: theme.colors.background,
      }}
    >
      <Sidebar />
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <Topbar />
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