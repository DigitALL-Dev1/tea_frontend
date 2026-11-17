/** Roles that can be selected in the demo role switcher. */
export type UserRole = "CEO" | "SOLUTION_LEAD" | "ADMIN";

/** Every staff role known to TEA. STAFF members can own tenders but cannot approve gates. */
export type StaffRole = UserRole | "STAFF";

export interface User {
  id: string;
  name: string;
  title: string;
  role: StaffRole;
  initials: string;
  email: string;
  active: boolean;
}

/** A user that can be impersonated from the top-bar role switcher (demo only, no real login). */
export interface DemoUser extends User {
  role: UserRole;
}

/** The AI agent is recorded as an actor in the audit log, but it is never an approver. */
export const AI_ACTOR_ID = "ai-agent";
export const SYSTEM_ACTOR_ID = "system";
