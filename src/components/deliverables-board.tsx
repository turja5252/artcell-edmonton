"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Check, Plus } from "lucide-react";

import { PersonChip } from "@/components/person-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  compareDeliverables,
  DUE_GROUP_LABEL,
  DUE_TODAY_PILL_CLASS,
  dueGroupId,
  formatDueDate,
  isDeliverableOverdue,
  OVERDUE_PILL_CLASS,
  parseIsoDate,
  todayIsoDate,
  type DueGroupId,
} from "@/lib/deliverables";
import { formatTime } from "@/lib/people";
import { isTeamAdmin, samePerson } from "@/lib/team-admin";
import type { Deliverable } from "@/lib/types";
import { cn } from "@/lib/utils";

export type DeliverableFilter = "mine" | "open" | "overdue" | "done" | "all";

export type DeliverableDraft = {
  title: string;
  assignedTo: string;
  dueDate: string;
  startDate: string;
  notes: string;
};

type Props = {
  items: Deliverable[];
  people: string[];
  me: string;
  busyId: string | null;
  error?: string;
  loading?: boolean;
  onRetry?: () => void;
  onPickMe: () => void;
  onAdd: (input: DeliverableDraft) => Promise<void>;
  onSave: (id: string, patch: Partial<Deliverable> & { actor?: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

const GROUP_ORDER: DueGroupId[] = ["overdue", "today", "tomorrow", "week", "later", "done"];

export function DeliverablesBoard({
  items,
  people,
  me,
  busyId,
  error,
  loading,
  onRetry,
  onPickMe,
  onAdd,
  onSave,
  onDelete,
}: Props) {
  const [filter, setFilter] = useState<DeliverableFilter>("open");
  const [addOpen, setAddOpen] = useState(false);
  const [active, setActive] = useState<Deliverable | null>(null);
  const today = todayIsoDate();

  useEffect(() => {
    setActive((current) => {
      if (!current) return current;
      return items.find((item) => item.id === current.id) ?? null;
    });
  }, [items]);
  const roster = people.filter((name) => !isTeamAdmin(name));

  const mineCount = me
    ? items.filter((item) => samePerson(item.assignedTo, me)).length
    : 0;
  const openCount = items.filter((item) => !item.done).length;
  const overdueCount = items.filter((item) => isDeliverableOverdue(item, today)).length;
  const doneCount = items.filter((item) => item.done).length;
  const myOpen = me
    ? items.filter((item) => samePerson(item.assignedTo, me) && !item.done).length
    : 0;

  const visible = items
    .filter((item) => matchesFilter(item, filter, me, today))
    .sort(compareDeliverables);

  const groups = useMemo(() => {
    const buckets = new Map<DueGroupId, Deliverable[]>();
    for (const item of visible) {
      const key = dueGroupId(item, today);
      const list = buckets.get(key) ?? [];
      list.push(item);
      buckets.set(key, list);
    }
    return GROUP_ORDER.filter((key) => (buckets.get(key)?.length ?? 0) > 0).map((key) => ({
      id: key,
      label: DUE_GROUP_LABEL[key],
      items: buckets.get(key)!,
    }));
  }, [today, visible]);

  const filters: { id: DeliverableFilter; label: string; count: number }[] = [
    { id: "mine", label: me && !isTeamAdmin(me) ? me.split(" ")[0] : "Mine", count: mineCount },
    { id: "open", label: "Open", count: openCount },
    { id: "overdue", label: "Overdue", count: overdueCount },
    { id: "done", label: "Done", count: doneCount },
    { id: "all", label: "All", count: items.length },
  ];

  return (
    <div className="space-y-4 pb-24">
      <div>
        <h2 className="font-heading text-3xl tracking-wide">Deliverables</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Shared show work. Title, owner, and due date on every item. Anyone on the
          team can add or mark completed — Admin is only for the roster.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Open" value={String(openCount)} />
        <Stat label="Overdue" value={String(overdueCount)} warn={overdueCount > 0} />
        <Stat label={me && !isTeamAdmin(me) ? "Your open" : "On the list"} value={String(me && !isTeamAdmin(me) ? myOpen : items.length)} />
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
          {onRetry ? (
            <Button type="button" variant="ghost" className="ml-2 h-8" onClick={onRetry}>
              Retry
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {filters.map((item) => (
          <Button
            key={item.id}
            type="button"
            variant={filter === item.id ? "default" : "outline"}
            className="h-10 shrink-0 rounded-full px-3"
            onClick={() => setFilter(item.id)}
          >
            {item.label}
            <span className="tabular-nums opacity-80">{item.count}</span>
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center">
          <p className="font-medium">Loading the list…</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Pulling the shared tasks for the concert team.
          </p>
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          filter={filter}
          me={me}
          hasAny={items.length > 0}
          onAdd={() => setAddOpen(true)}
          onPickMe={onPickMe}
        />
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <section key={group.id}>
              <h3
                className={cn(
                  "text-xs font-semibold tracking-wide uppercase",
                  group.id === "overdue" ? "text-amber-400" : "text-muted-foreground"
                )}
              >
                {group.label}
                <span className="ml-2 tabular-nums font-medium opacity-80">{group.items.length}</span>
              </h3>
              <ul className="mt-2 space-y-3">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <TaskCard
                      item={item}
                      me={me}
                      today={today}
                      busy={busyId === item.id}
                      onOpen={() => setActive(item)}
                      onToggleDone={() => {
                        void onSave(item.id, { done: !item.done, actor: me });
                      }}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <Button
        type="button"
        className="fixed bottom-28 left-4 z-30 size-14 rounded-full shadow-lg sm:left-auto sm:right-[max(1rem,calc(50%-22rem))]"
        onClick={() => setAddOpen(true)}
        aria-label="Add a deliverable"
      >
        <Plus className="size-6" />
      </Button>

      <TaskSheet
        mode="add"
        open={addOpen}
        people={roster}
        me={me}
        onOpenChange={setAddOpen}
        onAdd={onAdd}
      />
      <TaskSheet
        mode="edit"
        open={Boolean(active)}
        item={active}
        people={roster}
        me={me}
        busy={busyId === active?.id}
        onOpenChange={(open) => {
          if (!open) setActive(null);
        }}
        onSave={onSave}
        onDelete={onDelete}
      />
    </div>
  );
}

function matchesFilter(
  item: Deliverable,
  filter: DeliverableFilter,
  me: string,
  today: string
): boolean {
  if (filter === "mine") return Boolean(me) && samePerson(item.assignedTo, me);
  if (filter === "open") return !item.done;
  if (filter === "overdue") return isDeliverableOverdue(item, today);
  if (filter === "done") return item.done;
  return true;
}

function Stat({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-3 py-3",
        warn
          ? "border-amber-500/50 bg-amber-500/10"
          : "border-border/80 bg-card/70"
      )}
    >
      <p
        className={cn(
          "text-[11px] tracking-wide uppercase",
          warn ? "text-amber-300" : "text-muted-foreground"
        )}
      >
        {label}
      </p>
      <p className={cn("font-heading mt-1 text-2xl tabular-nums", warn && "text-amber-200")}>
        {value}
      </p>
    </div>
  );
}

function TaskCard({
  item,
  me,
  today,
  busy,
  onOpen,
  onToggleDone,
}: {
  item: Deliverable;
  me: string;
  today: string;
  busy: boolean;
  onOpen: () => void;
  onToggleDone: () => void;
}) {
  const overdue = isDeliverableOverdue(item, today);
  const dueToday = !item.done && item.dueDate === today;
  const mine = Boolean(me) && samePerson(item.assignedTo, me);

  return (
    <article
      className={cn(
        "rounded-2xl border border-border/80 bg-card/80 p-3",
        overdue && "task-overdue",
        item.done && "opacity-75"
      )}
    >
      <button type="button" onClick={onOpen} className="w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg leading-tight font-semibold">{item.title}</h3>
          {overdue ? (
            <span className={OVERDUE_PILL_CLASS}>
              <CalendarClock className="size-3.5" />
              Overdue
            </span>
          ) : dueToday ? (
            <span className={DUE_TODAY_PILL_CLASS}>Due today</span>
          ) : item.done ? (
            <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">
              Done
            </span>
          ) : null}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <PersonChip name={item.assignedTo} />
          <span className={cn("text-sm", overdue ? "font-medium text-amber-200" : "text-muted-foreground")}>
            Due {formatDueDate(item.dueDate)}
          </span>
          {item.startDate ? (
            <span className="text-xs text-muted-foreground">
              Start {formatDueDate(item.startDate)}
            </span>
          ) : null}
        </div>
        {item.notes ? (
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{item.notes}</p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Tap to edit notes or the timeline.</p>
        )}
        {item.updatedAt ? (
          <p className="mt-1 text-[11px] text-muted-foreground">
            Updated {formatTime(item.updatedAt)}
            {item.updatedBy ? ` · ${item.updatedBy}` : ""}
          </p>
        ) : null}
      </button>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" className="h-12" onClick={onOpen}>
          {mine ? "Edit" : "Open"}
        </Button>
        <Button
          type="button"
          variant={item.done ? "outline" : "secondary"}
          className="h-12"
          disabled={busy}
          onClick={onToggleDone}
        >
          <Check className="size-4" />
          {item.done ? "Reopen" : "Mark completed"}
        </Button>
      </div>
    </article>
  );
}

function EmptyState({
  filter,
  me,
  hasAny,
  onAdd,
  onPickMe,
}: {
  filter: DeliverableFilter;
  me: string;
  hasAny: boolean;
  onAdd: () => void;
  onPickMe: () => void;
}) {
  if (filter === "mine" && !me) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-6 text-center">
        <p className="font-medium">Pick your name to see your tasks</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Updating as is how the list knows which items are yours. You can still add
          work for someone else without picking first.
        </p>
        <Button type="button" className="mt-4 h-12" onClick={onPickMe}>
          Who are you?
        </Button>
      </div>
    );
  }
  if (filter === "mine" && isTeamAdmin(me)) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-6 text-center">
        <p className="font-medium">Admin does not own tasks</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Switch Updating as to your name to see yours, or use Open / All.
        </p>
        <Button type="button" className="mt-4 h-12" onClick={onPickMe}>
          Switch to your name
        </Button>
      </div>
    );
  }
  if (filter === "mine") {
    return (
      <div className="rounded-2xl border border-dashed border-border p-6 text-center">
        <p className="font-medium">Nothing assigned to {me} right now</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Add a task and put your name on it, or ask someone to assign you.
        </p>
        <Button type="button" className="mt-4 h-12" onClick={onAdd}>
          Add a task
        </Button>
      </div>
    );
  }
  if (filter === "overdue") {
    return (
      <div className="rounded-2xl border border-dashed border-border p-6 text-center">
        <p className="font-medium">Nothing is overdue</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {hasAny
            ? "Open work still has time on the clock."
            : "Add the next show task when you know who owns it and when it is due."}
        </p>
      </div>
    );
  }
  if (filter === "done") {
    return (
      <div className="rounded-2xl border border-dashed border-border p-6 text-center">
        <p className="font-medium">Nothing marked completed yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          When a task is finished, tap Mark completed so the rest of the team can see it.
        </p>
      </div>
    );
  }
  if (filter === "open" && hasAny) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-6 text-center">
        <p className="font-medium">No open tasks</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Everything on the list is marked completed. Add the next one when it comes up.
        </p>
        <Button type="button" className="mt-4 h-12" onClick={onAdd}>
          Add a task
        </Button>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-dashed border-border p-6 text-center">
      <p className="font-medium">Nothing on the list yet</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Add the next show task — posters, load-in, merch table, guest list, whatever
        still has to get done. Owner and due date are required.
      </p>
      <Button type="button" className="mt-4 h-12" onClick={onAdd}>
        Add a task
      </Button>
    </div>
  );
}

function TaskSheet({
  mode,
  open,
  item,
  people,
  me,
  busy,
  onOpenChange,
  onAdd,
  onSave,
  onDelete,
}: {
  mode: "add" | "edit";
  open: boolean;
  item?: Deliverable | null;
  people: string[];
  me: string;
  busy?: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd?: (input: DeliverableDraft) => Promise<void>;
  onSave?: (id: string, patch: Partial<Deliverable> & { actor?: string }) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}) {
  if (mode === "edit") {
    if (!item) return null;
    return (
      <TaskForm
        key={item.id}
        mode="edit"
        open={open}
        item={item}
        people={people}
        me={me}
        busy={busy}
        onOpenChange={onOpenChange}
        onSave={onSave}
        onDelete={onDelete}
      />
    );
  }
  return (
    <TaskForm
      key={open ? "add-open" : "add-closed"}
      mode="add"
      open={open}
      people={people}
      me={me}
      busy={busy}
      onOpenChange={onOpenChange}
      onAdd={onAdd}
    />
  );
}

function defaultAssignee(me: string, people: string[]): string {
  if (me && !isTeamAdmin(me) && people.some((name) => samePerson(name, me))) {
    return people.find((name) => samePerson(name, me)) ?? me;
  }
  return "";
}

function TaskForm({
  mode,
  open,
  item,
  people,
  me,
  busy,
  onOpenChange,
  onAdd,
  onSave,
  onDelete,
}: {
  mode: "add" | "edit";
  open: boolean;
  item?: Deliverable;
  people: string[];
  me: string;
  busy?: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd?: (input: DeliverableDraft) => Promise<void>;
  onSave?: (id: string, patch: Partial<Deliverable> & { actor?: string }) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}) {
  const [title, setTitle] = useState(item?.title ?? "");
  const [assignedTo, setAssignedTo] = useState(item?.assignedTo ?? defaultAssignee(me, people));
  const [dueDate, setDueDate] = useState(item?.dueDate ?? "");
  const [startDate, setStartDate] = useState(item?.startDate ?? "");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const missingAssignee = !assignedTo.trim();
  const missingDue = !parseIsoDate(dueDate);
  const missingTitle = !title.trim();
  const start = parseIsoDate(startDate);
  const due = parseIsoDate(dueDate);
  const startAfterDue = Boolean(start && due && start > due);
  const canSave = !missingTitle && !missingAssignee && !missingDue && !startAfterDue && !saving && !busy;

  async function submit() {
    if (missingTitle) {
      setError("Add a title.");
      return;
    }
    if (missingAssignee) {
      setError("Pick who owns this from the team.");
      return;
    }
    if (missingDue) {
      setError("Set a due date.");
      return;
    }
    if (startAfterDue) {
      setError("Start date has to be on or before the due date.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (mode === "add") {
        await onAdd?.({
          title: title.trim(),
          assignedTo,
          dueDate: due!,
          startDate: start ?? "",
          notes,
        });
        setTitle("");
        setAssignedTo(defaultAssignee(me, people));
        setDueDate("");
        setStartDate("");
        setNotes("");
        onOpenChange(false);
      } else if (item) {
        await onSave?.(item.id, {
          title: title.trim(),
          assignedTo,
          dueDate: due!,
          startDate: start,
          notes,
          actor: me,
        });
        onOpenChange(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this task");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!item) return;
    setSaving(true);
    setError("");
    try {
      await onDelete?.(item.id);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete this task");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto px-4 pb-6">
        <SheetHeader className="px-0 pr-8 text-left">
          <SheetTitle className="font-heading text-2xl tracking-wide">
            {mode === "add" ? "Add a deliverable" : "Edit deliverable"}
          </SheetTitle>
          <SheetDescription>
            Title, a teammate, and a due date are required. Notes and a start date are
            optional.
          </SheetDescription>
        </SheetHeader>

        <form
          className="mt-4 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <section className="space-y-2">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Title
            </p>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="What still has to get done"
              className="h-12 text-base"
              autoFocus={mode === "add"}
            />
          </section>

          <section className="space-y-2">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Assignee
            </p>
            {people.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Team roster is empty. Add people on Team before you can assign this.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {people.map((person) => (
                  <Button
                    key={person}
                    type="button"
                    variant={samePerson(assignedTo, person) ? "default" : "outline"}
                    className="h-11 rounded-full px-3"
                    onClick={() => setAssignedTo(person)}
                  >
                    <PersonChip name={person} />
                  </Button>
                ))}
              </div>
            )}
            {missingAssignee ? (
              <p className="text-xs text-amber-300">Pick a teammate — Admin cannot own a task.</p>
            ) : null}
          </section>

          <section className="space-y-2">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Timeline
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="block text-sm text-foreground">Due date</span>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  className="h-12 text-base [color-scheme:dark]"
                  required
                />
              </label>
              <label className="space-y-1.5">
                <span className="block text-sm text-muted-foreground">Start date (optional)</span>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="h-12 text-base [color-scheme:dark]"
                />
              </label>
            </div>
            {missingDue ? (
              <p className="text-xs text-amber-300">Due date is required.</p>
            ) : null}
            {startAfterDue ? (
              <p className="text-xs text-amber-300">Start date has to be on or before the due date.</p>
            ) : null}
          </section>

          <section className="space-y-2">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Notes
            </p>
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Where it stands, who to text, what “done” looks like…"
              className="min-h-24 text-base"
            />
          </section>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <SheetFooter className="px-0">
            <Button type="submit" className="h-14 w-full text-base" disabled={!canSave}>
              {saving ? "Saving…" : mode === "add" ? "Add to the list" : "Save changes"}
            </Button>
            {mode === "edit" && item ? (
              <>
                <Button
                  type="button"
                  variant={item.done ? "outline" : "secondary"}
                  className="h-12 w-full"
                  disabled={saving || busy}
                  onClick={() => void onSave?.(item.id, { done: !item.done, actor: me })}
                >
                  <Check className="size-4" />
                  {item.done ? "Reopen" : "Mark completed"}
                </Button>
                {confirmDelete ? (
                  <Button
                    type="button"
                    variant="destructive"
                    className="h-12 w-full"
                    disabled={saving}
                    onClick={() => void remove()}
                  >
                    Delete this task
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-12 w-full text-muted-foreground"
                    onClick={() => setConfirmDelete(true)}
                  >
                    Remove from the list
                  </Button>
                )}
              </>
            ) : null}
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
