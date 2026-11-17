/**
 * Public data API for the UI. Every function here is async and returns plain typed data.
 * To connect the real backend, re-implement these functions as API calls with the same
 * signatures; no UI code needs to change. (src/services/store.ts is mock-only.)
 */
export * from "./tenders";
export * from "./approvals";
export * from "./audit";
export * from "./settings";
export * from "./session";
export { resetStore as resetDemoData } from "./store";
