import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";

export function AppLayout() {
  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-white">
        <div className="mx-auto max-w-[1280px] p-5 lg:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
