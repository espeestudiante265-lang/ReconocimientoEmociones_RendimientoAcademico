"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateClass() {
  const router = useRouter();
  const API = process.env.NEXT_PUBLIC_API_BASE;

  const [name, setName] = useState("");
  const [description, setDesc] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      if (!token) return router.replace("/login");

      const res = await fetch(`${API}/api/classroom/create/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, description }),
      });
      if (res.status === 401) return router.replace("/login");
      if (!res.ok) throw new Error(await res.text());

      router.push("/dashboard-docente")
    } catch (e: any) {
      alert(e?.message ?? "Error al crear la clase");
    }
  };

  return (
    <form onSubmit={submit} className="max-w-md mx-auto p-6 space-y-3">
      <h1 className="text-xl font-bold">Crear Clase</h1>
      <input
        className="border p-2 w-full"
        placeholder="Nombre de la clase"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <textarea
        className="border p-2 w-full"
        placeholder="Descripción"
        value={description}
        onChange={(e) => setDesc(e.target.value)}
        required
      />
      <button className="bg-blue-600 text-white px-4 py-2 rounded">Crear</button>
    </form>
  );
}
