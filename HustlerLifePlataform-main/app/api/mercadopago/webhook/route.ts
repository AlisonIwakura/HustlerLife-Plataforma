import { NextResponse } from "next/server";
import { createConnection } from "@/lib/db";

export const runtime = "nodejs";

const WALLET_SCHEMA = "pixeboxing";

export async function POST(req: Request) {
  let body: any;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  // MP costuma mandar type/topic e data.id
  const topic = body?.type || body?.topic;
  if (topic !== "payment") {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const paymentId = body?.data?.id || body?.id;
  if (!paymentId) {
    return NextResponse.json({ ok: true, ignored: true, reason: "no paymentId" });
  }

  const token = process.env.MP_ACCESS_TOKEN || process.env.MERCADO_PAGO_TOKEN || "";
  if (!token) return NextResponse.json({ ok: false, error: "token ausente" }, { status: 500 });

  // 1) consulta pagamento no MP (fonte da verdade)
  const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const payment = await mpRes.json().catch(() => ({}));
  if (!mpRes.ok) {
    console.error("MP webhook fetch error", mpRes.status, payment);
    return NextResponse.json({ ok: true, mp_error: true });
  }

  if (payment?.status !== "approved") {
    return NextResponse.json({ ok: true, status: payment?.status || "unknown" });
  }

  // 2) dados do depósito (metadata do create-payment)
  const meta = payment?.metadata || {};
  const userId = Number(meta.user_id);
  const amount = Number(meta.amount);

  // ✅ email é a chave da wallet (Opção A)
  // tenta pegar do metadata (ideal), senão do payer.email, senão busca no banco.
  let email = String(meta.email || payment?.payer?.email || "")
    .trim()
    .toLowerCase();

  if (!Number.isFinite(userId) || userId <= 0 || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ ok: false, error: "metadata inválida" }, { status: 400 });
  }

  const conn = await createConnection();

  try {
    await conn.beginTransaction();

    // ✅ trava o depósito pra não creditar 2x
    const [depRows]: any = await conn.execute(
      "SELECT id, status, email FROM depositos WHERE payment_id = ? LIMIT 1 FOR UPDATE",
      [String(paymentId)]
    );

    // Se ainda não existe depósito, cria agora (melhor é criar no /api/deposit)
    if (!depRows?.length) {
      await conn.execute(
        `INSERT INTO depositos (user_id, email, amount, status, payment_id, created_at)
         VALUES (?, ?, ?, 'pending', ?, NOW())`,
        [userId, email || null, amount, String(paymentId)]
      );
    } else {
      // já pago? então não faz nada (idempotente)
      if (depRows[0].status === "paid") {
        await conn.commit();
        return NextResponse.json({ ok: true, already_paid: true });
      }

      // se email não veio agora, tenta usar o salvo no depósito
      if (!email && depRows[0].email) email = String(depRows[0].email).toLowerCase();
    }

    // ✅ se ainda não tem email, busca do users
    if (!email) {
      const [uRows]: any = await conn.execute(
        "SELECT email FROM users WHERE id = ? LIMIT 1",
        [userId]
      );
      email = String(uRows?.[0]?.email || "").trim().toLowerCase();
    }

    if (!email) {
      // sem email não tem como creditar wallet por chave
      await conn.rollback();
      return NextResponse.json({ ok: false, error: "não foi possível obter email do usuário" }, { status: 400 });
    }

    // ✅ garante carteira em pixeboxing.wallets
    await conn.execute(
      `INSERT INTO ${WALLET_SCHEMA}.wallets (email, saldo)
       VALUES (?, 0)
       ON DUPLICATE KEY UPDATE email = email`,
      [email]
    );

    // ✅ credita na wallet central (UPSERT soma)
    await conn.execute(
      `UPDATE ${WALLET_SCHEMA}.wallets
       SET saldo = saldo + ?
       WHERE email = ?
       LIMIT 1`,
      [amount, email]
    );

    // ✅ marca depósito como pago
    await conn.execute(
      "UPDATE depositos SET status = 'paid', paid_at = NOW(), email = COALESCE(email, ?) WHERE payment_id = ?",
      [email, String(paymentId)]
    );

    await conn.commit();
    return NextResponse.json({ ok: true, credited_wallet: true });
  } catch (e) {
    try {
      await conn.rollback();
    } catch {}
    console.error("WEBHOOK DB ERROR", e);
    return NextResponse.json({ ok: false, error: "db error" }, { status: 500 });
  } finally {
    try {
      await conn.end();
    } catch {}
  }
}
