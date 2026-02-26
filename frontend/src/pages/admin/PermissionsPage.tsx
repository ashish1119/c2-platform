import { useEffect, useState } from "react";
import { createPermission, getPermissions, type Permission } from "../../api/permissions";
import { useTheme } from "../../context/ThemeContext";

export default function PermissionsPage() {
	const { theme } = useTheme();
	const [permissions, setPermissions] = useState<Permission[]>([]);
	const [resource, setResource] = useState("alerts");
	const [action, setAction] = useState("acknowledge");
	const [scope, setScope] = useState("GLOBAL");
	const [loading, setLoading] = useState(true);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const load = async () => {
		try {
			setLoading(true);
			setError(null);
			const res = await getPermissions();
			setPermissions(res.data);
		} catch {
			setError("Failed to load permissions.");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		load();
	}, []);

	const handleCreate = async () => {
		try {
			setSubmitting(true);
			setError(null);
			await createPermission({ resource, action, scope });
			await load();
		} catch {
			setError("Failed to create permission.");
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<div style={{ display: "grid", gap: 12 }}>
			<h3 style={{ marginTop: 0, marginBottom: theme.spacing.md }}>Permissions</h3>
			<div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
				<input style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surfaceAlt, color: theme.colors.textPrimary }} value={resource} onChange={(e) => setResource(e.target.value)} placeholder="resource" />
				<input style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surfaceAlt, color: theme.colors.textPrimary }} value={action} onChange={(e) => setAction(e.target.value)} placeholder="action" />
				<input style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surfaceAlt, color: theme.colors.textPrimary }} value={scope} onChange={(e) => setScope(e.target.value)} placeholder="scope" />
				<button style={{ border: "none", borderRadius: theme.radius.md, background: theme.colors.primary, color: "#fff", cursor: "pointer" }} disabled={submitting} onClick={handleCreate}>
					{submitting ? "Creating..." : "Create Permission"}
				</button>
			</div>
			{loading && <div>Loading permissions...</div>}
			{error && <div style={{ color: theme.colors.danger }}>{error}</div>}

			<table style={{ width: "100%", borderCollapse: "collapse", background: theme.colors.surfaceAlt, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, overflow: "hidden" }}>
				<thead>
					<tr>
						<th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>ID</th>
						<th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Resource</th>
						<th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Action</th>
						<th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Scope</th>
					</tr>
				</thead>
				<tbody>
					{permissions.map((permission) => (
						<tr key={permission.id}>
							<td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{permission.id}</td>
							<td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{permission.resource}</td>
							<td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{permission.action}</td>
							<td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{permission.scope}</td>
						</tr>
					))}
					{permissions.length === 0 && (
						<tr>
							<td style={{ padding: theme.spacing.sm }} colSpan={4}>No permissions found.</td>
						</tr>
					)}
				</tbody>
			</table>
		</div>
	);
}
