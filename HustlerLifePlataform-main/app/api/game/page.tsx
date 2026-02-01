import { redirect } from "next/navigation";

export default async function GamePage() {
  const userPaid = false; // buscar no banco

  if (!userPaid) {
    redirect("/pay");
  }

  return (
    <div>
      🎮 Jogo liberado!
    </div>
  );
}
