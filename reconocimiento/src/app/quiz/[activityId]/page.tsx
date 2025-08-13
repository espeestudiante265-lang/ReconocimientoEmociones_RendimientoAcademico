"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useFaceTracker } from "@/hooks/useFaceTracker";

type Option = { id: number; text: string };
type Question = { id: number; text: string; order: number; options: Option[] };
type Quiz = { id: number; title: string; questions: Question[]; already_submitted?: boolean };

export default function QuizPage() {
  const { activityId } = useParams<{ activityId: string }>();
  const API = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";
  const router = useRouter();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);

  // El hook exporte setContext
  const { videoRef, canvasRef, ready, running, start, stop, setContext } = useFaceTracker(30000);

  useEffect(() => {
    const load = async () => {
      const token = localStorage.getItem("token");
      if (!token) return router.replace("/login");
      const res = await fetch(`${API}/api/student/activities/${activityId}/quiz/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { alert(await res.text()); return router.back(); }
      setQuiz(await res.json());
      setLoading(false);
    };
    load();
  }, [API, activityId, router]);

  // Arrancar cámara al entrar al quiz (solo cuando models/labels estén listos)
  useEffect(() => {
    if (!ready) return;
    setContext({ activityId: Number(activityId), phase: "quiz" });
    start();
    return () => stop();
  }, [ready, activityId, setContext, start, stop]);


  const submit = async () => {
    const token = localStorage.getItem("token");
    const payload = {
      answers: Object.entries(answers).map(([qid, oid]) => ({
        question: Number(qid),
        option: Number(oid),
      })),
    };
    const res = await fetch(`${API}/api/student/activities/${activityId}/quiz/submit/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) return alert(data?.error || "No se pudo enviar el quiz");
    alert(`Puntaje: ${data.score.toFixed(1)}% (${data.correct}/${data.total})`);
    stop();
    router.back();
  };

  if (loading) return <div className="p-6">Cargando...</div>;
  if (!quiz) return null;

  const totalQuestions = quiz.questions?.length ?? 0;
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">{quiz.title}</h1>

      {quiz.already_submitted ? (
        <div className="p-3 rounded bg-yellow-100 text-yellow-800">
          Ya enviaste este examen. Solo se permite un intento.
        </div>
      ) : null}

      {totalQuestions === 0 ? (
        <div className="p-3 rounded bg-gray-100 text-gray-700">
          Este examen aún no tiene preguntas asignadas. Avise al docente.
        </div>
      ) : (
        <div className="space-y-4">
          {quiz.questions
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((q, idx) => (
              <div key={q.id} className="border rounded p-3">
                <div className="font-medium mb-2">{idx + 1}. {q.text}</div>
                <div className="space-y-1">
                  {q.options.map(o => (
                    <label key={o.id} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`q-${q.id}`}
                        checked={answers[q.id] === o.id}
                        onChange={() => setAnswers(a => ({ ...a, [q.id]: o.id }))}
                        disabled={!!quiz.already_submitted}
                      />
                      {o.text}
                    </label>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}

      <button
        className="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50"
        onClick={submit}
        disabled={quiz.already_submitted || answeredCount < totalQuestions}
        title={
          quiz.already_submitted
            ? "Ya enviaste este examen"
            : (answeredCount < totalQuestions ? "Responde todas las preguntas" : "Enviar respuestas")
        }
      >
        Enviar
      </button>

      {/* Overlay SIEMPRE montado (solo variamos opacidad) */}
      <div
        className={`fixed bottom-4 right-4 w-[280px] h-[180px] bg-black/70 rounded-lg overflow-hidden shadow-lg z-30 transition-opacity ${running ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        aria-hidden={!running}
      >
        <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover absolute inset-0" />
        <canvas ref={canvasRef} className="w-full h-full absolute inset-0" />
      </div>
    </div>
  );
}
