import { useEffect, useState } from "react";
import { createUser } from "../../api/users";
import { getRoles, type Role } from "../../api/roles";
import UsersTable from "../../components/users/UsersTable";
import { useTheme } from "../../context/ThemeContext";

export default function UsersPage() {
	const { theme } = useTheme();
	const [username, setUsername] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [roleId, setRoleId] = useState(1);
	const [roles, setRoles] = useState<Role[]>([]);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const [refreshToken, setRefreshToken] = useState(0);

	useEffect(() => {
		const loadRoles = async () => {
			try {
				const response = await getRoles();
				setRoles(response.data);
				if (response.data.length > 0) {
					setRoleId(response.data[0].id);
				}
			} catch {
				setError("Failed to load roles.");
			}
		};

		loadRoles();
	}, []);

	const handleCreate = async () => {
		try {
			if (!username.trim() || !email.trim() || !password.trim()) {
				setError("Username, email, and password are required.");
				return;
			}

			setSubmitting(true);
			setError(null);
			setSuccess(null);
			await createUser({ username, email, password, role_id: roleId });
			setUsername("");
			setEmail("");
			setPassword("");
			setSuccess("User created successfully.");
			setRefreshToken((value) => value + 1);
		} catch (err: any) {
			const detail = err?.response?.data?.detail;
			setError(typeof detail === "string" ? detail : "Failed to create user.");
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<div style={{ display: "grid", gap: 16 }}>
			<div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
				<input
					placeholder="Username"
					value={username}
					onChange={(e) => setUsername(e.target.value)}
					style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surfaceAlt, color: theme.colors.textPrimary }}
				/>
				<input
					placeholder="Email"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surfaceAlt, color: theme.colors.textPrimary }}
				/>
				<input
					placeholder="Password"
					type="password"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surfaceAlt, color: theme.colors.textPrimary }}
				/>
				<select
					value={roleId}
					onChange={(e) => setRoleId(Number(e.target.value))}
					style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surfaceAlt, color: theme.colors.textPrimary }}
				>
					{roles.map((role) => (
						<option key={role.id} value={role.id}>
							{role.name}
						</option>
					))}
				</select>
			</div>
			<button
				disabled={submitting}
				onClick={handleCreate}
				style={{ width: "fit-content", padding: `${theme.spacing.sm} ${theme.spacing.md}`, border: "none", borderRadius: theme.radius.md, background: theme.colors.primary, color: "#fff", cursor: "pointer" }}
			>
				{submitting ? "Creating..." : "Create User"}
			</button>
			{error && <div style={{ color: theme.colors.danger }}>{error}</div>}
			{success && <div style={{ color: theme.colors.success }}>{success}</div>}
			<UsersTable refreshToken={refreshToken} />
		</div>
	);
}
