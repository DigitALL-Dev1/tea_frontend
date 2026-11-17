import { beforeEach, describe, expect, it } from "vitest";
import { gateHash, latestApproval } from "@/lib/workflow";
import {
  assignOwners,
  decideGate,
  getMyApprovals,
  getTender,
  getTenders,
  resetDemoData,
  setPrice,
  startAiAnalysis,
  switchDemoUser,
  updateProposalSection,
  updateRequirement,
  getAuditLog,
} from "@/services";

const FAO = "t-fao-138792";
const UNDP_PNG = "t-undp-png-044";
const UNICEF_FJI = "t-unicef-fji-019";
const UNICEF_PNG = "t-unicef-png-087";
const WHO = "t-who-png-033";
const UNOPS_FJI = "t-unops-fji-058";

async function hashFor(id: string, gate: Parameters<typeof gateHash>[1], subjectId?: string) {
  const t = await getTender(id);
  return gateHash(t!, gate, subjectId);
}

beforeEach(() => {
  resetDemoData();
});

describe("mock data", () => {
  it("has 8 tenders including the FAO tender with Amendment No.2", async () => {
    const all = await getTenders();
    expect(all).toHaveLength(8);
    const fao = all.find((t) => t.id === FAO)!;
    expect(fao.reference).toBe("2026/FRETH/FRZIM/138792");
    expect(fao.deadlineNotice).toBe("18-Nov-2026 16:00 (GMT 2.00)");
    expect(fao.timeline.some((e) => e.title === "Amendment No.2" && e.material)).toBe(true);
  });

  it("Amendment No.2 voided G2 and G4 and moved FAO back to G2, keeping G1 and G3", async () => {
    const fao = (await getTender(FAO))!;
    expect(fao.stage).toBe("G2_TECHNICAL");
    expect(latestApproval(fao, "G2")?.state).toBe("VOIDED");
    expect(latestApproval(fao, "G4")?.state).toBe("VOIDED");
    expect(latestApproval(fao, "G1")?.state).toBe("APPROVED");
    expect(latestApproval(fao, "G3")?.state).toBe("APPROVED");
  });
});

describe("roles", () => {
  it("only shows each role its own gates", async () => {
    await switchDemoUser("u-bernard", { silent: true });
    const ceo = await getMyApprovals();
    expect(new Set(ceo.map((p) => p.gate))).toEqual(new Set(["G1", "G3", "G5", "GC"]));

    await switchDemoUser("u-kowsalya", { silent: true });
    const ko = await getMyApprovals();
    expect(new Set(ko.map((p) => p.gate))).toEqual(new Set(["SR", "G2", "G4"]));

    await switchDemoUser("u-zain", { silent: true });
    expect(await getMyApprovals()).toHaveLength(0);
  });

  it("refuses a price approval from the Solution Engineering Lead", async () => {
    await switchDemoUser("u-kowsalya", { silent: true });
    await expect(
      decideGate({
        tenderId: UNDP_PNG,
        gate: "G3",
        decision: "APPROVE",
        reason: "ok",
        expectedHash: await hashFor(UNDP_PNG, "G3"),
      }),
    ).rejects.toThrow(/role/);
  });

  it("only lets the CEO set the price", async () => {
    await switchDemoUser("u-kowsalya", { silent: true });
    await expect(setPrice(UNDP_PNG, 130000)).rejects.toThrow(/CEO/);
  });

  it("blocks G4 for the person who prepared the package", async () => {
    await switchDemoUser("u-kowsalya", { silent: true });
    const mine = await getMyApprovals();
    expect(mine.find((p) => p.tenderId === UNICEF_FJI)?.blockedReason).toMatch(/prepared/);
    await expect(
      decideGate({
        tenderId: UNICEF_FJI,
        gate: "G4",
        decision: "APPROVE",
        reason: "ok",
        expectedHash: await hashFor(UNICEF_FJI, "G4"),
      }),
    ).rejects.toThrow(/prepared/);
  });
});

