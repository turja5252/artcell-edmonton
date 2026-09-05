import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Artcell Edmonton",
    short_name: "Artcell",
    description:
      "Mobile outreach board for the Artcell Edmonton concert team.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#2a1c12",
    theme_color: "#2a1c12",
    lang: "en",
    categories: ["utilities", "business"],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-192-maskable.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
