/**
 * Tender services. Each function is async and returns plain data so it can later be
 * replaced by an HTTP call with the same signature. Every action writes an audit entry.
 */
import { aiAnalysisFor, aiDraftSections, aiExtractRequirements } from "@/mocks/tenders";
import { parseNoticeDeadline } from "@/lib/deadline";
import { sha256Hex } from "@/lib/sha256";
import {
  costTotal,
  gateHash,
  isGateValid,
  marginPct,
  ownersValid,
  packageHash,
} from "@/lib/workflow";
import type { DraftEmail, Outcome, RequirementStatus, Tender, TenderStage } from "@/types";
import { AI_ACTOR_ID } from "@/types";
import {
  advanceFrom,
  applyAmendmentToTender,
  assertEditable,
  audit,
  clone,
  currentActor,
  delay,
  findTender,
  newId,
  reconcile,
  setStage,
  state,
  sweepDeadlines,
  userName,
} from "./store";

function requireWorker() {
  const actor = currentActor();
  if (actor.role === "ADMIN") throw new Error("The Admin role manages settings only.");
  return actor;
}

// ---------- reads ----------

export async function getTenders(): Promise<Tender[]> {
  await delay();
  sweepDeadlines();
  return clone(state.tenders);
}

export async function getTender(id: string): Promise<Tender | null> {
  await delay();
  sweepDeadlines();
  const t = state.tenders.find((x) => x.id === id);
  return t ? clone(t) : null;
}

// ---------- ownership and early workflow ----------

export async function assignOwners(
  tenderId: string,
  ownerId: string,
  backupOwnerId: string,
): Promise<Tender> {
  await delay();
  const actor = requireWorker();
  const t = findTender(tenderId);
  if (!ownerId || !backupOwnerId) throw new Error("Choose both an owner and a backup owner.");
  if (ownerId === backupOwnerId) throw new Error("The backup owner must be a different person.");
  t.ownerId = ownerId;
  t.backupOwnerId = backupOwnerId;
  audit({
    actorId: actor.id,
    category: "WORKFLOW",
    action: "Owners assigned",
    detail: `Owner ${userName(ownerId)}, backup ${userName(backupOwnerId)}.`,
    tenderId,
  });
  return clone(t);
}

/** Discovered → AI analysis. Needs an owner and a different backup owner. */
export async function startAiAnalysis(tenderId: string): Promise<Tender> {
  await delay();
  const actor = requireWorker();
  const t = findTender(tenderId);
  if (t.stage !== "DISCOVERED" && t.stage !== "AI_ANALYSIS")
    throw new Error("AI analysis has already run.");
  if (!ownersValid(t))
    throw new Error("Assign an owner and a different backup owner before moving past Discovered.");
  setStage(t, "AI_ANALYSIS", actor.id, "Sent to the AI analyst agent.");
  return clone(t);
}

/** Demo stand-in for the AI agent finishing its analysis. */
export async function completeAiAnalysis(tenderId: string): Promise<Tender> {
  await delay(400);
  requireWorker();
  const t = findTender(tenderId);
  if (t.stage !== "AI_ANALYSIS") throw new Error("The tender is not in AI analysis.");
  const now = new Date().toISOString();
  t.ai = t.ai ? { ...t.ai, generatedAt: now } : aiAnalysisFor(t, now);
  if (t.requirements.length === 0) t.requirements = aiExtractRequirements(t);
  audit({
    actorId: AI_ACTOR_ID,
    category: "AI",
    action: "AI analysis completed",
    detail: `Score ${t.ai.score}, recommendation ${t.ai.recommendation}. ${t.requirements.length} requirements extracted.`,
    tenderId,
  });
  setStage(t, "SUMMARY_REVIEW", AI_ACTOR_ID, "Waiting for summary review.");
  return clone(t);
}

/** Demo stand-in for the AI drafting agents finishing. The person confirming becomes the preparer. */
export async function completeAiDrafting(tenderId: string): Promise<Tender> {
  await delay(400);
  const actor = requireWorker();
  const t = findTender(tenderId);
  if (t.stage !== "AI_DRAFTING") throw new Error("The tender is not in AI drafting.");
  const now = new Date().toISOString();
  if (t.proposal.length === 0) {
    t.proposal = aiDraftSections(t, now);
    audit({
      actorId: AI_ACTOR_ID,
      category: "AI",
      action: "AI drafts created",
      detail: `${t.proposal.length} sections drafted (legal, admin, technical).`,
      tenderId,
    });
  }
  t.preparedById = actor.id;
  audit({
    actorId: actor.id,
    category: "CONTENT",
    action: "Drafts handed to technical review",
    detail: `${actor.name} is recorded as the package preparer.`,
    tenderId,
  });
  advanceFrom(t, "AI_DRAFTING", actor.id, "Drafts ready for G2.");
  return clone(t);
}

