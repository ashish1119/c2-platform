import UsersPage from "./UsersPage";
import RolesPage from "./RolesPage";
import PermissionsPage from "./PermissionsPage";
import { useTheme } from "../../context/ThemeContext";
import Card from "../../components/ui/Card";

export default function UserManagement() {
  const { theme } = useTheme();

  const sectionTitleStyle: React.CSSProperties = {
    marginTop: 0,
    marginBottom: theme.spacing.md,
    color: theme.colors.textPrimary,
  };

  return (
    <div style={{ display: "grid", gap: theme.spacing.lg }}>
      <section>
        <Card>
          <h2 style={sectionTitleStyle}>Users</h2>
          <UsersPage />
        </Card>
      </section>
      <section>
        <Card>
          <h2 style={sectionTitleStyle}>Roles</h2>
          <RolesPage />
        </Card>
      </section>

      <section>
        <Card>
          <h2 style={sectionTitleStyle}>Permissions</h2>
          <PermissionsPage />
        </Card>
      </section>
    </div>
  );
}