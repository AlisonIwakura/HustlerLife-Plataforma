import { NextResponse } from "next/server";
import { createConnection } from "../../../lib/db"; // ✅ ajuste se sua rota estiver mais funda

const GAMES: Record<number, { name: string; price: number }> = {
  1: { name: "Hustler Life Sindicato", price: 19.9 },
  2: { name: "Pix e Boxing", price: 29.9 },
  3: { name: "Web Z", price: 9.9 },
};

export async function POST(req: Request) {
  let conn: any;

  try {
    const token = process.env.MERCADO_PAGO_TOKEN;
    if (!token) {
      return NextResponse.json({ error: "MERCADO_PAGO_TOKEN ausente" }, { status: 500 });
    }

    const body = await req.json().catch(() => null);
    const gameId = Number(body?.gameId);
    const userId = Number(body?.userId);

    if (!gameId || !userId) {
      return NextResponse.json(
        { error: "Dados inválidos", missing: { gameId: !gameId, userId: !userId } },
        { status: 400 }
      );
    }

    const game = GAMES[gameId];
    if (!game) {
      return NextResponse.json({ error: "Jogo não encontrado" }, { status: 404 });
    }

    // ✅ (recomendado) buscar email real do user no banco para o payer
    // Se não tiver users.email, pode manter um placeholder por enquanto.
    let payerEmail = "cliente@email.com";
    conn = await createConnection();

    try {
      const [rows]: any = await conn.execute(
        "SELECT email FROM users WHERE id = ? LIMIT 1",
        [userId]
      );
      if (rows?.[0]?.email) payerEmail = String(rows[0].email);
    } catch {
      // se falhar, segue com placeholder
    }

    // ✅ cria registro pending ANTES do pagamento (idempotência básica)
    // cria uma compra pendente se ainda não existir uma pendente para esse user/jogo
    await conn.execute(
      `INSERT INTO compras (user_id, game_id, status, created_at)
       SELECT ?, ?, 'pending', NOW()
       WHERE NOT EXISTS (
         SELECT 1 FROM compras
         WHERE user_id = ? AND game_id = ? AND status = 'pending'
       )`,
      [userId, gameId, userId, gameId]
    );

    // ✅ Criação do pagamento PIX via Mercado Pago
    const mpRes = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transaction_amount: Number(game.price),
        description: `Liberação do jogo: ${game.name}`,
        payment_method_id: "pix",
        payer: { email: payerEmail },
        metadata: { game_id: gameId, user_id: userId },
      }),
      cache: "no-store",
    });

    const payment = await mpRes.json().catch(() => ({}));

    if (!mpRes.ok) {
      console.error("Erro Mercado Pago:", payment);

      // Se falhou, marca a pending como failed (opcional mas recomendado)
      try {
        await conn.execute(
          `UPDATE compras
           SET status = 'failed'
           WHERE user_id = ? AND game_id = ? AND status = 'pending'`,
          [userId, gameId]
        );
      } catch {}

      return NextResponse.json(
        { error: "Erro ao gerar PIX", detail: payment },
        { status: 500 }
      );
    }

    // ✅ salva o payment_id na compra pendente (ajuda o webhook)
    try {
      await conn.execute(
        `UPDATE compras
         SET payment_id = ?
         WHERE user_id = ? AND game_id = ? AND status = 'pending'`,
        [String(payment?.id ?? ""), userId, gameId]
      );
    } catch {}

    // ✅ retorna o payment (contém qr_code etc. dependendo da resposta)
    return NextResponse.json(payment, { status: 200 });
  } catch (err: any) {
    console.error("PAY ERROR:", err);
    return NextResponse.json(
      { error: err?.message || "Erro interno" },
      { status: 500 }
    );
  } finally {
    try {
      if (conn) await conn.end();
    } catch {}
  }
}
