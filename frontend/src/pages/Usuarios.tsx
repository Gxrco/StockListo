import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { UserPlus, Pencil, UserX } from "lucide-react";
import { api } from "@/lib/api";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { toast } from "@/components/ui/Toast";

const ROL_OPTIONS = ["ADMIN", "OPERATOR", "VIEWER"] as const;

const createSchema = z.object({
  nombre: z.string().min(2, "Mínimo 2 caracteres"),
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
  rol: z.enum(ROL_OPTIONS),
});

const editSchema = z.object({
  nombre: z.string().min(2).optional(),
  rol: z.enum(ROL_OPTIONS).optional(),
  activo: z.boolean().optional(),
});

type CreateForm = z.infer<typeof createSchema>;
type EditForm = z.infer<typeof editSchema>;

function RolChip({ rol }: { rol: string }) {
  const map: Record<string, string> = {
    ADMIN: "bg-purple-100 text-purple-800",
    OPERATOR: "bg-blue-100 text-blue-800",
    VIEWER: "bg-gray-100 text-gray-600",
  };
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${map[rol] ?? "bg-gray-100 text-gray-600"}`}>
      {rol}
    </span>
  );
}

export default function Usuarios() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const { data } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.get<any>("/users"),
  });
  const users: any[] = data?.data ?? [];

  const createForm = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { rol: "OPERATOR" },
  });

  const editForm = useForm<EditForm>({
    resolver: zodResolver(editSchema),
  });

  const createMut = useMutation({
    mutationFn: (d: CreateForm) => api.post("/users", d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success("Usuario creado");
      setShowCreate(false);
      createForm.reset();
    },
    onError: () => toast.error("No se pudo crear el usuario"),
  });

  const editMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: EditForm }) => api.patch(`/users/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success("Usuario actualizado");
      setEditing(null);
    },
    onError: () => toast.error("No se pudo actualizar el usuario"),
  });

  const deactivateMut = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success("Usuario desactivado");
    },
    onError: () => toast.error("No se pudo desactivar el usuario"),
  });

  function openEdit(u: any) {
    setEditing(u);
    editForm.reset({ nombre: u.nombre, rol: u.rol, activo: u.activo });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">Usuarios</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.9)] text-white text-sm font-medium px-4 py-2 rounded-btn transition-colors"
        >
          <UserPlus size={15} />
          Nuevo usuario
        </button>
      </div>

      <div className="bg-white rounded-card shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {["Nombre", "Email", "Rol", "Estado", ""].map((h) => (
                <th key={h} className="px-5 py-3 text-left text-[11px] uppercase tracking-wide font-medium text-gray-400">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-sm text-gray-400">Sin usuarios</td>
              </tr>
            ) : users.map((u: any) => (
              <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-5 py-3 text-sm font-medium text-gray-800">{u.nombre}</td>
                <td className="px-5 py-3 text-xs text-gray-500">{u.email}</td>
                <td className="px-5 py-3"><RolChip rol={u.rol} /></td>
                <td className="px-5 py-3">
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${u.activo ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700"}`}>
                    {u.activo ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => openEdit(u)}
                      className="p-1.5 text-gray-400 hover:text-[hsl(var(--primary))] rounded hover:bg-gray-100 transition-colors"
                      title="Editar"
                    >
                      <Pencil size={14} />
                    </button>
                    {u.activo && (
                      <button
                        onClick={() => deactivateMut.mutate(u.id)}
                        disabled={deactivateMut.isPending}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
                        title="Desactivar"
                      >
                        <UserX size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => { setShowCreate(false); createForm.reset(); }}>
        <ModalHeader><h2 className="text-base font-semibold text-gray-800">Nuevo usuario</h2></ModalHeader>
        <form onSubmit={createForm.handleSubmit((d) => createMut.mutate(d))}>
          <ModalBody>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nombre</label>
                <input {...createForm.register("nombre")}
                  className="w-full h-9 px-3 border border-gray-200 rounded-btn text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]" />
                {createForm.formState.errors.nombre && (
                  <p className="text-xs text-red-600 mt-1">{createForm.formState.errors.nombre.message}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                <input {...createForm.register("email")} type="email"
                  className="w-full h-9 px-3 border border-gray-200 rounded-btn text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]" />
                {createForm.formState.errors.email && (
                  <p className="text-xs text-red-600 mt-1">{createForm.formState.errors.email.message}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Contraseña</label>
                <input {...createForm.register("password")} type="password"
                  className="w-full h-9 px-3 border border-gray-200 rounded-btn text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]" />
                {createForm.formState.errors.password && (
                  <p className="text-xs text-red-600 mt-1">{createForm.formState.errors.password.message}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Rol</label>
                <select {...createForm.register("rol")}
                  className="w-full h-9 px-3 border border-gray-200 rounded-btn text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]">
                  {ROL_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <button type="button" onClick={() => { setShowCreate(false); createForm.reset(); }}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-btn transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={createMut.isPending}
              className="px-4 py-2 text-sm font-medium bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.9)] text-white rounded-btn transition-colors disabled:opacity-50">
              {createMut.isPending ? "Creando..." : "Crear usuario"}
            </button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)}>
        <ModalHeader><h2 className="text-base font-semibold text-gray-800">Editar: {editing?.nombre ?? ""}</h2></ModalHeader>
        <form onSubmit={editForm.handleSubmit((d) => editMut.mutate({ id: editing.id, data: d }))}>
          <ModalBody>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nombre</label>
                <input {...editForm.register("nombre")}
                  className="w-full h-9 px-3 border border-gray-200 rounded-btn text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Rol</label>
                <select {...editForm.register("rol")}
                  className="w-full h-9 px-3 border border-gray-200 rounded-btn text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]">
                  {ROL_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" {...editForm.register("activo")} className="rounded" />
                Usuario activo
              </label>
            </div>
          </ModalBody>
          <ModalFooter>
            <button type="button" onClick={() => setEditing(null)}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-btn transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={editMut.isPending}
              className="px-4 py-2 text-sm font-medium bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.9)] text-white rounded-btn transition-colors disabled:opacity-50">
              {editMut.isPending ? "Guardando..." : "Guardar cambios"}
            </button>
          </ModalFooter>
        </form>
      </Modal>
    </div>
  );
}
