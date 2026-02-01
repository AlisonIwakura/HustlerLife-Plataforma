"use client";
import Link from "next/link";
import { useUser } from "../hooks/useUser"; // ajuste o caminho conforme sua pasta

export default function Header() {
  const { user, setUser } = useUser();

  function handleLogout() {
    localStorage.removeItem("userID");
    localStorage.removeItem("username");
    localStorage.removeItem("balance");
    setUser(null);
  }

  return (
    <header className="w-full flex justify-between items-center px-6 py-4 bg-white dark:bg-zinc-800 shadow-md fixed top-0 left-0 md:pl-72 z-30">
      <h2 className="hidden md:block font-bold text-lg text-zinc-900 dark:text-white">
        Hustler Life Entretenimento
      </h2>

      <div className="ml-auto flex items-center gap-4">
        {user && (
          <div className="text-right hidden sm:flex flex-col mr-4">
            <p className="font-semibold text-zinc-900 dark:text-white">
              {user.username}
            </p>
            <p className="text-green-600 dark:text-green-400 text-sm">
              💰 R$ {user.balance}
            </p>
          </div>
        )}

        {user ? (
          <button
            onClick={handleLogout}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-full transition shadow-md"
          >
            Logout
          </button>
        ) : (
          <Link
            href="/login"
            className="bg-black hover:bg-zinc-900 text-white px-4 py-2 rounded-full transition shadow-md"
          >
            💰 Login
          </Link>
        )}
      </div>
    </header>
  );
}
