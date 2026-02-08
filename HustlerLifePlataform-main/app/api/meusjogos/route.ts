import { NextResponse } from "next/server";
import { createConnection } from "@/lib/db";
import { RowDataPacket } from "mysql2/promise";

const GAMES: Record<number, { name: string; img: string }> = {
  1: { name: "Hustler Life Sindicato", img: "/img/jogo1.jpg" },
  2: { name: "Pix e Boxing", img: "/img/jogo2.jpg" },
  3: { name: "Web Z", img: "/img/jogo3.jpg" },
};

interface Compra extends RowDataPacket {
  game_id: number;
}

export async function GET() {
  try {
    // ⚠️ userId mockado, depois usar autenticação real
    const userId = 1;

    const conn = await createConnection();
    const [rows] = await conn.execute<Compra[]>( 
      `SELECT game_id FROM compras WHERE user_id = ? AND status = 'paid' ORDER BY paid_at DESC`,
      [userId]
    );

    const jogos = rows
      .map((row) => {
        const game = GAMES[row.game_id];
        if (!game) return null;
        return {
          id: row.game_id,
          name: game.name,
          img: game.img,
        };
      })
      .filter(Boolean);

    return NextResponse.json(jogos);
  } catch (err) {
    console.error("Erro ao buscar jogos:", err);
    return NextResponse.json({ error: "Erro ao buscar jogos" }, { status: 500 });
  }
}
