"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Menu, X, UserCheck, Activity, BarChart3, LogOut } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { useRouter } from "next/navigation";

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const storedRole = typeof window !== "undefined" ? localStorage.getItem("role") : null;
    setRole(storedRole);
  }, []);

  const homeHref =
    role === "docente" ? "/dashboard-docente" :
    role === "estudiante" ? "/dashboard-estudiante" :
    "/login";

  const NavLinks = () => {
    const links =
      role === "docente"
        ? [
            { href: "/create-class", icon: BarChart3, label: "Crear Clase" },
            { href: "/student-risk", icon: Activity, label: "Rendimiento de estudiantes" },
          ]
        : [

          ];

    return (
      <>
        {links.map((link) => (
          <Button
            key={link.href}
            variant="ghost"
            asChild
            className="w-full justify-start"
            onClick={() => setIsMenuOpen(false)}
          >
            <Link href={link.href} className="flex items-center gap-2">
              <link.icon size={16} />
              {link.label}
            </Link>
          </Button>
        ))}
      </>
    );
  };

  const handleLogout = async () => {
    const ok = window.confirm("¿Seguro que deseas cerrar sesión?");
    if (!ok) return;

    try {
      localStorage.removeItem("token");
      localStorage.removeItem("role");
      localStorage.removeItem("username");
      setRole(null);
      setIsMenuOpen(false);
      router.replace("/login");
      setTimeout(() => {
        if (window.location.pathname !== "/login") window.location.href = "/login";
      }, 50);
    } catch {
      window.location.href = "/login";
    }
  };

  return (
    <nav className="border-b bg-background">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link href={homeHref} className="text-xl font-bold">
            HOME
          </Link>

          {/* Desktop */}
          <div className="hidden md:flex space-x-4">
            <NavLinks />
            <Button variant="ghost" onClick={handleLogout} className="flex items-center gap-2">
              <LogOut size={16} />
              Cerrar sesión
            </Button>
          </div>

          {/* Mobile */}
          <div className="md:hidden">
            <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => setIsMenuOpen(true)}>
                  {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-64">
                <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                <div className="flex flex-col gap-4 mt-8">
                  <NavLinks />
                  <Button variant="ghost" onClick={handleLogout} className="flex items-center gap-2 mt-4">
                    <LogOut size={16} />
                    Cerrar sesión
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
