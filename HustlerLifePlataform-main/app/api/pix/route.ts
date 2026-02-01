import { NextResponse } from "next/server";
import crypto from "crypto";
import { createConnection } from "@/lib/db"; // usar a função existente

const GAMES: Record<number, { name: string; price: number }> = {
  1: { name: "Hustler Life Sindicato", price: 5.0 },
  2: { name: "Pix e Boxing", price: 5.0 },
  3: { name: "Web Z", price: 5.0 },
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const gameId = Number(body.gameId);
    const userId = Number(body.userId);

    if (!gameId || !userId) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    const game = GAMES[gameId];
    if (!game) {
      return NextResponse.json({ error: "Jogo não encontrado" }, { status: 404 });
    }

    const idempotencyKey = crypto.randomUUID();

    // Criação do pagamento PIX via Mercado Pago
    const mpRes = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.MERCADO_PAGO_TOKEN}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        transaction_amount: game.price,
        description: `Liberação do jogo: ${game.name}`,
        payment_method_id: "pix",
        payer: { email: "cliente@email.com" }, // futuramente usar email real
        metadata: { game_id: gameId, user_id: userId },
      }),
    });

    const payment = await mpRes.json();

    if (!mpRes.ok) {
      console.error("Erro Mercado Pago:", payment);
      return NextResponse.json({ error: "Erro ao gerar PIX", detail: payment }, { status: 500 });
    }

    // ✅ Salva a compra no banco usando createConnection diretamente
    const conn = await createConnection();
    await conn.execute(
      `INSERT INTO compras (user_id, game_id, status, created_at)
       VALUES (?, ?, 'pending', NOW())`,
      [userId, gameId]
    );

    return NextResponse.json(payment);
  } catch (error) {
    console.error("Erro interno:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
