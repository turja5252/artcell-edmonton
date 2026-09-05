"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { ExternalLink } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { canonicalizeTicketUrl } from "@/lib/tickets";
import { cn } from "@/lib/utils";

type Variant = "hero" | "compact";

export function TicketQr({
  url,
  variant = "hero",
  className,
}: {
  url?: string | null;
  variant?: Variant;
  className?: string;
}) {
  const ticketUrl = canonicalizeTicketUrl(url);
  const [src, setSrc] = useState("");

  useEffect(() => {
    let cancelled = false;
    const pixels = variant === "hero" ? 368 : 144;
    void QRCode.toDataURL(ticketUrl, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: pixels,
      color: {
        dark: "#14110e",
        light: "#f7f4ef",
      },
    }).then((dataUrl) => {
      if (!cancelled) setSrc(dataUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [ticketUrl, variant]);

  if (variant === "compact") {
    return (
      <a
        href={ticketUrl}
        target="_blank"
        rel="noreferrer"
        className={cn(
          "flex w-[72px] shrink-0 flex-col items-center gap-1 rounded-2xl border border-border/80 bg-card/80 p-1.5",
          className
        )}
        aria-label="Open MacEwan tickets"
      >
        <QrPlate src={src} size={56} alt="Scan to buy MacEwan tickets" />
        <span className="text-center text-[10px] leading-tight font-medium text-primary">
          Scan to buy
        </span>
      </a>
    );
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-primary/30 bg-card/90 p-4",
        className
      )}
    >
      <p className="text-[11px] tracking-wide text-primary uppercase">Buy tickets</p>
      <h2 className="font-heading mt-1 text-2xl leading-none tracking-wide">MacEwan tickets</h2>
      <p className="mt-1 text-sm text-muted-foreground">Scan to buy · official box office</p>

      <a
        href={ticketUrl}
        target="_blank"
        rel="noreferrer"
        className="mx-auto mt-4 flex w-fit flex-col items-center"
        aria-label="Open MacEwan tickets"
      >
        <QrPlate src={src} size={184} alt="QR code for MacEwan tickets" />
      </a>

      <a
        href={ticketUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-3 block break-all text-center text-sm text-primary underline-offset-4 hover:underline"
      >
        {ticketUrl}
      </a>

      <a
        href={ticketUrl}
        target="_blank"
        rel="noreferrer"
        className={cn(buttonVariants({ variant: "default" }), "mt-3 h-12 w-full gap-2")}
      >
        <ExternalLink className="size-4" />
        Open tickets
      </a>
    </div>
  );
}

function QrPlate({
  src,
  size,
  alt,
}: {
  src: string;
  size: number;
  alt: string;
}) {
  return (
    <span
      className="block overflow-hidden rounded-lg bg-[#f7f4ef]"
      style={{ width: size, height: size }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} width={size} height={size} className="size-full" />
      ) : (
        <span className="block size-full animate-pulse bg-[#f7f4ef]" aria-hidden />
      )}
    </span>
  );
}
