import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Lock, Plus, X, Database, Mail, HardDrive, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/tea/app-shell";
import { Pill } from "@/components/tea/badges";
import { useRole } from "@/components/tea/role-context";
import { useSettings, useTeaAction, useUsers } from "@/hooks/use-tea";
import { updateSettings, updateUser } from "@/services";
import { formatPngShort } from "@/lib/deadline";
import { cn } from "@/lib/utils";
import type { DataSourceHealth, ScoringWeights, StaffRole, TeaSettings } from "@/types";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings | TEA – GREEN DigitALL" },
      {
        name: "description",
        content: "Discovery keywords, scoring weights, users and data source status.",
      },
    ],
  }),
  component: SettingsPage,
});

const WEIGHT_LABEL: Record<keyof ScoringWeights, string> = {
  scopeFit: "Scope fit",
  countryFit: "Country fit",
  agencyHistory: "Agency history",
  valueSize: "Contract value",
  timeToPrepare: "Time to prepare",
};

const ROLE_NAME: Record<StaffRole, string> = {
  CEO: "CEO (approver)",
  SOLUTION_LEAD: "Solution Engineering Lead (approver)",
  ADMIN: "Admin",
  STAFF: "Staff (can own tenders)",
};

const DEMO_APPROVERS = new Set(["u-bernard", "u-kowsalya", "u-zain"]);