describe("gates", () => {
  it("requires a reason", async () => {
    await switchDemoUser("u-bernard", { silent: true });
    await expect(
      decideGate({
        tenderId: WHO,
        gate: "G1",
        decision: "APPROVE",
        reason: "  ",
        expectedHash: await hashFor(WHO, "G1"),
      }),
    ).rejects.toThrow(/reason/);
  });

  it("requires a fuller reason when the CEO disagrees with the AI at G1", async () => {
    await switchDemoUser("u-bernard", { silent: true });
    const h = await hashFor(WHO, "G1");
    await expect(
      decideGate({ tenderId: WHO, gate: "G1", decision: "REJECT", reason: "No", expectedHash: h }),
    ).rejects.toThrow(/AI/);
    const a = await decideGate({
      tenderId: WHO,
      gate: "G1",
      decision: "REJECT",
      reason: "Translation partner cannot be secured in time.",
      expectedHash: h,
    });
    expect(a.overrodeAi).toBe(true);
    expect((await getTender(WHO))!.stage).toBe("NO_BID");
  });

  it("ties each approval to the version hash and refuses a stale hash", async () => {
    await switchDemoUser("u-bernard", { silent: true });
    await expect(
      decideGate({
        tenderId: WHO,
        gate: "G1",
        decision: "APPROVE",
        reason: "Go",
        expectedHash: "stale",
      }),
    ).rejects.toThrow(/changed/);
    const a = await decideGate({
      tenderId: WHO,
      gate: "G1",
      decision: "APPROVE",
      reason: "Go",
      expectedHash: await hashFor(WHO, "G1"),
    });
    expect(a.versionHash).toHaveLength(64);
    expect((await getTender(WHO))!.stage).toBe("AI_DRAFTING");
  });

  it("voids G5 and moves the stage back when approved content changes", async () => {
    await switchDemoUser("u-bernard", { silent: true });
    await decideGate({
      tenderId: UNICEF_PNG,
      gate: "G5",
      decision: "APPROVE",
      reason: "Release",
      expectedHash: await hashFor(UNICEF_PNG, "G5"),
    });
    expect((await getTender(UNICEF_PNG))!.stage).toBe("SUBMISSION");

    // Back before release: edit at G3 on another tender
    await setPrice(UNDP_PNG, 135000);
    await decideGate({
      tenderId: UNDP_PNG,
      gate: "G3",
      decision: "APPROVE",
      reason: "ok",
      expectedHash: await hashFor(UNDP_PNG, "G3"),
    });
    expect((await getTender(UNDP_PNG))!.stage).toBe("G4_FINAL_QA");
    await setPrice(UNDP_PNG, 130000);
    const t = (await getTender(UNDP_PNG))!;
    expect(latestApproval(t, "G3")?.state).toBe("VOIDED");
    expect(t.stage).toBe("COSTING_G3");
  });

  it("voids technical approval when a proposal section is edited", async () => {
    await switchDemoUser("u-kowsalya", { silent: true });
    const before = (await getTender(UNICEF_FJI))!;
    await updateProposalSection(UNICEF_FJI, before.proposal[2]!.id, "Changed text");
    const t = (await getTender(UNICEF_FJI))!;
    expect(latestApproval(t, "G2")?.state).toBe("VOIDED");
    expect(t.stage).toBe("G2_TECHNICAL");
  });

  it("will not mark an unverified quote as Met", async () => {
    await switchDemoUser("u-kowsalya", { silent: true });
    const t = (await getTender(FAO))!;
    const unverified = t.requirements.find((r) => !r.quoteVerified)!;
    await expect(updateRequirement(FAO, unverified.id, { status: "MET" })).rejects.toThrow(
      /Verify/,
    );
  });

  it("needs an owner and a different backup before leaving Discovered", async () => {
    await switchDemoUser("u-kowsalya", { silent: true });
    await expect(startAiAnalysis(UNOPS_FJI)).rejects.toThrow(/owner/);
    await expect(assignOwners(UNOPS_FJI, "u-michael", "u-michael")).rejects.toThrow(/different/);
    await assignOwners(UNOPS_FJI, "u-michael", "u-kowsalya");
    expect((await startAiAnalysis(UNOPS_FJI)).stage).toBe("AI_ANALYSIS");
  });

  it("writes every action to the audit log", async () => {
    await switchDemoUser("u-kowsalya", { silent: true });
    const before = (await getAuditLog({ tenderId: UNOPS_FJI })).length;
    await assignOwners(UNOPS_FJI, "u-michael", "u-kowsalya");
    const after = await getAuditLog({ tenderId: UNOPS_FJI });
    expect(after.length).toBe(before + 1);
    expect(after[0]!.action).toBe("Owners assigned");
  });
});
