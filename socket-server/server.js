import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);

// ✅ Porta separada do Next (Next = 3000, Socket = 3001)
const PORT = Number(process.env.PORT || 3001);

// ✅ CORS (ajuste se quiser travar por domínio)
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: false,
  },
});

// ====== ESTADO DO LOBBY ======
const players = {}; // socketId -> PlayerState

// (opcional) health check
app.get("/", (req, res) => res.send("OK"));

// (opcional) listar players
app.get("/players", (req, res) => res.json(Object.values(players)));

io.on("connection", (socket) => {
  console.log("🟢 Conectado:", socket.id);

  // ✅ manda o id pro cliente (ajuda no Unity)
  socket.emit("socket_id", socket.id);

  // ================== ENTRAR NO LOBBY ==================
  socket.on("entrar_lobby", (data) => {
    try {
      // aceita objeto ou JSON string
      let d = data;
      if (typeof data === "string") {
        try {
          d = JSON.parse(data);
        } catch {
          console.warn("⚠️ entrar_lobby inválido (JSON string):", data);
          return;
        }
      }

      if (!d || typeof d !== "object") {
        console.warn("⚠️ entrar_lobby inválido (data):", d);
        return;
      }

      players[socket.id] = {
        socketId: socket.id,
        personagem: d.personagem ?? "MykeTyroson",
        raridade: d.raridade ?? "Comum",
        forca: Number(d.forca ?? 10),
        velocidade: Number(d.velocidade ?? 10),
        stamina: Number(d.stamina ?? 100),
        x: Number(d.x ?? 0),
        y: Number(d.y ?? 0),
        flip: Boolean(d.flip ?? false),
        lastSeen: Date.now(),
      };

      console.log("👤 Player entrou:", players[socket.id]);

      // ✅ Envia TODOS (inclusive ele) com estado completo
      socket.emit("lobby_players", Object.values(players));

      // ✅ Avisa os outros
      socket.broadcast.emit("novo_player", players[socket.id]);
    } catch (e) {
      console.error("❌ Erro em entrar_lobby:", e);
    }
  });

  // ================== MOVIMENTO ==================
  socket.on("move", (data) => {
    const p = players[socket.id];
    if (!p) return;

    let d = data;
    if (typeof data === "string") {
      try {
        d = JSON.parse(data);
      } catch {
        return;
      }
    }
    if (!d || typeof d !== "object") return;

    p.x = Number(d.x ?? p.x);
    p.y = Number(d.y ?? p.y);
    p.flip = Boolean(d.flip ?? p.flip);
    p.lastSeen = Date.now();

    // manda pros outros
    socket.broadcast.emit("player_move", {
      socketId: socket.id,
      x: p.x,
      y: p.y,
      flip: p.flip,
    });
  });

  // ================== CHAT ==================
  socket.on("chat", (msg) => {
    const p = players[socket.id];

    let text = "";
    if (typeof msg === "string") text = msg;
    else if (msg && typeof msg === "object") text = msg.text ?? "";
    text = String(text).trim();

    if (!text) return;
    if (text.length > 80) text = text.substring(0, 80);

    const payload = {
      socketId: socket.id,
      text,
      ts: Date.now(),
      personagem: p?.personagem ?? "Unknown",
      raridade: p?.raridade ?? "Comum",
    };

    console.log("💬 CHAT:", socket.id, "->", text);

    // reenvia para TODOS
    io.emit("chat", payload);
  });

  // ================== SAIR ==================
  socket.on("disconnect", (reason) => {
    if (!players[socket.id]) {
      console.log("🔴 Desconectado (sem registro):", socket.id, reason);
      return;
    }

    console.log("🔴 Player saiu:", socket.id, reason);
    socket.broadcast.emit("player_saiu", socket.id);
    delete players[socket.id];
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Socket.IO rodando na porta ${PORT}`);
});
