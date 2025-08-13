"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";

type Question = { text: string; order: number; options: { text: string; is_correct: boolean }[] };

export default function CreateVideoQuiz() {
  const { classroomId } = useParams<{ classroomId: string }>();
  const router = useRouter();
  const API = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

  const [title, setTitle] = useState("");
  const [description, setDesc] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [questions, setQuestions] = useState<Question[]>([
    { text: "", order: 0, options: [{ text: "", is_correct: true }, { text: "", is_correct: false }] },
  ]);

  const addQuestion = () => {
    setQuestions((q) => [...q, { text: "", order: q.length, options: [{ text: "", is_correct: true }, { text: "", is_correct: false }] }]);
  };
  const addOption = (qi: number) => {
    setQuestions((q) => {
      const nq = [...q];
      nq[qi].options.push({ text: "", is_correct: false });
      return nq;
    });
  };
  const setCorrect = (qi: number, oi: number) => {
    setQuestions((q) => {
      const nq = [...q];
      nq[qi].options = nq[qi].options.map((o, idx) => ({ ...o, is_correct: idx === oi }));
      return nq;
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      if (!token) return router.replace("/login");

      const payload = {
        title,
        description,
        due_date: dueDate,
        type: "VIDEO_QUIZ",
        video_url: videoUrl,
        quiz: {
          title: `Quiz: ${title}`,
          questions: questions.map((q, i) => ({
            text: q.text,
            order: i,
            options: q.options,
          })),
        },
      };

      const res = await fetch(`${API}/api/classroom/${classroomId}/activity/create/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      router.push(`/classroom/${classroomId}`);
    } catch (e: any) {
      alert(e?.message ?? "Error al crear Video+Quiz");
    }
  };

  return (
    <form onSubmit={submit} className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-bold">Crear Actividad (Video + Quiz)</h1>

      <input className="border p-2 w-full" placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} required />
      <textarea className="border p-2 w-full" placeholder="Descripción" value={description} onChange={(e) => setDesc(e.target.value)} required />
      <input type="datetime-local" className="border p-2 w-full" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
      <input className="border p-2 w-full" placeholder="URL de YouTube (https://...)" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} required />

      <div className="space-y-4">
        <div className="font-semibold">Preguntas</div>
        {questions.map((q, qi) => (
          <div key={qi} className="border rounded p-3 space-y-2 bg-white">
            <input className="border p-2 w-full" placeholder={`Pregunta ${qi + 1}`} value={q.text}
              onChange={(e) => {
                const v = e.target.value;
                setQuestions((prev) => {
                  const cp = [...prev]; cp[qi].text = v; return cp;
                });
              }}
              required
            />
            {q.options.map((o, oi) => (
              <div key={oi} className="flex items-center gap-2">
                <input className="border p-2 flex-1" placeholder={`Opción ${oi + 1}`} value={o.text}
                  onChange={(e) => {
                    const v = e.target.value;
                    setQuestions((prev) => {
                      const cp = [...prev]; cp[qi].options[oi].text = v; return cp;
                    });
                  }}
                  required
                />
                <label className="text-sm flex items-center gap-1">
                  <input type="radio" name={`correct-${qi}`} checked={o.is_correct} onChange={() => setCorrect(qi, oi)} />
                  Correcta
                </label>
              </div>
            ))}
            <button type="button" className="text-sm px-2 py-1 border rounded" onClick={() => addOption(qi)}>
              + Agregar opción
            </button>
          </div>
        ))}
        <button type="button" className="px-3 py-2 border rounded" onClick={addQuestion}>
          + Agregar pregunta
        </button>
      </div>

      <button className="bg-green-600 text-white px-4 py-2 rounded">Crear</button>
    </form>
  );
}
