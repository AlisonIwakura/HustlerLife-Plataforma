"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.error);
        setLoading(false);
        return;
      }

      localStorage.setItem("userID", data.userID);
      localStorage.setItem("username", data.username);
      localStorage.setItem("balance", data.balance);

      router.push("/"); 
    } catch (err: any) {
      setMessage("Erro interno. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-900 px-4">
      <div className="w-full max-w-md bg-white dark:bg-zinc-800 rounded-3xl shadow-2xl p-8">
        <h1 className="text-3xl font-extrabold mb-6 text-center text-zinc-900 dark:text-white">
          Entrar
        </h1>

        <form onSubmit={handleLogin} className="flex flex-col gap-5">
          <input
            type="text"
            placeholder="Usuário"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="p-4 border border-zinc-300 dark:border-zinc-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white transition"
            required
          />
          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="p-4 border border-zinc-300 dark:border-zinc-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white transition"
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="p-4 bg-black hover:bg-zinc-900 text-white font-bold rounded-2xl shadow-md transition disabled:opacity-50"
          >
            {loading ? "Entrando..." : "Login"}
          </button>
        </form>

        {message && (
          <p className="mt-4 text-center text-red-500 font-medium">{message}</p>
        )}

        <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
          Não tem uma conta?{" "}
          <Link
            href="/register"
            className="text-blue-500 font-semibold hover:underline"
          >
            Cadastre-se
          </Link>
        </p>
      </div>
    </div>
  );
}
