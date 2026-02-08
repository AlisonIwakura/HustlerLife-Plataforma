"use client";

import { useMemo, useState } from "react";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useUser } from "./hooks/useUser";

type Jogo = {
  id: number;
  nome: string;
  img: string;
  preco?: number;
  tag?: string;
  desc?: string;
  link?: string; // ✅ para rotas internas/externas
  cta?: "play" | "buy";
};

type PixResponse = {
  ok: boolean;
  paymentId: string | number;
  qr_code: string;
  qr_code_base64: string;
  amount: number;
  gameId?: number;
};

type UiMsg = { text: string; type: "success" | "error" | "" };

function cn(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(" ");
}

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

export default function Home() {
  const router = useRouter();
  const { user, loading } = useUser();

  const [buyingId, setBuyingId] = useState<number | null>(null);

  // ====== DEPÓSITO ======
  const [depositOpen, setDepositOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState<number>(20);
  const [depositLoading, setDepositLoading] = useState(false);
  const [depositMsg, setDepositMsg] = useState<UiMsg>({ text: "", type: "" });
  const [depositData, setDepositData] = useState<PixResponse | null>(null);
  const [copied, setCopied] = useState(false);

  // ====== COMPRA (PIX POR JOGO) ======
  const [buyOpen, setBuyOpen] = useState(false);
  const [buyGame, setBuyGame] = useState<Jogo | null>(null);
  const [buyLoading, setBuyLoading] = useState(false);
  const [buyMsg, setBuyMsg] = useState<UiMsg>({ text: "", type: "" });
  const [buyData, setBuyData] = useState<PixResponse | null>(null);
  const [buyCopied, setBuyCopied] = useState(false);

  // ✅ jogos com preço (ajuste como quiser)
  const jogos: Jogo[] = useMemo(
    () => [
      {
        id: 2,
        nome: "Pix e Boxing",
        img: "/img/jogo2.png",
        tag: "Jogar agora",
        desc: "PvP / WebGL • partidas rápidas • ranking",
        link: "/pixeboxing",
        cta: "play",
        preco: 0,
      },
      {
        id: 3,
        nome: "O alpinista",
        img: "/img/alpinista.png",
        tag: "Comprar",
        desc: "PvP / WebGL • partidas rápidas • ranking",
        cta: "buy",
        preco: 3.9,
      },
      {
        id: 1,
        nome: "O Fazendeiro Maldito",
        img: "/img/jogo0.png",
        tag: "Em breve",
        desc: "Terror / sobrevivência • campanha",
        cta: "buy",
        preco: 19.9,
      },
      {
        id: 4,
        nome: "Web Z",
        img: "/img/jogo3.png",
        tag: "Em breve",
        desc: "Aventura • exploração",
        cta: "buy",
        preco: 4.9,
      },
    ],
    []
  );

  const saldoFormatado = useMemo(() => {
    const value = Number((user as any)?.balance ?? 0);
    return formatBRL(value);
  }, [user]);

  // ===== helpers =====
  function setDepositUiMsg(text: string, type: UiMsg["type"]) {
    setDepositMsg({ text, type });
  }
  function setBuyUiMsg(text: string, type: UiMsg["type"]) {
    setBuyMsg({ text, type });
  }

  function openDeposit() {
    if (!user) {
      router.push("/login");
      return;
    }
    setDepositUiMsg("", "");
    setDepositData(null);
    setDepositAmount(20);
    setCopied(false);
    setDepositOpen(true);
  }

  function closeDeposit() {
    setDepositOpen(false);
  }

  function openBuy(jogo: Jogo) {
    if (!user) {
      router.push("/login");
      return;
    }
    setBuyGame(jogo);
    setBuyUiMsg("", "");
    setBuyData(null);
    setBuyCopied(false);
    setBuyOpen(true);
  }

  function closeBuy() {
    setBuyOpen(false);
    setBuyGame(null);
  }

  // ===== CTA principal: jogar ou comprar =====
  async function comprarOuAbrir(jogo: Jogo) {
    if (buyingId !== null) return;

    const indisponivel = (jogo.tag || "").toLowerCase().includes("em breve");
    if (indisponivel) return;

    // ✅ se tem link, joga/abre
    if (jogo.link) {
      if (jogo.link.startsWith("/")) router.push(jogo.link);
      else window.open(jogo.link, "_blank", "noopener,noreferrer");
      return;
    }

    // ✅ compra: abre modal e gera pix
    if (!user) {
      router.push("/login");
      return;
    }

    try {
      setBuyingId(jogo.id);
      openBuy(jogo);
    } finally {
      setTimeout(() => setBuyingId(null), 600);
    }
  }

  // ===== DEPÓSITO =====
  async function gerarPixDeposito() {
    if (!user) {
      router.push("/login");
      return;
    }

    setDepositUiMsg("", "");
    setDepositData(null);
    setCopied(false);

    const amount = Number(depositAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setDepositUiMsg("Informe um valor válido.", "error");
      return;
    }
    if (amount < 1) {
      setDepositUiMsg("Depósito mínimo: R$ 1,00.", "error");
      return;
    }

    const userId = Number((user as any)?.userID ?? (user as any)?.id ?? 0);
    if (!userId) {
      setDepositUiMsg("Não foi possível identificar seu userID. Faça login novamente.", "error");
      return;
    }

    setDepositLoading(true);
    try {
      const res = await fetch("/api/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, amount }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setDepositUiMsg(data?.error || "Erro ao gerar PIX.", "error");
        return;
      }

      setDepositData(data as PixResponse);
      setDepositUiMsg("PIX gerado. Pague pelo QR Code ou copia e cola.", "success");
      setTimeout(() => setDepositUiMsg("", ""), 2500);
    } catch {
      setDepositUiMsg("Erro interno ao gerar PIX.", "error");
    } finally {
      setDepositLoading(false);
    }
  }

  async function copiarPixDeposito() {
    const pix = depositData?.qr_code;
    if (!pix) return;

    try {
      await navigator.clipboard.writeText(pix);
      setCopied(true);
      setDepositUiMsg("Código PIX copiado!", "success");
      setTimeout(() => {
        setCopied(false);
        setDepositUiMsg("", "");
      }, 1500);
    } catch {
      setDepositUiMsg("Não consegui copiar. Selecione e copie manualmente.", "error");
    }
  }

  // ===== COMPRA (PIX DO JOGO) =====
  async function gerarPixCompra() {
    if (!user) {
      router.push("/login");
      return;
    }
    if (!buyGame) return;

    const userId = Number((user as any)?.userID ?? (user as any)?.id ?? 0);
    if (!userId) {
      setBuyUiMsg("Não foi possível identificar seu userID. Faça login novamente.", "error");
      return;
    }

    // ✅ aqui o front só manda gameId (e userId). O backend calcula o valor real.
    setBuyLoading(true);
    setBuyUiMsg("", "");
    setBuyData(null);
    setBuyCopied(false);

    try {
      const res = await fetch("/api/pay-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, gameId: buyGame.id }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setBuyUiMsg(data?.error || "Erro ao gerar PIX da compra.", "error");
        return;
      }

      setBuyData(data as PixResponse);
      setBuyUiMsg("PIX da compra gerado. Pague pelo QR Code ou copia e cola.", "success");
    } catch {
      setBuyUiMsg("Erro interno ao gerar PIX.", "error");
    } finally {
      setBuyLoading(false);
    }
  }

  async function copiarPixCompra() {
    const pix = buyData?.qr_code;
    if (!pix) return;

    try {
      await navigator.clipboard.writeText(pix);
      setBuyCopied(true);
      setBuyUiMsg("Código PIX copiado!", "success");
      setTimeout(() => {
        setBuyCopied(false);
        setBuyUiMsg("", "");
      }, 1500);
    } catch {
      setBuyUiMsg("Não consegui copiar. Selecione e copie manualmente.", "error");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-zinc-900 flex items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-3xl border border-zinc-200/70 dark:border-white/10 bg-white/80 dark:bg-zinc-950/40 backdrop-blur px-6 py-6 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-zinc-200/70 dark:bg-white/10 animate-pulse" />
            <div className="flex-1">
              <div className="h-4 w-40 rounded bg-zinc-200/70 dark:bg-white/10 animate-pulse" />
              <div className="mt-2 h-3 w-28 rounded bg-zinc-200/70 dark:bg-white/10 animate-pulse" />
            </div>
          </div>
          <p className="mt-5 text-sm text-zinc-600 dark:text-zinc-300">
            Carregando usuário e preparando sua experiência…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-zinc-900">
      <Sidebar />

      <div className="flex-1 flex flex-col">
        <Header />

        <main className="flex-1 p-4 sm:p-6 md:ml-64 mt-16">
          {/* Topbar */}
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100">
                Hustler Life • Jogos WebGL
              </h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-1">
                Catálogo oficial — jogue agora ou finalize a compra com segurança.
              </p>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3">
              {user ? (
                <>
                  <button
                    type="button"
                    onClick={openDeposit}
                    className="rounded-2xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    Depositar via PIX
                  </button>

                  <div className="rounded-2xl border border-zinc-200/70 dark:border-white/10 bg-white/80 dark:bg-zinc-950/40 backdrop-blur px-4 py-2.5 shadow-sm">
                    <p className="text-sm text-zinc-900 dark:text-zinc-100 font-semibold">
                      {user.username}
                    </p>
                    <p className="text-xs text-zinc-600 dark:text-zinc-300">
                      Saldo: <span className="text-green-600 font-semibold">{saldoFormatado}</span>
                    </p>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => router.push("/login")}
                  className="rounded-2xl bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
                >
                  Entrar
                </button>
              )}
            </div>
          </div>

          {/* HERO */}
          <section className="mb-8">
            <div className="relative overflow-hidden rounded-3xl border border-zinc-200/70 dark:border-white/10 bg-white dark:bg-zinc-950 shadow-lg">
              <div className="relative h-[220px] sm:h-[340px] w-full">
                <Image
                  src="/img/Hustlerlife.png"
                  alt="Capa Hustler"
                  fill
                  priority
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/35 to-black/10" />
              </div>

              <div className="absolute inset-0 flex items-end">
                <div className="p-5 sm:p-8">
                  <p className="text-xs tracking-[0.2em] text-white/70">HUSTLER LIFE • ENTERTENIMENTO</p>
                  <h2 className="mt-2 text-2xl sm:text-4xl font-semibold text-white">
                    Jogue, dispute e evolua.
                  </h2>
                  <p className="mt-2 max-w-xl text-sm sm:text-base text-white/80">
                    Entre no catálogo, faça depósitos via PIX e use seu saldo para liberar itens e jogos.
                  </p>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        const pix = jogos.find((j) => j.id === 2);
                        if (pix) comprarOuAbrir(pix);
                      }}
                      className="rounded-2xl bg-white px-5 py-2.5 text-sm font-semibold text-zinc-900 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-white/60"
                    >
                      Jogar Pix & Boxing
                    </button>

                    <button
                      type="button"
                      onClick={() => router.push("/jogos")}
                      className="rounded-2xl border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/30"
                    >
                      Ver catálogo
                    </button>

                    <button
                      type="button"
                      onClick={openDeposit}
                      className="rounded-2xl border border-white/20 bg-green-600/90 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-400/60"
                    >
                      Depositar via PIX
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* GRID */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {jogos.map((jogo) => {
              const isBusy = buyingId === jogo.id;
              const primaryIsPlay = jogo.cta === "play" && Boolean(jogo.link);
              const indisponivel = (jogo.tag || "").toLowerCase().includes("em breve");
              const preco = Number(jogo.preco ?? 0);

              return (
                <div
                  key={jogo.id}
                  className={cn(
                    "rounded-3xl border border-zinc-200/70 dark:border-white/10",
                    "bg-white dark:bg-zinc-950 shadow-sm overflow-hidden",
                    "hover:shadow-xl transition-shadow"
                  )}
                >
                  <div className="relative">
                    <Image
                      src={jogo.img}
                      alt={`Imagem do jogo ${jogo.nome}`}
                      width={900}
                      height={540}
                      className="w-full h-auto object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

                    {jogo.tag && (
                      <div className="absolute top-3 left-3">
                        <span className="inline-flex items-center rounded-full border border-white/20 bg-black/40 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                          {jogo.tag}
                        </span>
                      </div>
                    )}

                    {isBusy && (
                      <div className="absolute inset-0 bg-black/55 flex items-center justify-center">
                        <span className="text-white font-semibold">Abrindo…</span>
                      </div>
                    )}
                  </div>

                  <div className="p-4">
                    <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                      {jogo.nome}
                    </p>

                    {jogo.desc && (
                      <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-1">{jogo.desc}</p>
                    )}

                    {jogo.cta === "buy" && preco > 0 && !indisponivel && (
                      <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-200">
                        Preço: <span className="font-semibold text-green-600">{formatBRL(preco)}</span>
                      </p>
                    )}

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => comprarOuAbrir(jogo)}
                        disabled={isBusy || indisponivel}
                        className={cn(
                          "rounded-2xl px-4 py-2.5 text-sm font-semibold",
                          "focus:outline-none focus:ring-2 focus:ring-green-500",
                          primaryIsPlay
                            ? "bg-green-600 text-white hover:bg-green-700"
                            : "bg-black text-white hover:bg-zinc-900",
                          "disabled:opacity-60 disabled:cursor-not-allowed"
                        )}
                      >
                        {indisponivel ? "Em breve" : primaryIsPlay ? "Jogar" : "Comprar"}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          // CTA secundário: detalhes
                          router.push(`/jogos/${jogo.id}`);
                        }}
                        className={cn(
                          "rounded-2xl px-4 py-2.5 text-sm font-semibold",
                          "border border-zinc-200/70 dark:border-white/10",
                          "bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100",
                          "hover:bg-zinc-50 dark:hover:bg-white/5",
                          "focus:outline-none focus:ring-2 focus:ring-zinc-400/40"
                        )}
                      >
                        Detalhes
                      </button>
                    </div>

                    <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                      Clique em <span className="font-semibold">Detalhes</span> para ver informações completas.
                    </p>
                  </div>
                </div>
              );
            })}
          </section>

          {/* MODAL DEPÓSITO */}
          {depositOpen && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) closeDeposit();
              }}
            >
              <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-white dark:bg-zinc-950 shadow-2xl overflow-hidden">
                <div className="p-5 sm:p-6 border-b border-zinc-200/70 dark:border-white/10 flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100">
                      Depositar via PIX
                    </h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-300">
                      Escolha um valor e gere o QR Code para pagamento.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={closeDeposit}
                    className="rounded-2xl px-3 py-2 text-sm font-semibold bg-zinc-100 dark:bg-white/10 text-zinc-900 dark:text-zinc-100 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-zinc-400/40"
                  >
                    Fechar
                  </button>
                </div>

                <div className="p-5 sm:p-6">
                  <div className="flex flex-wrap gap-2">
                    {[10, 20, 50, 100, 200].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setDepositAmount(v)}
                        className={cn(
                          "rounded-2xl px-4 py-2 text-sm font-semibold border transition",
                          depositAmount === v
                            ? "bg-green-600 text-white border-green-600"
                            : "bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border-zinc-200/70 dark:border-white/10 hover:bg-zinc-50 dark:hover:bg-white/5"
                        )}
                      >
                        R$ {v}
                      </button>
                    ))}
                  </div>

                  <div className="mt-4">
                    <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                      Valor (R$)
                    </label>
                    <input
                      type="number"
                      min={1}
                      step="0.01"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(Number(e.target.value))}
                      className="mt-2 w-full rounded-2xl border border-zinc-200/70 dark:border-white/10 bg-white dark:bg-zinc-950 px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="Ex: 20"
                    />
                    <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                      Mínimo: R$ 1,00 • O saldo atualiza automaticamente após confirmação do webhook.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={gerarPixDeposito}
                    disabled={depositLoading}
                    className="mt-4 w-full rounded-2xl bg-green-600 px-5 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    {depositLoading ? "Gerando PIX…" : "Gerar QR Code"}
                  </button>

                  {!!depositMsg.text && (
                    <p
                      className={cn(
                        "mt-3 text-sm font-medium",
                        depositMsg.type === "success" ? "text-green-600" : "text-red-600"
                      )}
                    >
                      {depositMsg.text}
                    </p>
                  )}

                  {depositData?.qr_code_base64 && (
                    <div className="mt-5 rounded-3xl border border-zinc-200/70 dark:border-white/10 p-4 sm:p-5">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          Valor:{" "}
                          <span className="text-green-600">
                            {formatBRL(Number(depositData.amount))}
                          </span>
                        </p>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                          ID: {String(depositData.paymentId)}
                        </span>
                      </div>

                      <div className="mt-4 flex items-center justify-center">
                        <div className="rounded-2xl bg-white p-3 shadow-sm">
                          <img
                            src={`data:image/png;base64,${depositData.qr_code_base64}`}
                            alt="QR Code PIX"
                            className="w-56 h-56 sm:w-64 sm:h-64"
                          />
                        </div>
                      </div>

                      <div className="mt-4">
                        <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                          PIX copia e cola
                        </label>
                        <textarea
                          readOnly
                          value={depositData.qr_code}
                          className="mt-2 w-full rounded-2xl border border-zinc-200/70 dark:border-white/10 bg-white dark:bg-zinc-950 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100"
                          rows={4}
                        />
                      </div>

                      <button
                        type="button"
                        onClick={copiarPixDeposito}
                        className={cn(
                          "mt-3 w-full rounded-2xl px-4 py-2.5 text-sm font-semibold",
                          "border border-zinc-200/70 dark:border-white/10",
                          copied
                            ? "bg-green-600 text-white border-green-600"
                            : "bg-zinc-100 dark:bg-white/10 text-zinc-900 dark:text-zinc-100 hover:opacity-90"
                        )}
                      >
                        {copied ? "Copiado ✅" : "Copiar código PIX"}
                      </button>

                      <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                        Após o pagamento, o saldo será atualizado automaticamente quando o Mercado Pago confirmar.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* MODAL COMPRA */}
          {buyOpen && buyGame && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) closeBuy();
              }}
            >
              <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-white dark:bg-zinc-950 shadow-2xl overflow-hidden">
                <div className="p-5 sm:p-6 border-b border-zinc-200/70 dark:border-white/10 flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100">
                      Comprar via PIX
                    </h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-300">
                      Jogo: <span className="font-semibold">{buyGame.nome}</span> • Valor:{" "}
                      <span className="font-semibold text-green-600">
                        {formatBRL(Number(buyGame.preco ?? 0))}
                      </span>
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={closeBuy}
                    className="rounded-2xl px-3 py-2 text-sm font-semibold bg-zinc-100 dark:bg-white/10 text-zinc-900 dark:text-zinc-100 hover:opacity-90"
                  >
                    Fechar
                  </button>
                </div>

                <div className="p-5 sm:p-6">
                  <button
                    type="button"
                    onClick={gerarPixCompra}
                    disabled={buyLoading}
                    className="w-full rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-900 disabled:opacity-60"
                  >
                    {buyLoading ? "Gerando PIX…" : "Gerar PIX da compra"}
                  </button>

                  {!!buyMsg.text && (
                    <p
                      className={cn(
                        "mt-3 text-sm font-medium",
                        buyMsg.type === "success" ? "text-green-600" : "text-red-600"
                      )}
                    >
                      {buyMsg.text}
                    </p>
                  )}

                  {buyData?.qr_code_base64 && (
                    <div className="mt-5 rounded-3xl border border-zinc-200/70 dark:border-white/10 p-4 sm:p-5">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          Valor:{" "}
                          <span className="text-green-600">{formatBRL(Number(buyData.amount))}</span>
                        </p>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                          ID: {String(buyData.paymentId)}
                        </span>
                      </div>

                      <div className="mt-4 flex items-center justify-center">
                        <div className="rounded-2xl bg-white p-3 shadow-sm">
                          <img
                            src={`data:image/png;base64,${buyData.qr_code_base64}`}
                            alt="QR Code PIX"
                            className="w-56 h-56 sm:w-64 sm:h-64"
                          />
                        </div>
                      </div>

                      <div className="mt-4">
                        <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                          PIX copia e cola
                        </label>
                        <textarea
                          readOnly
                          value={buyData.qr_code}
                          className="mt-2 w-full rounded-2xl border border-zinc-200/70 dark:border-white/10 bg-white dark:bg-zinc-950 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100"
                          rows={4}
                        />
                      </div>

                      <button
                        type="button"
                        onClick={copiarPixCompra}
                        className={cn(
                          "mt-3 w-full rounded-2xl px-4 py-2.5 text-sm font-semibold",
                          "border border-zinc-200/70 dark:border-white/10",
                          buyCopied
                            ? "bg-green-600 text-white border-green-600"
                            : "bg-zinc-100 dark:bg-white/10 text-zinc-900 dark:text-zinc-100 hover:opacity-90"
                        )}
                      >
                        {buyCopied ? "Copiado ✅" : "Copiar código PIX"}
                      </button>

                      <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                        Após o pagamento, a liberação do jogo acontece quando o Mercado Pago confirmar no webhook.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
