"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");

    if (!token) {
      router.replace("/login");
      return;
    }

    if (role === "docente") {
      router.replace("/dashboard-docente");
    } else if (role === "estudiante") router.replace("/dashboard-estudiante"); 
    else {
      router.replace("/login");
    }
  }, [router]);

  return null; // Evita parpadeo
}
