"use client";

import { useEffect, useState } from "react";

import { concertCountdownCopy, DEFAULT_CONCERT_DATE } from "@/lib/concert-date";
import { cn } from "@/lib/utils";

export function ConcertCountdown({
  concertDate = DEFAULT_CONCERT_DATE,
  className,
}: {
  concertDate?: string;
  className?: string;
}) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);

  const { headline, subtitle, days } = concertCountdownCopy(concertDate, now);

  return (
    <div className={cn(className)}>
      <p className="mt-1.5 font-heading text-2xl leading-none tracking-wide text-primary">
        {headline}
      </p>
      {days >= 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      ) : null}
    </div>
  );
}