// ---------- requirements ----------

export async function updateRequirement(
  tenderId: string,
  requirementId: string,
  patch: { status?: RequirementStatus; response?: string; evidence?: string },
): Promise<Tender> {
  await delay();
  const actor = requireWorker();
  const t = findTender(tenderId);
  assertEditable(t);
  const r = t.requirements.find((x) => x.id === requirementId);
  if (!r) throw new Error("Requirement not found.");
  if (patch.status === "MET" && !r.quoteVerified) {
    throw new Error("Verify the quote against the source document before marking it Met.");
  }
  const changes: string[] = [];
  if (patch.status !== undefined && patch.status !== r.status) {
    changes.push(`status ${r.status} → ${patch.status}`);
    r.status = patch.status;
  }
  if (patch.response !== undefined && patch.response !== r.response) {
    changes.push("response");
    r.response = patch.response;
  }
  if (patch.evidence !== undefined && patch.evidence !== r.evidence) {
    changes.push("evidence");
    r.evidence = patch.evidence;
  }
  if (changes.length === 0) return clone(t);
  audit({
    actorId: actor.id,
    category: "CONTENT",
    action: "Requirement updated",
    detail: `${r.id}: ${changes.join(", ")}.`,
    tenderId,
  });
  reconcile(t, `requirement ${r.id} edited`, actor.id);
  return clone(t);
}

export async function verifyRequirementQuote(
  tenderId: string,
  requirementId: string,
): Promise<Tender> {
  await delay();
  const actor = requireWorker();
  const t = findTender(tenderId);
  assertEditable(t);
  const r = t.requirements.find((x) => x.id === requirementId);
  if (!r) throw new Error("Requirement not found.");
  r.quoteVerified = true;
  audit({
    actorId: actor.id,
    category: "CONTENT",
    action: "Quote verified",
    detail: `${r.id}: quote checked against the source document, page ${r.page}.`,
    tenderId,
  });
  reconcile(t, `requirement ${r.id} verified`, actor.id);
  return clone(t);
}

// ---------- proposal ----------

export async function updateProposalSection(
  tenderId: string,
  sectionId: string,
  body: string,
): Promise<Tender> {
  await delay();
  const actor = requireWorker();
  const t = findTender(tenderId);
  assertEditable(t);
  const s = t.proposal.find((x) => x.id === sectionId);
  if (!s) throw new Error("Section not found.");
  if (s.body === body) return clone(t);
  s.body = body;
  s.updatedAt = new Date().toISOString();
  audit({
    actorId: actor.id,
    category: "CONTENT",
    action: "Proposal section edited",
    detail: `"${s.title}" edited by ${actor.name}.`,
    tenderId,
  });
  reconcile(t, `proposal section "${s.title}" edited`, actor.id);
  return clone(t);
}

export async function addProposalComment(
  tenderId: string,
  sectionId: string,
  text: string,
): Promise<Tender> {
  await delay();
  const actor = requireWorker();
  const t = findTender(tenderId);
  const s = t.proposal.find((x) => x.id === sectionId);
  if (!s) throw new Error("Section not found.");
  if (!text.trim()) throw new Error("Write a comment first.");
  s.comments.push({
    id: newId("cm"),
    authorId: actor.id,
    authorName: actor.name,
    at: new Date().toISOString(),
    text: text.trim(),
  });
  audit({
    actorId: actor.id,
    category: "CONTENT",
    action: "Comment added",
    detail: `On "${s.title}".`,
    tenderId,
  });
  return clone(t);
}

// ---------- amendments and clarifications ----------

/**
 * Demo: record an amendment as if it arrived from UNGM. A material amendment adds a revised
 * document (and optionally a new deadline), which changes approved content and voids approvals.
 */
