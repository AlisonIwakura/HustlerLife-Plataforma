import { NextResponse } from "next/server";
import { createConnection } from "@/lib/db";

export const runtime = "nodejs";

// Se você tiver uma tabela "games", use ela.
// Se não tiver, pode usar um MAP fixo (fallback) aqui:
const GAME_PRICE_MAP: Record<number, number> = {
  1: 19.9,  // O Fazendeiro Maldito
  3: 9.9,   // O alpinista
  4: 14.9,  // Web Z
  // 2 (Pix e Boxing) é "play", então nem deveria comprar por pix
};

export async function POST(req: Request) {
  let conn: any;

  try {
    const token = process.env.MP_ACCESS_TOKEN || process.env.MERCADO_PAGO_TOKEN || "";
    if (!token) {
      return NextResponse.json(
        {
          error: "Token do Mercado Pago ausente",
          hint: "Defina MP_ACCESS_TOKEN ou MERCADO_PAGO_TOKEN no .env.local e reinicie o servidor.",
        },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => null);
    const userId = Number(body?.userId);
    const gameId = Number(body?.gameId);

    if (!Number.isFinite(userId) || userId <= 0) {
      return NextResponse.json({ error: "Dados inválidos", field: "userId" }, { status: 400 });
    }
    if (!Number.isFinite(gameId) || gameId <= 0) {
      return NextResponse.json({ error: "Dados inválidos", field: "gameId" }, { status: 400 });
    }

    conn = await createConnection();

    // ✅ pega email real do usuário (fallback sempre válido)
    let payerEmail = `user${userId}@seudominio.com`;
    try {
      const [rows]: any = await conn.execute("SELECT email FROM users WHERE id = ? LIMIT 1", [userId]);
      if (rows?.[0]?.email) payerEmail = String(rows[0].email);
    } catch {
      // mantém fallback
    }

    // ✅ pega o preço REAL do jogo no servidor
    // 1) Tente tabela `games` (recomendado)
    // 2) Se não existir, usa o MAP fixo
    let price: number | null = null;

    try {
      const [grows]: any = await conn.execute(
        "SELECT price FROM games WHERE id = ? LIMIT 1",
        [gameId]
      );
      if (grows?.[0]?.price != null) price = Number(grows[0].price);
    } catch {
      // se não tiver tabela games, cai no map
    }

    if (price == null) {
      price = GAME_PRICE_MAP[gameId] ?? null;
    }

    if (!Number.isFinite(price as number) || (price as number) <= 0) {
      return NextResponse.json(
        { error: "Jogo inválido ou sem preço configurado", field: "price", gameId },
        { status: 400 }
      );
    }

    const amount = Number((price as number).toFixed(2));

    // ✅ idempotência (não cria 2 cobranças se clicar 2x)
    // melhor que Date.now(): usar UUID
    const idemKey = `buy-${userId}-${gameId}-${crypto.randomUUID()}`;

    const mpRes = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": idemKey,
      },
      body: JSON.stringify({
        transaction_amount: amount,
        description: `Compra do jogo #${gameId} - R$ ${amount.toFixed(2)}`,
        payment_method_id: "pix",
        payer: { email: payerEmail },
        metadata: { type: "game_purchase", user_id: userId, game_id: gameId, amount },
        // ✅ se você tiver webhook:
        // notification_url: process.env.MP_WEBHOOK_URL,
      }),
      cache: "no-store",
    });

    const payment = await mpRes.json().catch(() => ({}));

    if (!mpRes.ok) {
      console.error("MP PIX ERROR (BUY):", {
        status: mpRes.status,
        body: payment,
        payload: { amount, payerEmail, userId, gameId },
      });

      return NextResponse.json(
        { error: "Erro ao gerar PIX da compra", mp_status: mpRes.status, detail: payment },
        { status: 500 }
      );
    }

    const td = payment?.point_of_interaction?.transaction_data;
    const qr_code = td?.qr_code;
    const qr_code_base64 = td?.qr_code_base64;

    if (!qr_code || !qr_code_base64) {
      console.error("MP PIX NO QR (BUY):", payment);
      return NextResponse.json(
        {
          error: "Pagamento criado, mas QR não retornou",
          paymentId: String(payment?.id ?? ""),
          detail: payment,
        },
        { status: 500 }
      );
    }

    // ✅ salva compra pendente (se existir a tabela)
    // sugestão de tabela: compras(user_id, game_id, amount, status, payment_id, created_at)
    try {
      await conn.execute(
        `INSERT INTO compras (user_id, game_id, amount, status, payment_id, created_at)
         VALUES (?, ?, ?, 'pending', ?, NOW())`,
        [userId, gameId, amount, String(payment?.id ?? "")]
      );
    } catch {
      // se não existir a tabela, ignora
    }

    return NextResponse.json({
      ok: true,
      paymentId: String(payment?.id ?? ""),
      amount,
      qr_code,
      qr_code_base64,
      gameId,
    });
  } catch (err: any) {
    console.error("BUY ERROR:", err);
    return NextResponse.json({ error: err?.message || "Erro interno" }, { status: 500 });
  } finally {
    try {
      if (conn) await conn.end();
    } catch {}
  }
}