function SettingsPage() {
  const { user } = useRole();
  const { data, isLoading } = useSettings();
  const isAdmin = user.role === "ADMIN";
  const [draft, setDraft] = useState<TeaSettings | null>(null);
  useEffect(() => {
    if (data) setDraft(structuredClone(data));
  }, [data]);
  const save = useTeaAction(updateSettings, "Settings saved");

  if (isLoading || !data || !draft) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  const weightSum = Object.values(draft.weights).reduce((s, n) => s + n, 0);
  const dirty =
    JSON.stringify({ ...draft, dataSources: [] }) !== JSON.stringify({ ...data, dataSources: [] });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Settings"
        description="What TEA looks for, how the AI scores tenders, and who works in TEA."
        actions={
          isAdmin ? (
            <>
              <Button
                variant="ghost"
                disabled={!dirty}
                onClick={() => setDraft(structuredClone(data))}
              >
                Discard
              </Button>
              <Button
                disabled={!dirty || weightSum !== 100 || save.pending}
                onClick={() => {
                  const { dataSources: _ignored, ...patch } = draft;
                  void save.run(patch);
                }}
              >
                Save changes
              </Button>
            </>
          ) : undefined
        }
      />

      {!isAdmin && (
        <p className="flex items-center gap-2 rounded-lg border bg-muted px-4 py-3 text-sm text-muted-foreground">
          <Lock className="size-4" /> Read-only. Only the Admin (Zain) can change settings.
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <ChipEditor
          title="Keywords"
          description="Notices matching these words are imported."
          values={draft.keywords}
          editable={isAdmin}
          onChange={(keywords) => setDraft({ ...draft, keywords })}
        />
        <ChipEditor
          title="Countries"
          description="Countries we deliver in."
          values={draft.countries}
          editable={isAdmin}
          onChange={(countries) => setDraft({ ...draft, countries })}
        />
        <ChipEditor
          title="Agencies"
          description="UN agencies to watch."
          values={draft.agencies}
          editable={isAdmin}
          onChange={(agencies) => setDraft({ ...draft, agencies })}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">AI scoring weights</CardTitle>
            <CardDescription>
              How much each factor counts in the AI score (0–100). Must add up to 100.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(Object.keys(WEIGHT_LABEL) as (keyof ScoringWeights)[]).map((k) => (
              <div key={k} className="grid grid-cols-[8.5rem_1fr_3rem] items-center gap-3">
                <Label htmlFor={`w-${k}`} className="text-sm">
                  {WEIGHT_LABEL[k]}
                </Label>
                <Slider
                  id={`w-${k}`}
                  min={0}
                  max={60}
                  step={5}
                  value={[draft.weights[k]]}
                  disabled={!isAdmin}
                  onValueChange={([v]) =>
                    setDraft({ ...draft, weights: { ...draft.weights, [k]: v ?? 0 } })
                  }
                  aria-label={WEIGHT_LABEL[k]}
                />
                <span className="text-right font-semibold tabular-nums">{draft.weights[k]}</span>
              </div>
            ))}
            <p
              className={cn(
                "text-right text-sm font-semibold",
                weightSum === 100 ? "text-status-green" : "text-status-red",
              )}
            >
              Total {weightSum} / 100{weightSum !== 100 && " — adjust to 100 to save"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="minprep">Minimum preparation days</Label>
              <Input
                id="minprep"
                type="number"
                min={1}
                max={60}
                value={draft.minPreparationDays}
                disabled={!isAdmin}
                onChange={(e) => setDraft({ ...draft, minPreparationDays: Number(e.target.value) })}
              />
              <p className="text-xs text-muted-foreground">
                Tenders closing sooner are flagged by the AI.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="marginwarn">Margin warning below (%)</Label>
              <Input
                id="marginwarn"
                type="number"
                min={0}
                max={80}
                value={draft.marginWarningPct}
                disabled={!isAdmin}
                onChange={(e) => setDraft({ ...draft, marginWarningPct: Number(e.target.value) })}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <UsersCard isAdmin={isAdmin} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Data sources</CardTitle>
          <CardDescription>
            Status only. Connections are managed by the backend; no credentials are entered here.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {data.dataSources.map((d) => {
            const Icon =
              d.kind === "API"
                ? Database
                : d.kind === "EMAIL"
                  ? Mail
                  : d.kind === "AI"
                    ? Bot
                    : HardDrive;
            const tone: Record<DataSourceHealth, ["green" | "amber" | "red" | "slate", string]> = {
              OK: ["green", "Healthy"],
              DEGRADED: ["amber", "Degraded"],
              DOWN: ["red", "Down"],
              NOT_CONFIGURED: ["slate", "Not configured"],
            };
            const [t, label] = tone[d.health];
            return (
              <div key={d.id} className="flex gap-3 rounded-md border p-3">
                <Icon className="mt-0.5 size-5 text-muted-foreground" />
                <div className="min-w-0 flex-1 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{d.name}</span>
                    <Pill tone={t}>{label}</Pill>
                  </div>
                  <p className="text-muted-foreground">{d.detail}</p>
                  {d.lastSyncAt && (
                    <p className="text-xs text-muted-foreground">
                      Last sync {formatPngShort(d.lastSyncAt)}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function ChipEditor({
  title,
  description,
  values,
  editable,
  onChange,
}: {
  title: string;
  description: string;
  values: string[];
  editable: boolean;
  onChange: (v: string[]) => void;
}) {
  const [input, setInput] = useState("");
  const add = () => {
    const v = input.trim();
    if (v && !values.some((x) => x.toLowerCase() === v.toLowerCase())) onChange([...values, v]);
    setInput("");
  };
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="flex flex-wrap gap-1.5">
          {values.map((v) => (
            <li
              key={v}
              className="inline-flex items-center gap-1 rounded-full border bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground"
            >
              {v}
              {editable && (
                <button
                  type="button"
                  onClick={() => onChange(values.filter((x) => x !== v))}
                  aria-label={`Remove ${v}`}
                  className="rounded-full hover:text-status-red"
                >
                  <X className="size-3" />
                </button>
              )}
            </li>
          ))}
        </ul>
        {editable && (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              add();
            }}
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Add ${title === "Countries" ? "country" : title === "Agencies" ? "agency" : "keyword"}`}
              aria-label={`Add to ${title}`}
            />
            <Button
              type="submit"
              variant="outline"
              size="icon"
              disabled={!input.trim()}
              aria-label="Add"
            >
              <Plus />
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function UsersCard({ isAdmin }: { isAdmin: boolean }) {
  const { data: users } = useUsers();
  const action = useTeaAction(updateUser, "User updated");
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Users and roles</CardTitle>
        <CardDescription>
          Sign-in is handled by the company identity provider, not TEA. Approver roles for the three
          demo users are fixed.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table className="min-w-[640px]">
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users?.map((u) => {
              const fixed = DEMO_APPROVERS.has(u.id);
              const canEdit = isAdmin && !fixed;
              return (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell className="text-sm">{u.title}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    {canEdit ? (
                      <Select
                        value={u.role}
                        onValueChange={(r) => void action.run(u.id, r as StaffRole, u.active)}
                      >
                        <SelectTrigger className="h-8 w-56" aria-label={`Role of ${u.name}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="STAFF">{ROLE_NAME.STAFF}</SelectItem>
                          <SelectItem value="ADMIN">{ROLE_NAME.ADMIN}</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-sm">{ROLE_NAME[u.role]}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={u.active}
                      disabled={!canEdit}
                      onCheckedChange={(a) => void action.run(u.id, u.role, a)}
                      aria-label={`${u.name} active`}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