export async function recordAmendment(
  tenderId: string,
  input: { title: string; detail: string; material: boolean; newDeadlineNotice?: string },
): Promise<Tender> {
  await delay();
  const actor = requireWorker();
  const t = findTender(tenderId);
  assertEditable(t);
  if (!input.title.trim()) throw new Error("Give the amendment a title.");
  const at = new Date().toISOString();
  if (input.newDeadlineNotice) {
    parseNoticeDeadline(input.newDeadlineNotice); // throws if invalid
    audit({
      actorId: actor.id,
      category: "DISCOVERY",
      action: "Deadline changed",
      detail: `${t.deadlineNotice} → ${input.newDeadlineNotice} (${input.title}).`,
      tenderId,
    });
    t.deadlineNotice = input.newDeadlineNotice;
  }
  const fileName = `${input.title.replace(/[^A-Za-z0-9]+/g, "_")}.pdf`;
  applyAmendmentToTender(
    t,
    {
      at,
      title: input.title.trim(),
      detail: input.detail.trim() || "No details given.",
      material: input.material,
      document: {
        id: newId("doc"),
        fileName,
        sha256: sha256Hex(`${t.id}/${fileName}/${at}`),
        source: "AMENDMENT",
        scope: input.material ? "TENDER" : "PACKAGE",
        addedAt: at,
        sizeKb: 240,
      },
      requirementChanges: [],
    },
    actor.id,
  );
  // A deadline change alone also changes notice content.
  if (input.newDeadlineNotice && !input.material)
    reconcile(t, `${input.title} changed the deadline`, actor.id);
  return clone(t);
}

/** AI drafts a clarification question. It stays "Pending approval" until the CEO approves GC. */
export async function draftClarificationEmail(tenderId: string, question: string): Promise<Tender> {
  await delay(300);
  const actor = requireWorker();
  const t = findTender(tenderId);
  if (!question.trim()) throw new Error("Describe what needs clarifying.");
  const email: DraftEmail = {
    id: newId("em"),
    tenderId,
    kind: "CLARIFICATION",
    to: `procurement@${t.agency.toLowerCase()}.example`,
    subject: `${t.reference} – Clarification request`,
    body: `Dear ${t.agency} Procurement,\n\nWith reference to ${t.reference} ("${t.title}"), we would be grateful for clarification on the following point:\n\n${question.trim()}\n\nKind regards,\nGREEN DigitALL`,
    aiDrafted: true,
    status: "PENDING_APPROVAL",
    createdAt: new Date().toISOString(),
  };
  t.emails.push(email);
  audit({
    actorId: AI_ACTOR_ID,
    category: "EMAIL",
    action: "Email drafted",
    detail: `Clarification email drafted at the request of ${actor.name}. Pending GC approval.`,
    tenderId,
  });
  return clone(t);
}

export async function updateEmailBody(
  tenderId: string,
  emailId: string,
  body: string,
): Promise<Tender> {
  await delay();
  const actor = requireWorker();
  const t = findTender(tenderId);
  const e = t.emails.find((x) => x.id === emailId);
  if (!e) throw new Error("Email not found.");
  if (e.status === "SENT") throw new Error("This email has already been sent.");
  e.body = body;
  if (e.status === "RETURNED" || e.status === "REJECTED") e.status = "PENDING_APPROVAL";
  audit({
    actorId: actor.id,
    category: "EMAIL",
    action: "Email edited",
    detail: e.subject,
    tenderId,
  });
  reconcile(t, `email "${e.subject}" edited`, actor.id);
  return clone(t);
}

/** Sending is done by a person, and only after GC approval of this exact email. */
export async function markEmailSent(tenderId: string, emailId: string): Promise<Tender> {
  await delay();
  const actor = requireWorker();
  const t = findTender(tenderId);
  const e = t.emails.find((x) => x.id === emailId);
  if (!e) throw new Error("Email not found.");
  if (e.status !== "APPROVED" || !isGateValid(t, "GC", e.id)) {
    throw new Error("This email needs GC approval before it can be sent.");
  }
  e.status = "SENT";
  e.sentAt = new Date().toISOString();
  if (e.kind === "CLARIFICATION") {
    t.timeline.push({
      id: newId("tl"),
      kind: "CLARIFICATION_QUESTION",
      at: e.sentAt,
      title: "Question sent",
      detail: e.subject,
      material: false,
    });
  }
  const rfq = t.rfqs.find((r) => r.emailId === e.id);
  if (rfq) {
    rfq.status = "SENT";
    rfq.sentAt = e.sentAt;
  }
  audit({
    actorId: actor.id,
    category: "EMAIL",
    action: "Email sent",
    detail: `${e.subject} → ${e.to}`,
    tenderId,
    versionHash: gateHash(t, "GC", e.id),
  });
  return clone(t);
}

