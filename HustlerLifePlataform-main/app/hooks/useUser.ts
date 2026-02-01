"use client";
import { useState, useEffect } from "react";

export function useUser() {
  const [user, setUser] = useState<{
    userID: string;
    username: string;
    balance: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userID = localStorage.getItem("userID");
    const username = localStorage.getItem("username");
    const balance = localStorage.getItem("balance");

    if (userID && username && balance) {
      setUser({ userID, username, balance });
    }

    setLoading(false);
  }, []);

  return { user, setUser, loading };
}
