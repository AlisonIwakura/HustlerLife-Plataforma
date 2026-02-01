"use client";
import { useState } from "react";
import Link from "next/link";

export default function Sidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="md:hidden fixed top-4 left-4 z-50 bg-zinc-800 text-white px-3 py-2 rounded-lg"
      >
        ☰
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm md:hidden z-40"
        />
      )}

      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-zinc-900 text-white p-6 transform transition-transform duration-300
        ${open ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
      >
        <h1 className="text-xl font-bold mb-6">Hustler Life</h1>

        <nav className="flex flex-col gap-4">
          <Link href="/">🎮 Jogos</Link>
          <Link href="/market">🛒 Mercado</Link>
          <Link href="/chat"> 💬 Chat</Link>
          <Link href="/perfil">🎮 Minha biblioteca</Link>
          <Link href="/perfil">👤 Perfil</Link>
        </nav>

        <button
          onClick={() => setOpen(false)}
          className="md:hidden absolute top-4 right-4 text-white"
        >
          ✖
        </button>
      </aside>
    </>
  );
}
