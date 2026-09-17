import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../context/AuthContext";
import { useTrash, useAuditLogs, useRestoreTrashItem } from "../../hooks/api";
import type { AuditLogFilters, TrashItem, TrashKind } from "../../services/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import Loading from "../../components/Loading";
import { RefreshStatus } from "../../components/RefreshStatus";
import { Undo2, Trash2, ScrollText, RotateCcw } from "lucide-react";
import { toast } from "sonner";

const KIND_LABEL: Record<TrashKind, string> = {
  events: "Events",
  scores: "Scores",
  athletes: "Athletes",
  brackets: "Brackets",
  announcements: "Announcements",
};

const EVENT_STYLE: Record<string, string> = {
  created: "bg-emerald-100 text-emerald-700",
  updated: "bg-blue-100 text-blue-700",
  deleted: "bg-amber-100 text-amber-700",
  force_deleted: "bg-red-100 text-red-700",
  restored: "bg-violet-100 text-violet-700",
};

const AUDIT_TYPES: NonNullable<AuditLogFilters["type"]>[] = [
  "Score",
  "Event",
  "Athlete",
  "Bracket",
  "Announcement",
  "User",
  "Requirement",
];

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function summariseChange(entry: {
  event: string;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
}) {
  if (entry.event === "created") return "record created";
  if (entry.event === "deleted") return "moved to trash";
  if (entry.event === "force_deleted") return "permanently deleted";
  if (entry.event === "restored") return "restored from trash";
  const keys = Object.keys(entry.newValues ?? {}).filter(
    (k) => k !== "_redacted",
  );
  const redacted = (entry.newValues?._redacted as string[] | undefined) ?? [];
  return [...keys, ...redacted].join(", ") || "no visible fields";
}

// ── Recycle bin ────────────────────────────────────────────────────────────
function RecycleBin() {
  const trashQuery = useTrash();
  const restore = useRestoreTrashItem();

  const groups = useMemo(() => {
    const data = trashQuery.data;
    if (!data) return [];
    return (Object.keys(KIND_LABEL) as TrashKind[])
      .map((kind) => ({ kind, items: data[kind] ?? [] }))
      .filter((g) => g.items.length > 0);
  }, [trashQuery.data]);

  const onRestore = (kind: TrashKind, item: TrashItem) => {
    restore.mutate(
      { kind, id: item.id },
      {
        onSuccess: () => toast.success(`Restored "${item.label}"`),
        onError: (e: any) => toast.error(e?.message || "Restore failed"),
      },
    );
  };

  if (trashQuery.isLoading)
    return <Loading fullScreen={false} message="Loading trash…" />;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Trash2 className="h-5 w-5 text-gray-400" />
          <CardTitle>Recycle Bin</CardTitle>
          <RefreshStatus
            fetching={trashQuery.isFetching && !trashQuery.isLoading}
            error={trashQuery.isRefetchError}
            onRetry={trashQuery.refetch}
          />
        </div>
        <CardDescription>
          Soft-deleted records. Restoring brings a row back exactly where it
          was; a bracket also restores the events removed with it.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {groups.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">
            The recycle bin is empty.
          </p>
        ) : (
          <div className="space-y-6">
            {groups.map(({ kind, items }) => (
              <div key={kind}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  {KIND_LABEL[kind]} · {items.length}
                </p>
                <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100">
                  {items.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-3 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-900">
                          {item.label}
                        </p>
                        <p className="truncate text-xs text-gray-400">
                          {item.detail} · deleted {fmt(item.deletedAt)}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={restore.isPending}
                        onClick={() => onRestore(kind, item)}
                      >
                        <Undo2 className="mr-1.5 h-3.5 w-3.5" />
                        Restore
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Audit trail ───────────────────────────────────────────────────────────
function AuditTrail() {
  const [type, setType] = useState<AuditLogFilters["type"] | "all">("all");
  const filters: AuditLogFilters = {
    limit: 100,
    ...(type !== "all" ? { type } : {}),
  };
  const logsQuery = useAuditLogs(filters);
  const logs = logsQuery.data?.logs ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-gray-400" />
            <CardTitle>Audit Trail</CardTitle>
            <RefreshStatus
              fetching={logsQuery.isFetching && !logsQuery.isLoading}
              error={logsQuery.isRefetchError}
              onRetry={logsQuery.refetch}
            />
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={type}
              onValueChange={(v) => setType(v as typeof type)}
            >
              <SelectTrigger className="h-8 w-[160px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All record types</SelectItem>
                {AUDIT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => logsQuery.refetch()}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <CardDescription>
          Every create, edit, delete and restore of a scored result, event,
          roster row, bracket, announcement, account or requirement review.
          Newest first.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {logsQuery.isLoading ? (
          <Loading fullScreen={false} message="Loading audit trail…" />
        ) : logs.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">No entries.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-[11px] uppercase tracking-wide text-gray-400">
                  <th className="py-2 pr-3 font-medium">When</th>
                  <th className="py-2 pr-3 font-medium">Who</th>
                  <th className="py-2 pr-3 font-medium">Action</th>
                  <th className="py-2 pr-3 font-medium">Record</th>
                  <th className="py-2 font-medium">Changed</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-gray-50 align-top"
                  >
                    <td className="whitespace-nowrap py-2 pr-3 text-xs text-gray-500">
                      {fmt(log.createdAt)}
                    </td>
                    <td className="py-2 pr-3 text-xs">
                      <span className="font-medium text-gray-800">
                        {log.userName ?? "System"}
                      </span>
                      {log.userRole && (
                        <span className="text-gray-400"> · {log.userRole}</span>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      <Badge
                        className={`text-[11px] ${EVENT_STYLE[log.event] ?? "bg-gray-100 text-gray-600"}`}
                      >
                        {log.event.replace("_", " ")}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3 text-xs text-gray-600">
                      {log.auditableType}
                      <span className="ml-1 text-gray-300">
                        #{log.auditableId.slice(0, 8)}
                      </span>
                    </td>
                    <td className="py-2 text-xs text-gray-500">
                      {summariseChange(log)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {logsQuery.data?.nextCursor && (
              <p className="pt-3 text-center text-xs text-gray-400">
                Showing the {logs.length} most recent entries.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminTrash() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || user.role !== "admin") navigate("/login");
  }, [user, navigate]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Recovery &amp; Audit
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Restore deleted records and review the full history of changes.
        </p>
      </div>
      <div className="space-y-6">
        <RecycleBin />
        <AuditTrail />
      </div>
    </div>
  );
}
