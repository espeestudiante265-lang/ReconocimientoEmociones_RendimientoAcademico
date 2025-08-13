"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function EditClassPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const API = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";
  const [name, setName] = useState("");
  const [description, setDesc] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const token = localStorage.getItem("token");
      if (!token) return router.replace("/login");
      const res = await fetch(`${API}/api/classrooms/${id}/`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) return router.replace("/login");
      const data = await res.json();
      setName(data.name); setDesc(data.description);
      setLoading(false);
    };
    load();
  }, [API, id, router]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    const res = await fetch(`${API}/api/classrooms/${id}/`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    });
    if (!res.ok) return alert("No se pudo guardar");
    router.push(`/classroom/${id}`);
  };

  if (loading) return <div className="p-6">Cargando...</div>;

  return (
    <form onSubmit={save} className="max-w-md mx-auto p-6 space-y-3">
      <h1 className="text-xl font-bold">Editar clase</h1>
      <input className="border p-2 w-full" value={name} onChange={(e) => setName(e.target.value)} />
      <textarea className="border p-2 w-full" value={description} onChange={(e) => setDesc(e.target.value)} />
      <button className="bg-blue-600 text-white px-4 py-2 rounded">Guardar</button>
    </form>
  );
}
