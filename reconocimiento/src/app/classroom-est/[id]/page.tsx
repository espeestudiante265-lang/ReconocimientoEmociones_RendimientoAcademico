"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useFaceTracker } from "@/hooks/useFaceTracker";

type Activity = {
  id: number;
  title: string;
  description: string;
  due_date: string;
  type?: string;
  video_url?: string;
};

declare global {
  interface Window { YT: any; onYouTubeIframeAPIReady: () => void; }
}

export default function ClassroomEst() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const API = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

  const [acts, setActs] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const { videoRef, canvasRef, ready, running, start, stop, setContext } = useFaceTracker(30000);
  const playersRef = useRef<Record<number, any>>({}); // players por actividad

  useEffect(() => {
    const load = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return router.replace("/login");
        const res = await fetch(`${API}/api/student/classrooms/${id}/activities/`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) return router.replace("/login");
        if (!res.ok) throw new Error(await res.text());
        setActs(await res.json());
      } catch (e: any) {
        setErr(e?.message ?? "Error al cargar actividades");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [API, id, router]);

  const extractId = (url?: string) => {
    if (!url) return "";
    try {
      const u = new URL(url);
      if (u.hostname.includes("youtu.be")) return u.pathname.slice(1);
      const v = u.searchParams.get("v");
      if (v) return v;
      const parts = u.pathname.split("/");
      const i = parts.indexOf("embed");
      if (i !== -1 && parts[i + 1]) return parts[i + 1];
      return "";
    } catch { return ""; }
  };

  // Cargar API de YouTube una sola vez
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.YT && window.YT.Player) return; // ya cargada
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.body.appendChild(tag);
    window.onYouTubeIframeAPIReady = () => {};
  }, []);

  // Crear/adjuntar player y manejar play/end
  const attachPlayer = (domId: string, videoId: string, activityId: number) => {
    if (!window.YT?.Player) return;
    if (playersRef.current[activityId]) return; // ya existe

    playersRef.current[activityId] = new window.YT.Player(domId, {
      videoId,
      events: {
        onStateChange: async (e: any) => {
          const state = e.data; // 1=playing, 0=ended, 2=paused

          if (state === 1) {
            // Arranca cámara y detección (con contexto)
            setContext({ activityId, phase: "video" });
            if (ready) {
              start();
            } else {
              // si aún no cargan modelos, reintenta suave
              setTimeout(() => start(), 300);
            }
          }

          if (state === 0) {
            // Fin del video: apaga y marca visto
            stop();
            try {
              const token = localStorage.getItem("token");
              await fetch(`${API}/api/student/activities/${activityId}/video-watched/`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
              });
            } catch {}
          }

          // opcional: pausar cámara al pausar el video
          // if (state === 2) stop();
        },
      },
    });
  };

  if (loading) return <div className="p-6">Cargando...</div>;
  if (err) return <div className="p-6 text-red-600">{err}</div>;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Actividades</h1>

      <ul className="space-y-3">
        {acts.map(a => {
          const vid = a.type === "VIDEO_QUIZ" ? extractId(a.video_url) : "";
          const domId = `yt-player-${a.id}`;
          return (
            <li key={a.id} className="border rounded p-3 bg-white space-y-3">
              <div className="font-medium">{a.title}</div>
              <div className="text-sm text-gray-700">{a.description}</div>

              {vid ? (
                <>
                  {/* Player YouTube controlado por API */}
                  <div className="aspect-video w-full">
                    <div
                      id={domId}
                      className="w-full h-full"
                      ref={(el) => {
                        if (el && vid && window.YT?.Player) {
                          attachPlayer(domId, vid, a.id);
                        }
                      }}
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      className="px-3 py-1 rounded bg-green-600 text-white"
                      onClick={() => router.push(`/quiz/${a.id}`)}
                    >
                      Iniciar examen
                    </button>
                  </div>
                </>
              ) : null}

              <div className="text-xs text-gray-500">
                Fecha límite: {new Date(a.due_date).toLocaleString()}
              </div>
            </li>
          );
        })}
      </ul>

      {/* Preview de cámara SIEMPRE montado (solo se oculta visualmente) */}
      <div
        className={`fixed bottom-4 right-4 w-[280px] h-[180px] bg-black/70 rounded-lg overflow-hidden shadow-lg z-30 transition-opacity ${
          running ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden={!running}
      >
        <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover absolute inset-0" />
        <canvas ref={canvasRef} className="w-full h-full absolute inset-0" />
      </div>
    </div>
  );
}
