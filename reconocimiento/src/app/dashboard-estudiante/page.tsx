"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Classroom = { id: number; name: string; description: string; code: string };

export default function StudentDashboard() {
  const API = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";
  const router = useRouter();

  const [classes, setClasses] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const loadClasses = async () => {
    setErr(null);
    try {
      const token = localStorage.getItem("token");
      if (!token) return router.replace("/login");

      const res = await fetch(`${API}/api/student/classrooms/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) return router.replace("/login");
      if (!res.ok) throw new Error(await res.text());

      const data: Classroom[] = await res.json();
      setClasses(data);
    } catch (e: any) {
      setErr(e?.message ?? "Error al cargar aulas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClasses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enroll = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    try {
      const token = localStorage.getItem("token");
      if (!token) return router.replace("/login");

      const res = await fetch(`${API}/api/student/enroll-by-code/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "No se pudo inscribir");

      setMsg(`Te inscribiste a: ${data.classroom.name} (código ${data.classroom.code})`);
      setCode("");
      loadClasses();
    } catch (e: any) {
      setErr(e?.message ?? "Error al inscribirse");
    }
  };

  const unenroll = async (id: number) => {
    if (!confirm("¿Deseas darte de baja de esta clase?")) return;
    try {
      const token = localStorage.getItem("token");
      if (!token) return router.replace("/login");
      const res = await fetch(`${API}/api/student/classrooms/${id}/unenroll/`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) return router.replace("/login");
      if (!res.ok) throw new Error(await res.text());
      setClasses((prev) => prev.filter((c) => c.id !== id));
    } catch (e: any) {
      alert(e?.message ?? "No se pudo dar de baja");
    }
  };

  if (loading) return <div className="p-6">Cargando...</div>;

  return (
    <div className="min-h-[calc(100dvh-4rem)] p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">Dashboard Estudiante</h1>

        {/* Inscribirse por código */}
        <form onSubmit={enroll} className="flex gap-2">
          <input
            className="border p-2 flex-1 rounded"
            placeholder="Código de clase (ej. ABC123)"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            required
          />
          <button className="bg-blue-600 text-white px-4 rounded">Inscribirse</button>
        </form>

        {msg && <div className="text-green-600">{msg}</div>}
        {err && <div className="text-red-600">{err}</div>}

        {/* Aulas inscritas */}
        <div>
          <h2 className="text-xl font-semibold mb-2">Mis clases</h2>
          {classes.length === 0 ? (
            <p className="text-gray-600">Aún no estás inscrito en ninguna clase.</p>
          ) : (
            <ul className="grid sm:grid-cols-2 gap-4">
              {classes.map((c) => (
                <li key={c.id} className="bg-gray-100 rounded-xl p-4 shadow space-y-3">
                  <div>
                    <div className="font-semibold text-lg">{c.name}</div>
                    <div className="text-sm text-gray-700">{c.description}</div>
                  </div>

                  <div className="flex items-center justify-between">
                    <Link
                      href={`/classroom-est/${c.id}`}
                      className="bg-green-600 text-white text-sm px-3 py-1 rounded-md"
                    >
                      Ver actividades
                    </Link>
                    <button
                      onClick={() => unenroll(c.id)}
                      className="bg-red-600 text-white text-sm px-3 py-1 rounded-md"
                    >
                      Darse de baja
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
