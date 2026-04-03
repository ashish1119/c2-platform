import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ForbiddenPage() {
  const { user } = useAuth();
  const fallbackPath = user?.role === "ADMIN" ? "/admin/command-center" : "/operator/dashboard";

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #071120 0%, #0d1f3a 50%, #122b4d 100%)",
        color: "#eaf2ff",
        display: "grid",
        placeItems: "center",
        padding: "2rem",
      }}
    >
      <section
        style={{
          width: "min(560px, 100%)",
          border: "1px solid rgba(176, 214, 255, 0.26)",
          background: "rgba(7, 17, 32, 0.84)",
          borderRadius: "16px",
          padding: "1.5rem",
          boxShadow: "0 14px 32px rgba(2, 8, 18, 0.45)",
        }}
      >
        <p style={{ margin: 0, color: "#9fc6ff", letterSpacing: "0.08em", fontWeight: 600 }}>403 FORBIDDEN</p>
        <h1 style={{ marginTop: "0.5rem", marginBottom: "0.75rem" }}>You do not have access to this page</h1>
        <p style={{ marginTop: 0, color: "#bdd8ff", lineHeight: 1.5 }}>
          Your account is signed in, but the current role or permissions are not allowed for this route.
        </p>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "1.25rem" }}>
          <Link
            to={fallbackPath}
            style={{
              padding: "0.65rem 0.9rem",
              borderRadius: "10px",
              background: "#2f7de1",
              color: "#ffffff",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            Go to Dashboard
          </Link>
          <Link
            to="/login"
            style={{
              padding: "0.65rem 0.9rem",
              borderRadius: "10px",
              border: "1px solid rgba(189, 216, 255, 0.5)",
              color: "#d9e9ff",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            Switch account
          </Link>
        </div>
      </section>
    </main>
  );
}
