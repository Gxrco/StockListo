import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { RequireAuth } from "@/routes/RequireAuth";
import { RequireRole } from "@/routes/RequireRole";
import { useAuthStore } from "@/stores/authStore";

import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Inventario from "@/pages/Inventario";
import Ingreso from "@/pages/Ingreso";
import Despacho from "@/pages/Despacho";
import Kardex from "@/pages/Kardex";
import Alertas from "@/pages/Alertas";
import Reportes from "@/pages/Reportes";
import Usuarios from "@/pages/Usuarios";
import Configuracion from "@/pages/Configuracion";

function Home() {
  const { user } = useAuthStore();
  if (user?.rol === "ADMIN") return <Dashboard />;
  return <Navigate to="/inventario" replace />;
}

export const router = createBrowserRouter([
  { path: "/login", element: <Login /> },
  {
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Home /> },
      { path: "inventario", element: <Inventario /> },
      {
        path: "ingreso",
        element: (
          <RequireRole roles={["ADMIN", "OPERATOR"]}>
            <Ingreso />
          </RequireRole>
        ),
      },
      {
        path: "despacho",
        element: (
          <RequireRole roles={["ADMIN", "OPERATOR"]}>
            <Despacho />
          </RequireRole>
        ),
      },
      { path: "kardex/:productId?", element: <Kardex /> },
      {
        path: "alertas",
        element: (
          <RequireRole roles={["ADMIN"]}>
            <Alertas />
          </RequireRole>
        ),
      },
      {
        path: "reportes",
        element: (
          <RequireRole roles={["ADMIN"]}>
            <Reportes />
          </RequireRole>
        ),
      },
      {
        path: "usuarios",
        element: (
          <RequireRole roles={["ADMIN"]}>
            <Usuarios />
          </RequireRole>
        ),
      },
      {
        path: "configuracion",
        element: (
          <RequireRole roles={["ADMIN"]}>
            <Configuracion />
          </RequireRole>
        ),
      },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);
