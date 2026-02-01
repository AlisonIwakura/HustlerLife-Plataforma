"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState(""); // ✅ NOVO
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    const u = username.trim();
    const em = email.trim().toLowerCase();
    const p = password.trim();
    const p2 = password2.trim();

    if (u.length < 3) {
      setMessage("O usuário deve ter pelo menos 3 caracteres.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      setMessage("Digite um email válido.");
      return;
    }

    if (p.length < 6) {
      setMessage("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (p !== p2) {
      setMessage("As senhas não coincidem.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u, email: em, password: p }), // ✅ agora manda email
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMessage(data?.error || "Erro ao cadastrar.");
        return;
      }

      // ✅ sua API atual retorna: { message, userID }
      if (data?.userID) {
        localStorage.setItem("userID", String(data.userID));
      }

      // (opcional) salvar username no client para UX (não é segurança)
      localStorage.setItem("username", u);

      router.push("/");
    } catch {
      setMessage("Erro interno. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-900 px-4">
      <div className="w-full max-w-md bg-white dark:bg-zinc-800 rounded-3xl shadow-2xl p-8">
        <h1 className="text-3xl font-extrabold mb-6 text-center text-zinc-900 dark:text-white">
          Criar conta
        </h1>

        <form onSubmit={handleRegister} className="flex flex-col gap-5">
          <input
            type="text"
            placeholder="Usuário"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="p-4 border border-zinc-300 dark:border-zinc-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white transition"
            required
            minLength={3}
            autoComplete="username"
          />

          {/* ✅ NOVO: Email */}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="p-4 border border-zinc-300 dark:border-zinc-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white transition"
            required
            autoComplete="email"
          />

          <input
            type="password"
            placeholder="Senha (mín. 6 caracteres)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="p-4 border border-zinc-300 dark:border-zinc-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white transition"
            required
            minLength={6}
            autoComplete="new-password"
          />

          <input
            type="password"
            placeholder="Confirmar senha"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            className="p-4 border border-zinc-300 dark:border-zinc-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white transition"
            required
            minLength={6}
            autoComplete="new-password"
          />

          <button
            type="submit"
            disabled={loading}
            className="p-4 bg-black hover:bg-zinc-900 text-white font-bold rounded-2xl shadow-md transition disabled:opacity-50"
          >
            {loading ? "Criando..." : "Cadastrar"}
          </button>
        </form>

        {message && (
          <p className="mt-4 text-center text-red-500 font-medium">{message}</p>
        )}

        <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
          Já tem conta?{" "}
          <Link href="/login" className="text-blue-500 font-semibold hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
