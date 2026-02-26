import { useEffect, useState } from "react";
import { getUsers } from "../../api/users";
import { getRoles, type Role } from "../../api/roles";
import { useTheme } from "../../context/ThemeContext";

type UserRow = {
  id: string;
  username: string;
  email: string;
  role_id?: number | null;
};

type UsersTableProps = {
  refreshToken?: number;
};

export default function UsersTable({ refreshToken = 0 }: UsersTableProps) {
  const { theme } = useTheme();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [rolesById, setRolesById] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const [usersRes, rolesRes] = await Promise.all([getUsers(), getRoles()]);
        setUsers(usersRes.data);
        const roleMap = rolesRes.data.reduce((acc, role) => {
          acc[role.id] = role.name;
          return acc;
        }, {} as Record<number, string>);
        setRolesById(roleMap);
      } catch {
        setError("Failed to load users.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [refreshToken]);

  if (loading) {
    return <div>Loading users...</div>;
  }

  if (error) {
    return <div>{error}</div>;
  }

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", background: theme.colors.surfaceAlt, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, overflow: "hidden" }}>
      <thead>
        <tr>
          <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Username</th>
          <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Email</th>
          <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Role</th>
        </tr>
      </thead>
      <tbody>
        {users.map((u) => (
          <tr key={u.id}>
            <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{u.username}</td>
            <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{u.email}</td>
            <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
              {u.role_id ? rolesById[u.role_id] ?? `Role ${u.role_id}` : "-"}
            </td>
          </tr>
        ))}
        {users.length === 0 && (
          <tr>
            <td style={{ padding: theme.spacing.sm }} colSpan={3}>No users found.</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}