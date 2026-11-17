import { DEMO_USER_IDS } from "@/mocks/users";
import type { StaffRole, TeaSettings } from "@/types";
import { audit, clone, currentActor, delay, state } from "./store";

export async function getSettings(): Promise<TeaSettings> {
  await delay();
  return clone(state.settings);
}

export type SettingsPatch = Partial<Omit<TeaSettings, "dataSources">>;

/** Admin only. Data source status is display-only and cannot be changed here. */
export async function updateSettings(patch: SettingsPatch): Promise<TeaSettings> {
  await delay();
  const actor = currentActor();
  if (actor.role !== "ADMIN") throw new Error("Only the Admin can change settings.");
  if (patch.weights) {
    const sum = Object.values(patch.weights).reduce((s, n) => s + n, 0);
    if (sum !== 100) throw new Error(`Scoring weights must add up to 100 (now ${sum}).`);
  }
  if (
    patch.minPreparationDays !== undefined &&
    (patch.minPreparationDays < 1 || patch.minPreparationDays > 60)
  ) {
    throw new Error("Minimum preparation days must be between 1 and 60.");
  }
  const changed = Object.keys(patch);
  state.settings = { ...state.settings, ...patch };
  audit({
    actorId: actor.id,
    category: "SETTINGS",
    action: "Settings updated",
    detail: `Changed: ${changed.join(", ")}.`,
  });
  return clone(state.settings);
}

/**
 * Admin only: change a staff member's role or active flag. Never touches credentials.
 * The three demo approvers keep fixed roles so the role switcher stays meaningful.
 */
export async function updateUser(userId: string, role: StaffRole, active: boolean): Promise<void> {
  await delay();
  const actor = currentActor();
  if (actor.role !== "ADMIN") throw new Error("Only the Admin can manage users.");
  const u = state.users.find((x) => x.id === userId);
  if (!u) throw new Error("User not found.");
  if ((DEMO_USER_IDS as readonly string[]).includes(u.id) && (u.role !== role || !active)) {
    throw new Error("Approver roles are fixed in this demo.");
  }
  const before = `${u.role}${u.active ? "" : " (inactive)"}`;
  u.role = role;
  u.active = active;
  audit({
    actorId: actor.id,
    category: "SETTINGS",
    action: "User updated",
    detail: `${u.name}: ${before} → ${role}${active ? "" : " (inactive)"}.`,
  });
}
