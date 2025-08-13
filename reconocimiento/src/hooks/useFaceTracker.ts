"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";

type LFD = faceapi.LabeledFaceDescriptors;

let MODELS_LOADED = false;
let LABELED_DESCRIPTORS: LFD[] = [];
let FACE_MATCHER: faceapi.FaceMatcher | null = null;

const MODEL_URL = "/models"; // en /public/models

function majority<T extends string>(arr: T[]): T | null {
  if (!arr.length) return null;
  const map = new Map<T, number>();
  for (const x of arr) map.set(x, (map.get(x) ?? 0) + 1);
  let best: T = arr[0];
  let bestN = 0;
  for (const [k, v] of map) if (v > bestN) { best = k; bestN = v; }
  return best;
}

type TrackerContext = {
  activityId?: number;
  phase?: "video" | "quiz";
};

export function useFaceTracker(autoSaveMs = 3000) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [ready, setReady] = useState(false);
  const [running, setRunning] = useState(false);


  // buffers y timers
  const bufferRef = useRef<Array<{ name: string; emotion: string }>>([]);
  const detLoopRef = useRef<number | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const firstSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // contexto opcional (actividad/fase)
  const ctxRef = useRef<TrackerContext>({});

  const API = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

  const loadModelsAndDescriptors = useCallback(async () => {
    if (!MODELS_LOADED) {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
      ]);
      MODELS_LOADED = true;
    }

    if (LABELED_DESCRIPTORS.length === 0) {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/api/get-labeled-images/`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("No se pudieron cargar las imágenes etiquetadas");
      const users: Array<{ username: string; image: string | null }> = await res.json();

      const descriptors: LFD[] = [];
      for (const user of users) {
        if (!user.image) continue;
        const imgUrl = user.image.startsWith("http")
          ? user.image
          : `${API}${user.image.startsWith("/") ? "" : "/"}${user.image}`;
        try {
          const img = await faceapi.fetchImage(imgUrl);
          const det = await faceapi
            .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptor();
          if (det) descriptors.push(new faceapi.LabeledFaceDescriptors(user.username, [det.descriptor]));
        } catch { }
      }

      LABELED_DESCRIPTORS = descriptors;
      FACE_MATCHER = new faceapi.FaceMatcher(LABELED_DESCRIPTORS, 0.6);
    }

    setReady(true);
  }, [API]);

  useEffect(() => {
    loadModelsAndDescriptors().catch(() => setReady(false));
  }, [loadModelsAndDescriptors]);

  const saveNow = useCallback(async () => {
    const buf = bufferRef.current;
    bufferRef.current = [];

    let name = "Desconocido";
    let emotion = "neutral";

    if (buf.length) {
      const names = buf.map(b => b.name).filter(n => n && n !== "Desconocido");
      const emo = buf.map(b => b.emotion).filter(Boolean) as string[];
      name = names.length ? majority(names)! : "Desconocido";
      emotion = emo.length ? majority(emo)! : "neutral";
    }

    if (name === "Desconocido") return;

    const payload: Record<string, any> = { name, emotion };
    if (ctxRef.current.activityId) payload.activity_id = ctxRef.current.activityId;
    if (ctxRef.current.phase) payload.phase = ctxRef.current.phase;

    try {
      await fetch(`${API}/api/save/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      // console.log("[faceTracker] enviado", payload);
    } catch (e) {
      // console.warn("[faceTracker] error guardando", e);
    }
  }, [API]);

  const stop = useCallback(() => {
    // Forzar guardado final de lo que quede en buffer
    saveNow().catch(() => { });

    if (detLoopRef.current) {
      window.clearInterval(detLoopRef.current);
      detLoopRef.current = null;
    }
    if (saveTimerRef.current) {
      clearInterval(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (firstSaveTimeoutRef.current) {
      clearTimeout(firstSaveTimeoutRef.current);
      firstSaveTimeoutRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    const video = videoRef.current;
    if (video) {
      try { video.pause(); } catch {}
      try { (video as any).srcObject = null; } catch {}
    }

    setRunning(false);
  }, [saveNow]);

  const startingRef = useRef(false);
  const start = useCallback(async () => {
    if (!ready || running || startingRef.current) return;
    startingRef.current = true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 720 }, height: { ideal: 480 }, facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) {
        console.warn("[useFaceTracker] refs no montados aún; reintento en 60ms");
        startingRef.current = false; // liberar “arrancando”
        setTimeout(() => {
          if (!running) start();
        }, 60);
        return;
      }
      if (video.srcObject !== stream) {
        try { video.pause(); } catch {}
        (video as any).srcObject = stream;
      }
      await new Promise<void>((resolve) => {
        if (video.readyState >= 2) return resolve();
        video.onloadedmetadata = () => resolve();
      });
      try {
        await video.play();
      } catch (err: any) {
        if (err?.name === "AbortError") {
          setTimeout(() => { video.play().catch(() => {}); }, 100);
        } else {
          console.error("video.play() falló:", err);
        }
      }

      faceapi.matchDimensions(canvas, { width: 720, height: 480 });
      setRunning(true);
      startingRef.current = false;


      // detección ~700ms
      detLoopRef.current = window.setInterval(async () => {
        if (!FACE_MATCHER || !video) return;
        const detections = await faceapi
          .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceDescriptors()
          .withFaceExpressions();

        const resized = faceapi.resizeResults(detections, { width: 720, height: 480 });
        const ctx = canvas.getContext("2d");
        ctx?.clearRect(0, 0, canvas.width, canvas.height);

        for (const d of resized) {
          const best = FACE_MATCHER.findBestMatch(d.descriptor);
          const label = best.label !== "unknown" ? best.label : "Desconocido";
          const exps = d.expressions || {};
          const emotion =
            Object.entries(exps).sort((a, b) => (b[1] as number) - (a[1] as number))[0]?.[0] ?? "neutral";

          // Dibujo opcional
          const draw = new faceapi.draw.DrawBox(d.detection.box, { label: `${label} (${emotion})` });
          draw.draw(canvas);

          bufferRef.current.push({ name: label, emotion });
        }
      }, 700);

      // guardado periódico
      saveTimerRef.current = setInterval(saveNow, autoSaveMs);

      // primer guardado temprano (5–10s)
      const early = Math.min(4000, Math.max(2000, Math.floor(autoSaveMs / 2)));
      firstSaveTimeoutRef.current = setTimeout(saveNow, early);
    } catch (e) {
      console.error("No se pudo iniciar la cámara:", e);
      startingRef.current = false;
    }
  }, [ready, running, autoSaveMs, saveNow]);

  // limpieza al desmontar
  useEffect(() => stop, [stop]);

  // Permite setear contexto desde las páginas (actividad/fase)
  const setContext = useCallback((ctx: TrackerContext) => {
    ctxRef.current = { ...ctxRef.current, ...ctx };
  }, []);

  return { videoRef, canvasRef, ready, running, start, stop, saveNow, setContext };
}
