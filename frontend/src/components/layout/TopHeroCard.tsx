import { Plus, ArrowUpFromLine } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Props {
  title: string;
  stats?: Array<{ label: string; value: string }>;
}

export function TopHeroCard({ title, stats }: Props) {
  const navigate = useNavigate();

  return (
    <div className="brand-panel-pattern relative overflow-hidden text-white rounded-card px-6 py-5 flex items-start justify-between gap-4">
      <div className="absolute inset-0 opacity-25">
        <div className="absolute -right-10 -top-8 h-28 w-28 rounded-[1.7rem] border border-white/25" />
        <div className="absolute right-16 top-9 h-16 w-28 rounded-[1.3rem] border border-white/20" />
        <div className="absolute right-48 bottom-[-1.5rem] h-20 w-32 rounded-[1.5rem] border border-white/15" />
      </div>
      <div className="relative">
        <h1 className="mt-1 text-2xl font-medium">{title}</h1>
        {stats && (
          <div className="flex gap-6 mt-4">
            {stats.map((s) => (
              <div key={s.label}>
                <p className="text-sm font-medium text-white/70">{s.label}</p>
                <p className="text-sm font-medium text-white">{s.value}</p>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="relative flex gap-2 shrink-0 pt-5">
        <button
          onClick={() => navigate("/ingreso")}
          className="flex items-center gap-2 bg-[hsl(var(--accent))] hover:bg-[hsl(var(--accent)/0.9)] text-[hsl(var(--primary))] text-sm font-medium px-4 py-2 rounded-btn transition-colors"
        >
          <Plus size={16} />
          Ingreso
        </button>
        <button
          onClick={() => navigate("/despacho")}
          className="flex items-center gap-2 bg-white/14 hover:bg-white/22 text-white text-sm font-medium px-4 py-2 rounded-btn transition-colors border border-white/20"
        >
          <ArrowUpFromLine size={16} />
          Despacho
        </button>
      </div>
    </div>
  );
}
