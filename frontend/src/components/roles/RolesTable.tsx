import { useEffect, useState } from "react";
import { getRoles, type Role } from "../../api/roles";
import { useTheme } from "../../context/ThemeContext";

export default function RolesTable() {
	const { theme } = useTheme();
	const [roles, setRoles] = useState<Role[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const load = async () => {
			try {
				setLoading(true);
				setError(null);
				const res = await getRoles();
				setRoles(res.data);
			} catch {
				setError("Failed to load roles.");
			} finally {
				setLoading(false);
			}
		};
		load();
	}, []);

	if (loading) {
		return <div>Loading roles...</div>;
	}

	if (error) {
		return <div>{error}</div>;
	}

	return (
		<table style={{ width: "100%", borderCollapse: "collapse", background: theme.colors.surfaceAlt, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, overflow: "hidden" }}>
			<thead>
				<tr>
					<th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>ID</th>
					<th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Name</th>
					<th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Level</th>
				</tr>
			</thead>
			<tbody>
				{roles.map((role) => (
					<tr key={role.id}>
						<td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{role.id}</td>
						<td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{role.name}</td>
						<td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{role.level}</td>
					</tr>
				))}
				{roles.length === 0 && (
					<tr>
						<td style={{ padding: theme.spacing.sm }} colSpan={3}>No roles found.</td>
					</tr>
				)}
			</tbody>
		</table>
	);
}
