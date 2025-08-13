"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PlusCircle, BarChart3, Copy, Trash2, Pencil, PlaySquare } from "lucide-react";

interface Classroom {
  id: number;
  name: string;
  description: string;
  activities_count: number;
  code: string; // 👈 nuevo
}

export default function DashboardDocente() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();
  const API = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

  const fetchClassrooms = async () => {
    setErr(null);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const res = await fetch(`${API}/api/teacher/classrooms/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      if (!res.ok) throw new Error(await res.text());
      const data: Classroom[] = await res.json();
      setClassrooms(data);
    } catch (e: any) {
      setErr(e?.message ?? "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClassrooms();
  }, []); // eslint-disable-line

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      alert(`Código copiado: ${code}`);
    } catch {
      alert("No se pudo copiar el código.");
    }
  };

  const deleteClassroom = async (id: number) => {
    const ok = confirm("¿Eliminar esta clase? Esta acción no se puede deshacer.");
    if (!ok) return;
    try {
      const token = localStorage.getItem("token");
      if (!token) return router.replace("/login");
      const res = await fetch(`${API}/api/classrooms/${id}/`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) return router.replace("/login");
      if (res.status === 403) return alert("No tienes permiso para eliminar esta clase.");
      if (!res.ok) throw new Error(await res.text());
      // éxito: quita de la lista
      setClassrooms((prev) => prev.filter((c) => c.id !== id));
    } catch (e: any) {
      alert(e?.message ?? "Error al eliminar la clase");
    }
  };

  if (loading) return <div className="p-6">Cargando aulas...</div>;
  if (err) {
    return (
      <div className="p-6 space-y-3">
        <div className="text-red-600 font-semibold">Error: {err}</div>
        <button onClick={fetchClassrooms} className="px-4 py-2 rounded bg-gray-800 text-white">
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100dvh-4rem)] p-6">
      <div className="max-w-5xl mx-auto grid gap-10">
        {/* Crear Clase */}
        <div className="flex justify-center">
          <Link
            href="/create-class"
            className="bg-blue-600 hover:bg-blue-700 text-white flex flex-col items-center justify-center rounded-xl shadow-md transition-all duration-200 hover:scale-105 active:scale-95 h-40 w-full max-w-md p-4"
          >
            <PlusCircle size={32} className="mb-2" />
            <span className="text-center font-semibold">Crear Clase</span>
          </Link>
        </div>

        {/* Listado de clases */}
        <div>
          <h2 className="text-xl font-bold mb-4">Tus Clases</h2>
          {classrooms.length === 0 ? (
            <p className="text-gray-600">Aún no tienes clases creadas.</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {classrooms.map((c) => (
                <div key={c.id} className="bg-gray-100 rounded-xl p-4 shadow space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-lg">{c.name}</h3>
                      <p className="text-sm text-gray-700 line-clamp-3">{c.description}</p>
                    </div>
                    {/* Eliminar */}
                    <button
                      onClick={() => deleteClassroom(c.id)}
                      className="text-red-600 hover:text-red-700 p-1 rounded"
                      title="Eliminar clase"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>

                  {/* Código de clase + copiar */}
                  <div className="flex items-center justify-between bg-white rounded border p-2">
                    <span className="text-xs text-gray-700">
                      Código:&nbsp;
                      <span className="font-mono font-semibold">{c.code}</span>
                    </span>
                    <button
                      onClick={() => copyCode(c.code)}
                      className="text-gray-700 hover:text-gray-900 flex items-center gap-1 text-xs"
                      title="Copiar código"
                    >
                      <Copy size={14} />
                      Copiar
                    </button>
                  </div>

                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-xs text-gray-600">Actividades: {c.activities_count}</span>
                    <div className="flex gap-2">
                      <Link
                        href={`/create-activity/${c.id}`}
                        className="bg-green-600 text-white text-sm px-3 py-1 rounded-md"
                      >
                        <BarChart3 size={16} className="inline mr-1" />
                        Crear actividad
                      </Link>

                      <Link
                        href={`/create-video-quiz/${c.id}`}
                        className="bg-purple-600 text-white text-sm px-3 py-1 rounded-md"
                        title="Crear actividad con video y examen"
                      >
                        <PlaySquare size={16} className="inline mr-1" />
                        Video + Quiz
                      </Link>

                      <Link
                        href={`/classroom/${c.id}`}
                        className="bg-blue-600 text-white text-sm px-3 py-1 rounded-md"
                      >
                        Ver
                      </Link>
                    </div>

                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
