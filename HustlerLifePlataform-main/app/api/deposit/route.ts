import { NextResponse } from "next/server";
import { createConnection } from "@/lib/db";

export const runtime = "nodejs";

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
    const amountRaw = Number(body?.amount);

    if (!Number.isFinite(userId) || userId <= 0) {
      return NextResponse.json({ error: "Dados inválidos", field: "userId" }, { status: 400 });
    }

    // ✅ Mercado Pago espera número > 0, normalmente com 2 casas
    const amount = Number(amountRaw.toFixed(2));
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Dados inválidos", field: "amount" }, { status: 400 });
    }

    // ✅ buscar email real do usuário (se existir)
    // melhor fallback (sempre válido)
    let payerEmail = `user${userId}@seudominio.com`;

    conn = await createConnection();

    try {
      const [rows]: any = await conn.execute(
        "SELECT email FROM users WHERE id = ? LIMIT 1",
        [userId]
      );
      if (rows?.[0]?.email) payerEmail = String(rows[0].email);
    } catch {
      // mantém fallback
    }

    // ✅ idempotência para não criar 2 cobranças se clicar 2x
    const idemKey = `deposit-${userId}-${Date.now()}`;

    const mpRes = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": idemKey,
      },
      body: JSON.stringify({
        transaction_amount: amount,
        description: `Depósito de saldo: R$ ${amount.toFixed(2)}`,
        payment_method_id: "pix",
        payer: { email: payerEmail },
        metadata: { type: "deposit", user_id: userId, amount },
      }),
      cache: "no-store",
    });

    const payment = await mpRes.json().catch(() => ({}));

    if (!mpRes.ok) {
      // ✅ loga no terminal (não vaza token)
      console.error("MP PIX ERROR:", {
        status: mpRes.status,
        body: payment,
        payload: { amount, payerEmail, userId },
      });

      return NextResponse.json(
        {
          error: "Erro ao gerar PIX",
          mp_status: mpRes.status,
          detail: payment,
        },
        { status: 500 }
      );
    }

    const td = payment?.point_of_interaction?.transaction_data;
    const qr_code = td?.qr_code;
    const qr_code_base64 = td?.qr_code_base64;

    if (!qr_code || !qr_code_base64) {
      console.error("MP PIX NO QR:", payment);
      return NextResponse.json(
        {
          error: "Pagamento criado, mas QR não retornou",
          paymentId: String(payment?.id ?? ""),
          detail: payment,
        },
        { status: 500 }
      );
    }

    // opcional: salvar depósito pendente
    try {
      await conn.execute(
        `INSERT INTO depositos (user_id, amount, status, payment_id, created_at)
         VALUES (?, ?, 'pending', ?, NOW())`,
        [userId, amount, String(payment?.id ?? "")]
      );
    } catch (e) {
      // se não existir a tabela, ignora
    }

    return NextResponse.json({
      ok: true,
      paymentId: String(payment?.id ?? ""),
      amount,
      qr_code,
      qr_code_base64,
    });
  } catch (err: any) {
    console.error("DEPOSIT ERROR:", err);
    return NextResponse.json({ error: err?.message || "Erro interno" }, { status: 500 });
  } finally {
    try {
      if (conn) await conn.end();
    } catch {}
  }
}
