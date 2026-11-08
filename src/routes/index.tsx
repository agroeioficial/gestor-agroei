import { createFileRoute } from "@tanstack/react-router";
import { AgroEiAuthPortal } from "@/lib/agroei-auth-portal";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Gestor AgroEI | Painéis e Folha Salarial" },
      { name: "description", content: "Área de trabalho AgroEI com painéis por função e processamento salarial protegido." },
      { property: "og:title", content: "Gestor AgroEI | Painéis e Folha Salarial" },
      { property: "og:description", content: "Acesso autorizado aos painéis e à folha salarial do Gestor AgroEI." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AgroEiAuthPortal,
});