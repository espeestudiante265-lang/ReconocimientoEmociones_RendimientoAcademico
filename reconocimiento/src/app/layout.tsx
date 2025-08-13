"use client";

import "./globals.css";
import { Inter } from "next/font/google";
import Navbar from "@/components/Navbar";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [lastActivity, setLastActivity] = useState<Date | null>(null);

  const publicRoutes = ["/login", "/register"];

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token && !publicRoutes.includes(pathname)) {
      router.replace("/login");
    } else {
      setLoading(false);
    }

    // Inactividad: 10 minutos
    const handleInactivity = () => {
      const now = new Date();
      if (lastActivity && now.getTime() - lastActivity.getTime() > 10 * 60 * 1000) {
        localStorage.removeItem("token");
        localStorage.removeItem("role");
        router.replace("/login");
      }
    };

    const inactivityInterval = setInterval(handleInactivity, 5000);
    return () => clearInterval(inactivityInterval);
  }, [pathname, lastActivity, router]);

  useEffect(() => {
    const resetActivity = () => setLastActivity(new Date());
    window.addEventListener("click", resetActivity);
    window.addEventListener("mousemove", resetActivity);
    window.addEventListener("keydown", resetActivity);
    return () => {
      window.removeEventListener("click", resetActivity);
      window.removeEventListener("mousemove", resetActivity);
      window.removeEventListener("keydown", resetActivity);
    };
  }, []);

  if (loading) {
    return (
      <html lang="en">
        <body className={inter.className}>
          <div className="flex justify-center items-center min-h-screen">
            <span className="text-gray-500 text-xl">Cargando...</span>
          </div>
        </body>
      </html>
    );
  }

  const hideNavbar = pathname === "/login" || pathname === "/register";

  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="bg-background">
          {!hideNavbar && <Navbar />}
          <main className="container mx-auto">{children}</main>
        </div>
      </body>
    </html>
  );
}
