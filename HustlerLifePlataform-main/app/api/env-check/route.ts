import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    MP_ACCESS_TOKEN: Boolean(process.env.MP_ACCESS_TOKEN),
    MERCADO_PAGO_TOKEN: Boolean(process.env.MERCADO_PAGO_TOKEN),
    NODE_ENV: process.env.NODE_ENV,
  });
}