// ---------- costing ----------

/** CEO only. Sets the bid price; the margin follows from the cost sheet. */
export async function setPrice(tenderId: string, priceUsd: number): Promise<Tender> {
  await delay();
  const actor = currentActor();
  if (actor.role !== "CEO") throw new Error("Only the CEO can set price and margin.");
  const t = findTender(tenderId);
  assertEditable(t);
  if (!Number.isFinite(priceUsd) || priceUsd <= 0) throw new Error("Enter a price above zero.");
  const before = t.costing.priceUsd;
  t.costing.priceUsd = Math.round(priceUsd * 100) / 100;
  const m = marginPct(t.costing);
  audit({
    actorId: actor.id,
    category: "COSTING",
    action: "Price set",
    detail: `USD ${before?.toLocaleString("en-US") ?? "—"} → USD ${t.costing.priceUsd.toLocaleString("en-US")} (cost USD ${costTotal(t.costing).toLocaleString("en-US")}, margin ${m?.toFixed(1)}%).`,
    tenderId,
  });
  reconcile(t, "price changed", actor.id);
  return clone(t);
}

// ---------- submission and after ----------

export async function recordSubmission(
  tenderId: string,
  input: { receiptNumber: string; screenshotFileName: string },
): Promise<Tender> {
  await delay();
  const actor = requireWorker();
  const t = findTender(tenderId);
  if (t.stage !== "SUBMISSION")
    throw new Error("The package has not been released for submission.");
  if (!isGateValid(t, "G5"))
    throw new Error("The G5 release no longer matches this package. Re-approval needed.");
  if (!input.receiptNumber.trim()) throw new Error("Enter the UNGM receipt number.");
  if (!input.screenshotFileName.trim()) throw new Error("Attach the submission screenshot.");
  const hash = packageHash(t);
  t.submission = {
    submittedAt: new Date().toISOString(),
    submittedById: actor.id,
    receiptNumber: input.receiptNumber.trim(),
    screenshotFileName: input.screenshotFileName.trim(),
    packageHash: hash,
  };
  t.post = { outcome: "PENDING", lessonsLearned: "" };
  audit({
    actorId: actor.id,
    category: "SUBMISSION",
    action: "Submission recorded",
    detail: `Submitted by ${actor.name}. Receipt ${t.submission.receiptNumber}; screenshot ${t.submission.screenshotFileName}.`,
    tenderId,
    versionHash: hash,
  });
  setStage(t, "POST_SUBMISSION", actor.id, "Waiting for the agency's decision.");
  return clone(t);
}

export async function recordOutcome(
  tenderId: string,
  outcome: Exclude<Outcome, "PENDING">,
  lessonsLearned: string,
): Promise<Tender> {
  await delay();
  const actor = requireWorker();
  const t = findTender(tenderId);
  if (t.stage !== "POST_SUBMISSION")
    throw new Error("Outcome can only be recorded after submission.");
  t.post = { outcome, decidedAt: new Date().toISOString(), lessonsLearned: lessonsLearned.trim() };
  audit({
    actorId: actor.id,
    category: "SUBMISSION",
    action: outcome === "AWARDED" ? "Awarded" : "Not awarded",
    detail: lessonsLearned.trim() ? `Lessons: ${lessonsLearned.trim()}` : "No lessons recorded.",
    tenderId,
  });
  return clone(t);
}

/** Withdraw (CEO), archive (closed tenders) — always with a reason. */
export async function closeTender(
  tenderId: string,
  to: Extract<TenderStage, "WITHDRAWN" | "ARCHIVED">,
  reason: string,
): Promise<Tender> {
  await delay();
  const actor = requireWorker();
  const t = findTender(tenderId);
  if (!reason.trim()) throw new Error("A reason is required.");
  if (to === "WITHDRAWN" && actor.role !== "CEO")
    throw new Error("Only the CEO can withdraw a tender.");
  if (t.stage === to) return clone(t);
  setStage(t, to, actor.id, reason.trim());
  return clone(t);
}
