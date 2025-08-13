"use client";

import React, { useRef, useEffect, useState } from "react";
import * as faceapi from "face-api.js";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertTriangle } from "lucide-react";

export default function FaceAuth() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recognizedNames, setRecognizedNames] = useState<string[]>([]);
  const [unrecognizedCount, setUnrecognizedCount] = useState(0);
  const [labeledDescriptors, setLabeledDescriptors] = useState<faceapi.LabeledFaceDescriptors[]>([]);
  const [pendingSaves, setPendingSaves] = useState<{ name: string; emotion: string }[]>([]);

  const API = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = "/models";
        setIsLoading(true);
        setError(null);

        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
        ]);

        await loadLabeledImages();
        setIsModelLoaded(true);
      } catch (err) {
        setError("Error al cargar los modelos de reconocimiento facial. Asegúrate de que los archivos estén en /public/models.");
        console.error("Error cargando los modelos:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadModels();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach((track) => track.stop());
      }
    };
  }, []);

  // Cargar imágenes etiquetadas (con token)
  const loadLabeledImages = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setError("No autenticado: inicia sesión para cargar el dataset de rostros.");
      return;
    }

    const res = await fetch(`${API}/api/get-labeled-images/`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.status === 401) {
      setError("Sesión expirada o no autorizada. Vuelve a iniciar sesión.");
      return;
    }
    if (!res.ok) {
      setError(`Error al obtener imágenes etiquetadas: ${res.status}`);
      return;
    }

    const users: Array<{ username: string; image: string | null }> = await res.json();
    const descriptors: faceapi.LabeledFaceDescriptors[] = [];

    for (const user of users) {
      if (user.image) {
        // Si el backend devuelve absoluta, úsala; si es relativa, prépéndele la base
        const imgUrl = user.image.startsWith("http")
          ? user.image
          : `${API}${user.image.startsWith("/") ? "" : "/"}${user.image}`;

        try {
          const img = await faceapi.fetchImage(imgUrl);
          const detection = await faceapi
            .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptor();

          if (detection) {
            descriptors.push(new faceapi.LabeledFaceDescriptors(user.username, [detection.descriptor]));
          } else {
            console.warn(`No se detectó rostro en ${user.username}`);
          }
        } catch (e) {
          console.warn(`No se pudo procesar la imagen de ${user.username}:`, e);
        }
      }
    }

    setLabeledDescriptors(descriptors);
  };

  const startVideo = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 720 }, height: { ideal: 480 }, facingMode: "user" },
      });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      setError("Error de cámara. Verifica permisos o conexión segura (HTTPS).");
      console.error(err);
    }
  };

  const handleVideoOnPlay = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const displaySize = { width: 720, height: 480 };
    faceapi.matchDimensions(canvas, displaySize);

    const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.6);

    const interval = setInterval(async () => {
      try {
        const detections = await faceapi
          .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceDescriptors()
          .withFaceExpressions();

        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        const ctx = canvas.getContext("2d");
        ctx?.clearRect(0, 0, canvas.width, canvas.height);

        const recognized: string[] = [];
        let unrecognized = 0;
        const pending: { name: string; emotion: string }[] = [];

        for (const detection of resizedDetections) {
          const bestMatch = faceMatcher.findBestMatch(detection.descriptor);
          const label = bestMatch.label !== "unknown" ? bestMatch.label : "Desconocido";

          const expressions = detection.expressions;
          const emotion = expressions
            ? (Object.entries(expressions).sort((a, b) => (b[1] as number) - (a[1] as number))[0][0] as string)
            : "unknown";

          const drawBox = new faceapi.draw.DrawBox(detection.detection.box, {
            label: `${label} (${emotion})`,
          });
          drawBox.draw(canvas);

          if (bestMatch.label !== "unknown") {
            recognized.push(label);
          } else {
            unrecognized++;
          }

          pending.push({ name: label, emotion });
        }

        setRecognizedNames(recognized);
        setUnrecognizedCount(unrecognized);
        setPendingSaves(pending);
      } catch (err) {
        console.error("Error durante detección:", err);
      }
    }, 500);

    return () => clearInterval(interval);
  };

  const sendRecognitionToBackend = async (name: string, emotion: string) => {
    try {
      await fetch(`${API}/api/save/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, emotion }),
      });
    } catch (err) {
      console.error("Error en la solicitud al backend:", err);
    }
  };

  const handleManualSave = async () => {
    for (const entry of pendingSaves) {
      await sendRecognitionToBackend(entry.name, entry.emotion);
    }
    setPendingSaves([]);
  };

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4 mr-2" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="relative w-full max-w-[720px] h-[480px] mx-auto bg-muted rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onPlay={handleVideoOnPlay}
          width="720"
          height="480"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <Loader2 className="w-8 h-8 animate-spin text-white" />
          </div>
        )}
      </div>

      <div className="flex justify-center">
        <Button onClick={startVideo} disabled={!isModelLoaded || isLoading} className="w-full max-w-xs">
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Cargando...
            </>
          ) : (
            "Iniciar Cámara"
          )}
        </Button>
      </div>

      {recognizedNames.length > 0 && (
        <Alert className="bg-green-500/15 text-green-500 border-green-500/50">
          <AlertDescription>
            ✅ Rostros reconocidos:
            <ul className="ml-4 list-disc">
              {recognizedNames.map((name, i) => (
                <li key={i}>{name}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {unrecognizedCount > 0 && (
        <Alert className="bg-yellow-200/20 text-yellow-700 border-yellow-400/40">
          <AlertDescription>
            ⚠️ No se reconocieron a {unrecognizedCount} {unrecognizedCount === 1 ? "persona" : "personas"}.
          </AlertDescription>
        </Alert>
      )}

      {pendingSaves.length > 0 && (
        <Button onClick={handleManualSave} className="w-full max-w-xs bg-blue-600 text-white">
          Guardar datos ({pendingSaves.length})
        </Button>
      )}
    </div>
  );
}
