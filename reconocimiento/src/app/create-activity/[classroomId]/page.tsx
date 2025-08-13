"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function CreateActivity() {
  const { classroomId } = useParams<{ classroomId: string }>();
  const router = useRouter();
  const API = process.env.NEXT_PUBLIC_API_BASE;

  const [title, setTitle] = useState("");
  const [description, setDesc] = useState("");
  const [dueDate, setDueDate] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      if (!token) return router.replace("/login");

      const res = await fetch(`${API}/api/classroom/${classroomId}/activity/create/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title, description, due_date: dueDate }),
      });
      if (res.status === 401) return router.replace("/login");
      if (!res.ok) throw new Error(await res.text());

      router.push(`/classroom/${classroomId}`);
    } catch (e: any) {
      alert(e?.message ?? "Error al crear la actividad");
    }
  };

  return (
    <form onSubmit={submit} className="max-w-md mx-auto p-6 space-y-3">
      <h1 className="text-xl font-bold">Crear Actividad</h1>
      <input
        className="border p-2 w-full"
        placeholder="Título"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />
      <textarea
        className="border p-2 w-full"
        placeholder="Descripción"
        value={description}
        onChange={(e) => setDesc(e.target.value)}
        required
      />
      <input
        type="datetime-local"
        className="border p-2 w-full"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
        required
      />
      <button className="bg-green-600 text-white px-4 py-2 rounded">Crear</button>
    </form>
  );
}
