/**
 * Demo session. There is no real login: the role switcher picks one of three demo users.
 * The real backend will replace this with its own authentication.
 */
import { MOCK_DEMO_USERS } from "@/mocks/users";
import type { DemoUser, Supplier, User } from "@/types";
import { audit, clone, currentActor, delay, state } from "./store";

export async function getDemoUsers(): Promise<DemoUser[]> {
  await delay(0);
  return clone(MOCK_DEMO_USERS);
}

export async function getUsers(): Promise<User[]> {
  await delay();
  return clone(state.users);
}

export async function getSuppliers(): Promise<Supplier[]> {
  await delay();
  return clone(state.suppliers);
}

export function getCurrentUser(): DemoUser {
  return clone(currentActor());
}

/** Switch the acting demo user. Logged in the audit trail. */
export async function switchDemoUser(
  userId: string,
  opts: { silent?: boolean } = {},
): Promise<DemoUser> {
  const u = MOCK_DEMO_USERS.find((x) => x.id === userId);
  if (!u) throw new Error("Unknown demo user.");
  const changed = state.currentUserId !== userId;
  state.currentUserId = userId;
  if (changed && !opts.silent) {
    audit({
      actorId: userId,
      category: "SESSION",
      action: "Demo role switched",
      detail: `Now acting as ${u.name} (${u.title}).`,
    });
  }
  return clone(u);
}
