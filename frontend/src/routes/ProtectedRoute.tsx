import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface Props {
  children: JSX.Element;
  requiredRole?: string;
}

export default function ProtectedRoute({ children, requiredRole }: Props) {
  const { token, role } = useAuth();

  if (!token) return <Navigate to="/login" />;

  if (requiredRole && role !== requiredRole)
    return <Navigate to="/" />;

  return children;
}