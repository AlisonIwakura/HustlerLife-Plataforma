import { NextResponse } from "next/server";
import { createConnection } from "../../../../lib/db"; // mantenho seu caminho antigo
// Se quiser padronizar depois: import { createConnection } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: any = null;

  try {
    body = await req.json();
  } catch {
    // Mercado Pago pode bater com payload inesperado/sem JSON válido
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  // ✅ Mercado Pago manda vários tipos
  const topic = body?.type || body?.topic;

  // aceitamos payment também via topic
  const isPaymentEvent = topic === "payment" || topic === "payment.updated";

  if (!isPaymentEvent) {
    // ✅ sempre 200 pra não ficar re-tentando
    return NextResponse.json({ ok: true, ignored: true });
  }

  // ✅ id pode vir em vários lugares
  const paymentId =
    body?.data?.id ||
    body?.id ||
    body?.resource?.split?.("/").pop?.() ||
    null;

  if (!paymentId) {
    return NextResponse.json({ ok: true, ignored: true, reason: "Sem paymentId" });
  }

  // ✅ Token compatível com os dois nomes
  const token = process.env.MP_ACCESS_TOKEN || process.env.MERCADO_PAGO_TOKEN || "";

  if (!token) {
    return NextResponse.json(
      { ok: false, error: "Token do Mercado Pago ausente" },
      { status: 500 }
    );
  }

  // consulta pagamento no MP
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  const payment = await res.json().catch(() => ({}));

  if (!res.ok) {
    // ✅ responde 200 mesmo assim (webhook), mas loga pra você ver
    console.error("MP fetch payment error:", res.status, payment);
    return NextResponse.json({ ok: true, mp_error: true });
  }

  if (payment?.status !== "approved") {
    // ainda não aprovado -> ok
    return NextResponse.json({ ok: true, status: payment?.status || "unknown" });
  }

  const gameId = payment?.metadata?.game_id;
  const userId = payment?.metadata?.user_id;

  if (!gameId || !userId) {
    return NextResponse.json({ ok: false, error: "Metadata inválida" }, { status: 400 });
  }

  const conn = await createConnection();
  try {
    await conn.execute(
      `UPDATE compras
       SET status = 'paid', paid_at = NOW()
       WHERE user_id = ? AND game_id = ? AND status = 'pending'`,
      [userId, gameId]
    );
  } finally {
    try { await conn.end(); } catch {}
  }

  return NextResponse.json({ ok: true, paid: true });
}
