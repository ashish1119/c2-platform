// import { useEffect, useState } from "react";
// import { useLocation } from "react-router-dom";
// import Sidebar from "./Sidebar";
// import Topbar from "./Topbar";
// import { useTheme } from "../../context/ThemeContext";

// const SIDEBAR_VISIBLE_KEY = "ui.sidebar.visible";

// export default function AppLayout({ children }: { children: React.ReactNode }) {
//   const { theme } = useTheme();
//   const location = useLocation();
//   const isOperatorMapRoute = location.pathname === "/operator/map";
//   const [isSidebarVisible, setIsSidebarVisible] = useState<boolean>(() => {
//     const stored = localStorage.getItem(SIDEBAR_VISIBLE_KEY);
//     return stored === "true";
//   });

//   useEffect(() => {
//     localStorage.setItem(SIDEBAR_VISIBLE_KEY, String(isSidebarVisible));
//   }, [isSidebarVisible]);

//   return (
//     <div
//       style={{
//         display: "flex",
//         height: "100vh",
//         background: theme.colors.background,
//       }}
//     >
//       {!isSidebarVisible && (
//         <div
//           onMouseEnter={() => setIsSidebarVisible(true)}
//           style={{
//             width: "10px",
//             cursor: "pointer",
//             background: theme.colors.surface,
//             borderRight: `1px solid ${theme.colors.border}`,
//           }}
//           title="Show menu"
//         />
//       )}

//       {isSidebarVisible && (
//         <div onMouseLeave={() => setIsSidebarVisible(false)}>
//           <Sidebar onNavigate={() => setIsSidebarVisible(false)} />
//         </div>
//       )}

//       <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
//         <Topbar
//           isSidebarVisible={isSidebarVisible}
//           onToggleSidebar={() => setIsSidebarVisible((prev) => !prev)}
//         />
//         <div
//           style={{
//             flex: 1,
//             minHeight: 0,
//             padding: theme.spacing.xl,
//             overflowY: isOperatorMapRoute ? "hidden" : "auto",
//             overflowX: isOperatorMapRoute ? "hidden" : "auto",
//           }}
//         >
//           {children}
//         </div>
//       </div>
//     </div>
//   );
// }



import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { useTheme } from "../../context/ThemeContext";

const SIDEBAR_VISIBLE_KEY = "ui.sidebar.visible";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const location = useLocation();
  const isOperatorMapRoute = location.pathname === "/operator/map";

  const [isSidebarVisible, setIsSidebarVisible] = useState<boolean>(() => {
    const stored = localStorage.getItem(SIDEBAR_VISIBLE_KEY);
    return stored === "true";
  });

  useEffect(() => {
    localStorage.setItem(SIDEBAR_VISIBLE_KEY, String(isSidebarVisible));
  }, [isSidebarVisible]);

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        background: theme.colors.background,
      }}
    >
      {/* Collapsed Hover Strip */}
      {!isSidebarVisible && (
        <div
          onMouseEnter={() => setIsSidebarVisible(true)}
          style={{
            width: 8,
            cursor: "pointer",
            background: theme.colors.surfaceAlt,
            borderRight: `1px solid ${theme.colors.border}`,
            transition: "all 0.2s ease",
          }}
          title="Show menu"
        />
      )}

      {/* Sidebar */}
      {isSidebarVisible && (
        <div
          onMouseLeave={() => setIsSidebarVisible(false)}
          style={{
            height: "100%",
            display: "flex",
          }}
        >
          <Sidebar onNavigate={() => setIsSidebarVisible(false)} />
        </div>
      )}

      {/* Main Content */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          minHeight: 0,
        }}
      >
        {/* Topbar */}
        <Topbar
          isSidebarVisible={isSidebarVisible}
          onToggleSidebar={() => setIsSidebarVisible((prev) => !prev)}
        />

        {/* Page Content */}
        <main
          style={{
            flex: 1,
            minHeight: 0,
            padding: theme.spacing.lg,
            overflowY: isOperatorMapRoute ? "hidden" : "auto",
            overflowX: isOperatorMapRoute ? "hidden" : "auto",
            transition: "all 0.2s ease",
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}