import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";

export const runtime = "nodejs";

const db = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASS || "",
  database: process.env.DB_NAME || "test", // mantém test
  port: Number(process.env.DB_PORT ?? 3306),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: "utf8mb4",
});

const WALLET_SCHEMA = "pixeboxing"; // ✅ sua carteira está aqui

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export async function POST(req: Request) {
  let conn: mysql.PoolConnection | null = null;

  try {
    const contentType = req.headers.get("content-type") || "";

    let username = "";
    let email = "";
    let password = "";

    if (contentType.includes("application/json")) {
      const body = await req.json().catch(() => null);
      username = String(body?.username ?? "").trim();
      email = String(body?.email ?? "").trim().toLowerCase();
      password = String(body?.password ?? "").trim();
    } else {
      const form = await req.formData().catch(() => null);
      username = String(form?.get("username") ?? "").trim();
      email = String(form?.get("email") ?? "").trim().toLowerCase();
      password = String(form?.get("password") ?? "").trim();
    }

    if (!username || !email || !password) {
      return NextResponse.json(
        { error: "Dados inválidos", missing: { username: !username, email: !email, password: !password } },
        { status: 400 }
      );
    }

    if (!isEmail(email)) {
      return NextResponse.json({ error: "Email inválido" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Senha muito curta (mín. 6)" }, { status: 400 });
    }

    conn = await db.getConnection();
    await conn.beginTransaction();

    // ✅ duplicidade no banco test.users
    const [exists]: any = await conn.query(
      "SELECT id FROM users WHERE email = ? OR username = ? LIMIT 1",
      [email, username]
    );

    if (exists?.length) {
      await conn.rollback();
      return NextResponse.json({ error: "Usuário ou email já existe" }, { status: 409 });
    }

    const saltRounds = Number(process.env.PASSWORD_SALT_ROUNDS ?? 10);
    const hash = await bcrypt.hash(password, saltRounds);

    // ✅ cria usuário em test.users
    const [result]: any = await conn.query(
      "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
      [username, email, hash]
    );

    const userID = result.insertId;

    // ✅ garante carteira em pixeboxing.wallets
    await conn.query(
      `INSERT INTO ${WALLET_SCHEMA}.wallets (email, saldo)
       VALUES (?, 0)
       ON DUPLICATE KEY UPDATE email = email`,
      [email]
    );

    await conn.commit();

    // ✅ lê saldo da carteira central
    const [wRows]: any = await db.query(
      `SELECT saldo FROM ${WALLET_SCHEMA}.wallets WHERE email = ? LIMIT 1`,
      [email]
    );

    const saldo = Number(wRows?.[0]?.saldo ?? 0);

    return NextResponse.json(
      { message: "Usuário registrado com sucesso", userID, email, saldo },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("REGISTER ERROR:", err);

    try {
      if (conn) await conn.rollback();
    } catch {}

    const msg = err?.sqlMessage || err?.message || "Erro interno";

    if (err?.code === "ER_DUP_ENTRY") {
      return NextResponse.json({ error: "Usuário ou email já existe" }, { status: 409 });
    }

    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    try {
      if (conn) conn.release();
    } catch {}
  }
}
