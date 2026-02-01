import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";

const db = await mysql.createPool({
  host: "localhost",
  user: "root",
  password: "",
  database: "test",
});

export async function POST(req: Request) {
  const { username, password } = await req.json();

  if (!username || !password) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const [rows]: any = await db.query("SELECT * FROM users WHERE username = ?", [username]);
  const user = rows[0];

  if (!user) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });

  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) return NextResponse.json({ error: "Senha incorreta" }, { status: 401 });

  return NextResponse.json({
    message: "Login realizado com sucesso",
    userID: user.id,           // ← userID permanente
    username: user.username,
    balance: user.balance,
  });
}
