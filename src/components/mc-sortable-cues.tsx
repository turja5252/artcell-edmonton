"use client";

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function moveIndex<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) {
    return list;
  }
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function McSortableCues<T extends { id: string }>({
  items,
  disabled,
  onReorder,
  render,
}: {
  items: T[];
  disabled?: boolean;
  onReorder: (ids: string[]) => void;
  render: (item: T, handle: ReactNode) => ReactNode;
}) {
  const [ids, setIds] = useState(items.map((item) => item.id));
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const drag = useRef<{
    id: string;
    index: number;
    origin: string[];
    pointerId: number;
  } | null>(null);
  const idsRef = useRef(ids);
  const listRef = useRef<HTMLUListElement>(null);
  idsRef.current = ids;

  useEffect(() => {
    if (drag.current) return;
    setIds(items.map((item) => item.id));
  }, [items]);

  const byId = new Map(items.map((item) => [item.id, item]));
  const ordered = ids
    .map((id) => byId.get(id))
    .filter((item): item is T => Boolean(item));
  for (const item of items) {
    if (!ids.includes(item.id)) ordered.push(item);
  }

  function persistIfChanged(next: string[], origin: string[]) {
    if (next.join("\0") !== origin.join("\0")) onReorder(next);
  }

  function onPointerDown(event: PointerEvent<HTMLButtonElement>, id: string) {
    if (disabled || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const index = idsRef.current.indexOf(id);
    drag.current = {
      id,
      index,
      origin: idsRef.current,
      pointerId: event.pointerId,
    };
    setDraggingId(id);
  }

  function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
    const state = drag.current;
    if (!state || !listRef.current || event.pointerId !== state.pointerId) return;
    const children = Array.from(listRef.current.children) as HTMLElement[];
    if (!children.length) return;
    let target = state.index;
    for (let i = 0; i < children.length; i++) {
      const rect = children[i].getBoundingClientRect();
      if (event.clientY < rect.top + rect.height / 2) {
        target = i;
        break;
      }
      target = i;
    }
    if (target === state.index) return;
    setIds((current) => {
      const next = moveIndex(current, state.index, target);
      drag.current = { ...state, index: target };
      return next;
    });
  }

  function onPointerUp(event: PointerEvent<HTMLButtonElement>) {
    const state = drag.current;
    if (!state || event.pointerId !== state.pointerId) return;
    drag.current = null;
    setDraggingId(null);
    persistIfChanged(idsRef.current, state.origin);
  }

  function nudge(id: string, delta: number) {
    if (disabled) return;
    const origin = idsRef.current;
    const from = origin.indexOf(id);
    const next = moveIndex(origin, from, from + delta);
    setIds(next);
    persistIfChanged(next, origin);
  }

  return (
    <ul ref={listRef} className="mt-4 space-y-3">
      {ordered.map((item, index) => {
        const handle = disabled ? null : (
          <div className="flex shrink-0 flex-col items-center gap-1">
            <button
              type="button"
              aria-label="Slide to reorder"
              disabled={disabled}
              className={cn(
                "flex h-12 w-10 items-center justify-center rounded-xl border border-border/70 bg-background/70 touch-none",
                disabled ? "cursor-default opacity-40" : "cursor-grab active:cursor-grabbing",
                draggingId === item.id && "border-primary bg-primary/20"
              )}
              onPointerDown={(event) => onPointerDown(event, item.id)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <GripVertical className="size-5" />
            </button>
            <div className="flex flex-col gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon-xs"
                className="size-8"
                disabled={disabled || index === 0}
                aria-label="Move up"
                onClick={() => nudge(item.id, -1)}
              >
                <ChevronUp />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon-xs"
                className="size-8"
                disabled={disabled || index === ordered.length - 1}
                aria-label="Move down"
                onClick={() => nudge(item.id, 1)}
              >
                <ChevronDown />
              </Button>
            </div>
          </div>
        );
        return (
          <li
            key={item.id}
            className={cn(draggingId === item.id && "relative z-10 scale-[1.01]")}
          >
            {render(item, handle)}
          </li>
        );
      })}
    </ul>
  );
}
