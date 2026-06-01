import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";

interface Props {
  roles: string[];
  children: React.ReactNode;
}

export function RequireRole({ roles, children }: Props) {
  const { user } = useAuthStore();

  if (!user || !roles.includes(user.rol)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
