"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type PhaseSummary = {
  counts: Record<string, number>;
  total: number;
  risk_index: number;
  risk_label: string;
};

type ActivityReport = {
  id: number;
  title: string;
  type: string;
  video: PhaseSummary;
  quiz: PhaseSummary;
  overall_risk: PhaseSummary;
  grade: number | null;
  graded_at: string | null;
};

type StudentReport = {
  id: number;
  username: string;
  email: string;
  activities: ActivityReport[];
  overall_risk: PhaseSummary;
};

type RiskPayload = {
  classroom: { id: number; name: string; description: string; code?: string | null };
  students: StudentReport[];
};

export default function ClassroomRisk() {
  const { id } = useParams<{ id: string }>();
  const API = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";
  const router = useRouter();

  const [data, setData] = useState<RiskPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return router.replace("/login");
        const res = await fetch(`${API}/api/teacher/classrooms/${id}/risk/`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401 || res.status === 403) return router.replace("/login");
        if (!res.ok) throw new Error(await res.text());
        setData(await res.json());
      } catch (e: any) {
        setErr(e?.message ?? "Error");
      } finally {
        setLoading(false);
      }
    })();
  }, [API, id, router]);

  if (loading) return <div className="p-6">Cargando...</div>;
  if (err) return <div className="p-6 text-red-600">{err}</div>;
  if (!data) return null;

  const badgeClass = (label: string) => {
    if (label.includes("Alto")) return "bg-red-100 text-red-700";
    if (label.includes("Medio")) return "bg-yellow-100 text-yellow-800";
    return "bg-green-100 text-green-700";
  };

  const countsLine = (counts: Record<string, number>) =>
    Object.entries(counts).length === 0
      ? "Sin registros"
      : Object.entries(counts)
          .map(([emo, n]) => `${emo}: ${n}`)
          .join(" · ");

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {data.classroom.name}{" "}
          <span className="text-sm text-gray-500">({data.classroom.code ?? "sin código"})</span>
        </h1>
        <p className="text-gray-700">{data.classroom.description}</p>
      </div>

      {data.students.length === 0 ? (
        <p className="text-gray-600">No hay estudiantes inscritos.</p>
      ) : (
        <div className="space-y-4">
          {data.students.map((stu) => (
            <details key={stu.id} className="group border rounded-lg bg-white shadow-sm">
              <summary className="list-none cursor-pointer select-none flex items-center justify-between p-4">
                <div className="flex flex-col">
                  <span className="font-semibold">
                    {stu.username} <span className="text-sm text-gray-500">({stu.email})</span>
                  </span>
                  <span className="text-sm">
                    Riesgo global:&nbsp;
                    <span className={`px-2 py-0.5 rounded ${badgeClass(stu.overall_risk.risk_label)}`}>
                      {stu.overall_risk.risk_label}
                    </span>
                    <span className="text-xs text-gray-500 ml-2">(índice {stu.overall_risk.risk_index})</span>
                  </span>
                </div>
                <span className="text-gray-400 transition-transform group-open:rotate-180">⌄</span>
              </summary>

              {/* Contenido del estudiante */}
              <div className="p-4 pt-0 pb-4">
                {stu.activities.length === 0 ? (
                  <div className="text-gray-600">Sin actividades.</div>
                ) : (
                  <ul className="space-y-3">
                    {stu.activities.map((act) => (
                      <details key={act.id} className="group border rounded-md">
                        <summary className="list-none cursor-pointer select-none flex items-center justify-between p-3">
                          <div>
                            <div className="font-medium">
                              {act.title}{" "}
                              {act.type === "VIDEO_QUIZ" && (
                                <span className="text-xs text-purple-700 ml-2">Video + Quiz</span>
                              )}
                            </div>
                            <div className="text-xs mt-1">
                              Riesgo (actividad):{" "}
                              <span className={`px-2 py-0.5 rounded ${badgeClass(act.overall_risk.risk_label)}`}>
                                {act.overall_risk.risk_label}
                              </span>
                              <span className="text-xs text-gray-500 ml-2">
                                (índice {act.overall_risk.risk_index})
                              </span>
                            </div>
                          </div>
                          <span className="text-gray-400 transition-transform group-open:rotate-180">⌄</span>
                        </summary>

                        {/* Contenido de la actividad */}
                        <div className="p-3 pt-0 space-y-3">
                          <div>
                            <div className="text-sm font-semibold">Mientras veía el video</div>
                            <div className="text-xs text-gray-700">
                              {countsLine(act.video.counts)}{" "}
                              <span className="text-gray-400">(total {act.video.total})</span>
                            </div>
                          </div>

                          <div>
                            <div className="text-sm font-semibold">Mientras realizó el examen</div>
                            <div className="text-xs text-gray-700">
                              {countsLine(act.quiz.counts)}{" "}
                              <span className="text-gray-400">(total {act.quiz.total})</span>
                            </div>
                          </div>

                          <div className="text-sm">
                            Calificación:&nbsp;
                            {act.grade == null ? (
                              <span className="text-gray-600">—</span>
                            ) : (
                              <b>{act.grade.toFixed(1)}%</b>
                            )}{" "}
                            {act.graded_at && (
                              <span className="text-xs text-gray-500">
                                ({new Date(act.graded_at).toLocaleString()})
                              </span>
                            )}
                          </div>
                        </div>
                      </details>
                    ))}
                  </ul>
                )}
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
