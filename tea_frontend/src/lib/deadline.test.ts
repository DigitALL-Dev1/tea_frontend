import { describe, expect, it } from "vitest";
import { deadlineFormats, parseNoticeDeadline, pngDateKey, timeLeft } from "./deadline";

describe("deadline conversion", () => {
  it("converts the FAO notice: 18-Nov-2026 16:00 (GMT 2.00) = 14:00 UTC = 00:00 on 19 Nov PNG", () => {
    const f = deadlineFormats("18-Nov-2026 16:00 (GMT 2.00)");
    expect(f.notice).toBe("18-Nov-2026 16:00 (GMT 2.00)");
    expect(f.utc).toBe("18-Nov-2026 14:00 UTC");
    expect(f.png).toBe("19-Nov-2026 00:00 PNG (UTC+10)");
    expect(f.utcIso).toBe("2026-11-18T14:00:00.000Z");
  });

  it("handles PNG's own offset (GMT 10.00) without change", () => {
    const f = deadlineFormats("24-Nov-2026 17:00 (GMT 10.00)");
    expect(f.utc).toBe("24-Nov-2026 07:00 UTC");
    expect(f.png).toBe("24-Nov-2026 17:00 PNG (UTC+10)");
  });

  it("handles negative offsets and day roll-over", () => {
    const f = deadlineFormats("01-Dec-2026 23:30 (GMT -5.00)");
    expect(f.utc).toBe("02-Dec-2026 04:30 UTC");
    expect(f.png).toBe("02-Dec-2026 14:30 PNG (UTC+10)");
  });

  it("reads the part after the dot as minutes (GMT 5.30 = UTC+05:30)", () => {
    expect(parseNoticeDeadline("10-Jan-2027 12:00 (GMT 5.30)").utc.toISOString()).toBe(
      "2027-01-10T06:30:00.000Z",
    );
  });

  it("handles +12 offsets that cross into the previous UTC day", () => {
    expect(deadlineFormats("28-Nov-2026 09:00 (GMT 12.00)").utc).toBe("27-Nov-2026 21:00 UTC");
  });

  it("accepts plain (GMT) and month/year roll-over", () => {
    expect(deadlineFormats("31-Dec-2026 20:00 (GMT)").png).toBe("01-Jan-2027 06:00 PNG (UTC+10)");
  });

  it("rejects text it cannot read", () => {
    expect(() => parseNoticeDeadline("18/11/2026 16:00")).toThrow();
    expect(() => parseNoticeDeadline("31-Feb-2026 10:00 (GMT 2.00)")).toThrow();
    expect(() => parseNoticeDeadline("18-Nov-2026 16:00 (GMT 2.75)")).toThrow();
  });
});

describe("time left", () => {
  const deadline = new Date("2026-11-18T14:00:00Z");

  it("flags deadlines under 7 days as short", () => {
    const t = timeLeft(deadline, new Date("2026-11-16T04:00:00Z"));
    expect(t.days).toBe(2);
    expect(t.isShort).toBe(true);
    expect(t.label).toBe("2d 10h left");
  });

  it("is not short at 7 days or more", () => {
    expect(timeLeft(deadline, new Date("2026-11-11T14:00:00Z")).isShort).toBe(false);
  });

  it("reports past deadlines", () => {
    const t = timeLeft(deadline, new Date("2026-11-18T15:30:00Z"));
    expect(t.isPast).toBe(true);
    expect(t.isShort).toBe(false);
    expect(t.label).toBe("Closed 1h 30m ago");
  });

  it("uses the PNG calendar day", () => {
    expect(pngDateKey(new Date("2026-11-18T14:00:00Z"))).toBe("2026-11-19");
    expect(pngDateKey(new Date("2026-11-18T13:59:00Z"))).toBe("2026-11-18");
  });
});
