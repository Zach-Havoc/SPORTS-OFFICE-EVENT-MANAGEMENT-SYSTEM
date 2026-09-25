import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../context/AuthContext";
import {
  useSeasons,
  useCreateSeason,
  useActivateSeason,
  useUpdateSeason,
  useDeleteSeason,
} from "../../hooks/api";
import type { Season } from "../../services/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import Loading from "../../components/Loading";
import { RefreshStatus } from "../../components/RefreshStatus";
import {
  CalendarRange,
  CheckCircle2,
  Pencil,
  Trash2,
  Plus,
} from "lucide-react";
import { toast } from "sonner";

function fmt(d: string | null) {
  return d
    ? new Date(d).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";
}

export default function AdminSeasons() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || user.role !== "admin") navigate("/login");
  }, [user, navigate]);

  const seasonsQuery = useSeasons();
  const create = useCreateSeason();
  const activate = useActivateSeason();
  const update = useUpdateSeason();
  const remove = useDeleteSeason();

  const [name, setName] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const seasons = seasonsQuery.data ?? [];

  const onCreate = () => {
    if (name.trim().length < 3) {
      toast.error("Give the season a name (at least 3 characters).");
      return;
    }
    create.mutate(
      { name: name.trim(), startsOn: startsOn || null, endsOn: endsOn || null },
      {
        onSuccess: () => {
          toast.success(`Created "${name.trim()}"`);
          setName("");
          setStartsOn("");
          setEndsOn("");
        },
        onError: (e: any) =>
          toast.error(e?.message || "Could not create the season"),
      },
    );
  };

  const onActivate = (s: Season) => {
    if (s.isActive) return;
    if (
      !confirm(
        `Make "${s.name}" the active season? The public boards will switch to it.`,
      )
    )
      return;
    activate.mutate(s.id, {
      onSuccess: () => toast.success(`"${s.name}" is now active`),
      onError: (e: any) => toast.error(e?.message || "Could not activate"),
    });
  };

  const onSaveEdit = (s: Season) => {
    update.mutate(
      { id: s.id, data: { name: editName.trim() } },
      {
        onSuccess: () => {
          toast.success("Renamed");
          setEditingId(null);
        },
        onError: (e: any) => toast.error(e?.message || "Could not rename"),
      },
    );
  };

  const onDelete = (s: Season) => {
    if (!confirm(`Delete "${s.name}"? This only works when it has no events.`))
      return;
    remove.mutate(s.id, {
      onSuccess: () => toast.success("Season deleted"),
      onError: (e: any) => toast.error(e?.message || "Could not delete"),
    });
  };

  if (seasonsQuery.isLoading)
    return <Loading fullScreen={false} message="Loading seasons…" />;

  return (
    <div className="page-container px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <CalendarRange className="h-5 w-5 text-gray-400" />
          <h1 className="t-page-title">
            Seasons
          </h1>
          <RefreshStatus
            fetching={seasonsQuery.isFetching && !seasonsQuery.isLoading}
            error={seasonsQuery.isRefetchError}
            onRetry={seasonsQuery.refetch}
          />
        </div>
        <p className="mt-1 text-sm text-gray-500">
          One tournament edition per school year. The active season is the
          default view on the public leaderboard, schedule and brackets. New
          events attach to it automatically.
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">New season</CardTitle>
          <CardDescription>
            Create the next edition. Activate it when you are ready to switch
            over.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Name
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="2026–2027 Intramurals"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Starts
              </label>
              <Input
                type="date"
                value={startsOn}
                onChange={(e) => setStartsOn(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Ends
              </label>
              <Input
                type="date"
                value={endsOn}
                onChange={(e) => setEndsOn(e.target.value)}
              />
            </div>
            <Button onClick={onCreate} disabled={create.isPending}>
              <Plus className="mr-1.5 h-4 w-4" />
              Create
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">All editions</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-gray-100">
            {seasons.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  {editingId === s.id ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-8 w-56"
                        autoFocus
                      />
                      <Button
                        size="sm"
                        onClick={() => onSaveEdit(s)}
                        disabled={update.isPending}
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">
                        {s.name}
                      </span>
                      {s.isActive && (
                        <Badge className="bg-emerald-100 text-emerald-700">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Active
                        </Badge>
                      )}
                    </div>
                  )}
                  <p className="mt-0.5 text-xs text-gray-400">
                    {fmt(s.startsOn)} – {fmt(s.endsOn)} · {s.eventCount} event
                    {s.eventCount === 1 ? "" : "s"}
                  </p>
                </div>
                {editingId !== s.id && (
                  <div className="flex items-center gap-1.5">
                    {!s.isActive && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => onActivate(s)}
                        disabled={activate.isPending}
                      >
                        Activate
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingId(s.id);
                        setEditName(s.name);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:bg-red-50"
                      onClick={() => onDelete(s)}
                      disabled={
                        s.isActive || s.eventCount > 0 || remove.isPending
                      }
                      title={
                        s.isActive
                          ? "Activate another season first"
                          : s.eventCount > 0
                            ? "This season has events"
                            : "Delete"
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
