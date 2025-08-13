"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Copy, Pencil, UserMinus, Trash2 } from "lucide-react";

interface Classroom {
  id: number;
  name: string;
  description: string;
  activities_count: number;
  code?: string;
}

interface Activity {
  id: number;
  title: string;
  description: string;
  due_date: string;
}

interface Student {
  id: number;
  username: string;
  email: string;
}

export default function ClassroomDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const API = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

  const [cls, setCls] = useState<Classroom | null>(null);
  const [acts, setActs] = useState<Activity[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

  const loadAll = async () => {
    try {
      if (!token) return router.replace("/login");

      const [cRes, aRes, sRes] = await Promise.all([
        fetch(`${API}/api/classrooms/${id}/`, { headers: authHeader }),
        fetch(`${API}/api/classrooms/${id}/activities/`, { headers: authHeader }),
        fetch(`${API}/api/classrooms/${id}/students/`, { headers: authHeader }),
      ]);

      if ([cRes.status, aRes.status, sRes.status].includes(401)) return router.replace("/login");
      if (!cRes.ok) throw new Error(await cRes.text());
      if (!aRes.ok) throw new Error(await aRes.text());
      if (!sRes.ok) throw new Error(await sRes.text());

      setCls(await cRes.json());
      setActs(await aRes.json());
      setStudents(await sRes.json());
    } catch (e: any) {
      setErr(e?.message ?? "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const copyCode = async (code?: string) => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      alert(`Código copiado: ${code}`);
    } catch {
      alert("No se pudo copiar el código.");
    }
  };

  const removeStudent = async (studentId: number) => {
    if (!confirm("¿Quitar a este estudiante de la clase?")) return;
    try {
      const res = await fetch(`${API}/api/classrooms/${id}/students/${studentId}/`, {
        method: "DELETE",
        headers: authHeader,
      });
      if (res.status === 401) return router.replace("/login");
      if (!res.ok) throw new Error(await res.text());
      setStudents((prev) => prev.filter((s) => s.id !== studentId));
    } catch (e: any) {
      alert(e?.message ?? "No se pudo quitar al estudiante");
    }
  };

  // 🔴 Eliminar actividad
  const deleteActivity = async (activityId: number) => {
    if (!confirm("¿Eliminar esta actividad? Se borrarán también su quiz y resultados.")) return;
    try {
      if (!token) return router.replace("/login");
      const res = await fetch(`${API}/api/activities/${activityId}/`, {
        method: "DELETE",
        headers: authHeader,
      });
      if (res.status === 401) return router.replace("/login");
      if (res.status === 403) return alert("No tienes permiso para eliminar esta actividad.");
      if (!res.ok) throw new Error(await res.text());
      setActs((prev) => prev.filter((a) => a.id !== activityId));
    } catch (e: any) {
      alert(e?.message ?? "No se pudo eliminar la actividad");
    }
  };

  if (loading) return <div className="p-6">Cargando...</div>;
  if (err) return <div className="p-6 text-red-600">Error: {err}</div>;
  if (!cls) return null;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header clase */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{cls.name}</h1>
          <p className="text-gray-700">{cls.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/classroom/${cls.id}/edit`}
            className="inline-flex items-center gap-1 px-3 py-2 rounded bg-gray-800 text-white text-sm"
            title="Editar clase"
          >
            <Pencil size={16} /> Editar
          </Link>
          <button
            onClick={() => copyCode(cls.code)}
            className="inline-flex items-center gap-1 px-3 py-2 rounded border text-sm"
            title="Copiar código"
          >
            <Copy size={16} /> Copiar código
          </button>
        </div>
      </div>

      {/* Código de clase */}
      <div className="flex items-center justify-between bg-gray-50 border rounded p-3">
        <div className="text-sm text-gray-700">
          Código de inscripción:&nbsp;
          <span className="font-mono font-semibold">{cls.code ?? "—"}</span>
        </div>
        <div className="text-xs text-gray-600">Actividades: {cls.activities_count}</div>
      </div>

      {/* Acciones */}
      <div className="flex justify-end">
        <button
          className="bg-green-600 text-white px-3 py-2 rounded"
          onClick={() => router.push(`/create-activity/${cls.id}`)}
        >
          Nueva actividad
        </button>
      </div>

      {/* Actividades */}
      <section>
        <h2 className="text-xl font-semibold mb-2">Actividades</h2>
        {acts.length === 0 ? (
          <p className="text-gray-600">No hay actividades aún.</p>
        ) : (
          <ul className="space-y-3">
            {acts.map((a) => (
              <li key={a.id} className="border bg-white rounded p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{a.title}</div>
                    <div className="text-sm text-gray-700">{a.description}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      Fecha límite: {new Date(a.due_date).toLocaleString()}
                    </div>
                  </div>
                  <button
                    className="text-red-600 hover:text-red-700 p-1 rounded"
                    title="Eliminar actividad"
                    onClick={() => deleteActivity(a.id)}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Estudiantes */}
      <section>
        <h2 className="text-xl font-semibold mb-2">Estudiantes</h2>
        {students.length === 0 ? (
          <p className="text-gray-600">No hay estudiantes inscritos.</p>
        ) : (
          <ul className="space-y-2">
            {students.map((s) => (
              <li key={s.id} className="flex items-center justify-between border rounded p-2">
                <div>
                  <div className="font-medium">{s.username}</div>
                  <div className="text-xs text-gray-600">{s.email}</div>
                </div>
                <button
                  onClick={() => removeStudent(s.id)}
                  className="inline-flex items-center gap-1 text-red-600 hover:text-red-700 text-sm"
                  title="Quitar estudiante"
                >
                  <UserMinus size={16} /> Quitar
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
