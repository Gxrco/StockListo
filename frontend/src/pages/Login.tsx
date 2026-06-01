import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api, ApiError } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";

const schema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Contraseña requerida"),
});

type FormData = z.infer<typeof schema>;

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<any>("/auth/login", data);
      login(res.user, { accessToken: res.accessToken, refreshToken: res.refreshToken });
      const from = (location.state as any)?.from?.pathname ?? "/";
      navigate(from, { replace: true });
    } catch (e) {
      if (e instanceof ApiError) setError(e.problem.detail);
      else setError("Error de conexión.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--background))]">
      <div className="w-full max-w-sm bg-white rounded-card shadow-md p-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-[hsl(var(--primary))]">StockListo</h1>
          <p className="text-sm text-gray-500 mt-1">Inicia sesión para continuar</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              {...register("email")}
              className="w-full h-10 px-3 border border-[hsl(var(--border))] rounded-btn text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
              placeholder="admin@stocklisto.dev"
            />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Contraseña</label>
            <input
              type="password"
              {...register("password")}
              className="w-full h-10 px-3 border border-[hsl(var(--border))] rounded-btn text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
            />
            {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-btn px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 bg-[hsl(var(--accent))] hover:bg-[hsl(var(--accent)/0.9)] disabled:opacity-60 text-[hsl(var(--primary))] font-medium text-sm rounded-btn transition-colors"
          >
            {loading ? "Iniciando sesión..." : "Iniciar sesión"}
          </button>
        </form>
      </div>
    </div>
  );
}
