"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type ClassItem = { id: number; name: string; description: string; code?: string };

export default function StudentRiskHome() {
  const API = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";
  const router = useRouter();
  const [list, setList] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return router.replace("/login");
        const res = await fetch(`${API}/api/teacher/classrooms/`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) return router.replace("/login");
        if (!res.ok) throw new Error(await res.text());
        setList(await res.json());
      } catch (e: any) {
        setErr(e?.message ?? "Error");
      } finally {
        setLoading(false);
      }
    })();
  }, [API, router]);

  if (loading) return <div className="p-6">Cargando...</div>;
  if (err) return <div className="p-6 text-red-600">{err}</div>;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Rendimiento por Clase</h1>
      {list.length === 0 ? (
        <p>No tienes clases.</p>
      ) : (
        <ul className="space-y-2">
          {list.map(c => (
            <li key={c.id} className="border rounded p-3 flex items-center justify-between">
              <div>
                <div className="font-semibold">{c.name}</div>
                <div className="text-sm text-gray-600">{c.description}</div>
              </div>
              <Link className="bg-blue-600 text-white px-3 py-1 rounded" href={`/student-risk/classroom/${c.id}`}>
                Ver
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
