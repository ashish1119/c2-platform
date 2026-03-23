// import AppLayout from "../../components/layout/AppLayout";
// import PageContainer from "../../components/layout/PageContainer";
// import UsersPage from "./UsersPage";
// import RolesPage from "./RolesPage";
// import { useTheme } from "../../context/ThemeContext";
// import Card from "../../components/ui/Card";

// export default function UserManagement() {
//   const { theme } = useTheme();

//   const sectionTitleStyle: React.CSSProperties = {
//     marginTop: 0,
//     marginBottom: theme.spacing.md,
//     color: theme.colors.textPrimary,
//   };

//   return (
//     <AppLayout>
//       <PageContainer title="User Management">
//         <div style={{ display: "grid", gap: theme.spacing.lg }}>
//           <section>
//             <Card>
//               <h2 style={sectionTitleStyle}>Users</h2>
//               <UsersPage />
//             </Card>
//           </section>
//           <section>
//             <Card>
//               <h2 style={sectionTitleStyle}>Roles</h2>
//               <RolesPage />
//             </Card>
//           </section>
//         </div>
//       </PageContainer>
//     </AppLayout>
//   );
// }


//BY PALLAVI
import AppLayout from "../../components/layout/AppLayout";
import PageContainer from "../../components/layout/PageContainer";
import UsersPage from "./UsersPage";
import RolesPage from "./RolesPage";
import { useTheme } from "../../context/ThemeContext";
import Card from "../../components/ui/Card";

export default function UserManagement() {
  const { theme, mode } = useTheme();
  const isDark = mode === "dark";

  const sectionHeader = (title: string, subtitle: string, color: string) => (
    <div
      style={{
        marginBottom: theme.spacing.md,
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div
        style={{
          fontSize: 18,
          fontWeight: 600,
          color: theme.colors.textPrimary,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: color,
          }}
        />
        {title}
      </div>

      <div
        style={{
          fontSize: 13,
          color: theme.colors.textSecondary,
        }}
      >
        {subtitle}
      </div>
    </div>
  );

  const getCardStyle = (accent: string): React.CSSProperties => ({
    padding: theme.spacing.lg,
    borderRadius: 12,
    border: `1px solid ${theme.colors.border}`,
    background: theme.colors.surface,
    boxShadow: isDark
      ? "0 8px 25px rgba(0,0,0,0.5)"
      : "0 6px 16px rgba(0,0,0,0.05)",
    transition: "all 0.2s ease",
    position: "relative",
    overflow: "hidden",
  });

  const accentBar = (color: string): React.CSSProperties => ({
    position: "absolute",
    top: 0,
    left: 0,
    height: "100%",
    width: 4,
    background: color,
  });

  return (
    <AppLayout>
      <PageContainer title="User Management">

        {/* 🔥 MAIN CONTAINER (90% WIDTH) */}
        <div
          style={{
            width: "90%",
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: theme.spacing.xl,
          }}
        >

          {/* 🔥 USERS SECTION */}
          <section>
            <Card>
              <div
                style={getCardStyle("#3B82F6")}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-3px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <div style={accentBar("#3B82F6")} />

                {sectionHeader(
                  "Users",
                  "Manage system users and access",
                  "#3B82F6"
                )}

                <div
                  style={{
                    borderTop: `1px solid ${theme.colors.border}`,
                    paddingTop: theme.spacing.md,
                  }}
                >
                  <UsersPage />
                </div>
              </div>
            </Card>
          </section>

          {/* 🔥 ROLES SECTION */}
          <section>
            <Card>
              <div
                style={getCardStyle("#8B5CF6")}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-3px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <div style={accentBar("#8B5CF6")} />

                {sectionHeader(
                  "Roles & Permissions",
                  "Define roles and control access levels",
                  "#8B5CF6"
                )}

                <div
                  style={{
                    borderTop: `1px solid ${theme.colors.border}`,
                    paddingTop: theme.spacing.md,
                  }}
                >
                  <RolesPage />
                </div>
              </div>
            </Card>
          </section>

        </div>

      </PageContainer>
    </AppLayout>
  );
}