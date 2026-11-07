import { createFileRoute } from "@tanstack/react-router";
import { AgroEiAuthPortal } from "@/lib/agroei-auth-portal";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Acesso e Perfil | Gestor AgroEI" },
      { name: "description", content: "Acesso seguro e perfil pessoal no sistema de gestão da AgroEI." },
      { property: "og:title", content: "Acesso e Perfil | Gestor AgroEI" },
      { property: "og:description", content: "Acesse o sistema de gestão da AgroEI com sua conta autorizada." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AgroEiAuthPortal,
});