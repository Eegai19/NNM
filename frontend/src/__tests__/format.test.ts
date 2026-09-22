import { describe, expect, it } from "vitest";

import {
  activityStatusTone,
  completionPercent,
  deploymentStateTone,
  formatDate,
  formatFileSize,
  humanize,
  initials,
  nodeStatusTone,
} from "@/utils/format";

describe("formatDate", () => {
  it("renders an em dash for empty values", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
    expect(formatDate("")).toBe("—");
  });

  it("renders an em dash for an unparseable value", () => {
    expect(formatDate("not-a-date")).toBe("—");
  });

  it("formats a valid ISO timestamp", () => {
    expect(formatDate("2026-03-14T10:00:00Z")).toMatch(/2026/);
  });
});

describe("formatFileSize", () => {
  it("shows bytes below 1 KB", () => {
    expect(formatFileSize(512)).toBe("512 B");
  });

  it("scales to KB and MB", () => {
    expect(formatFileSize(2048)).toBe("2.0 KB");
    expect(formatFileSize(5 * 1024 * 1024)).toBe("5.0 MB");
  });

  it("handles a missing size", () => {
    expect(formatFileSize(null)).toBe("—");
  });
});

describe("humanize", () => {
  it("turns screaming snake case into title case", () => {
    expect(humanize("IN_PROGRESS")).toBe("In Progress");
    expect(humanize("NOT_STARTED")).toBe("Not Started");
    expect(humanize("LIVE")).toBe("Live");
  });
});

describe("initials", () => {
  it("takes at most two initials", () => {
    expect(initials("Eegai Engineer")).toBe("EE");
    expect(initials("Priya")).toBe("P");
    expect(initials("A B C D")).toBe("AB");
  });
});

describe("completionPercent", () => {
  it("returns 0 when there are no activities", () => {
    expect(completionPercent(0, 0)).toBe(0);
  });

  it("rounds to the nearest percent", () => {
    expect(completionPercent(1, 3)).toBe(33);
    expect(completionPercent(3, 4)).toBe(75);
    expect(completionPercent(4, 4)).toBe(100);
  });
});

describe("status tones", () => {
  it("maps deployment states to the right tone", () => {
    expect(deploymentStateTone("LIVE")).toBe("success");
    expect(deploymentStateTone("ON_HOLD")).toBe("warning");
    expect(deploymentStateTone("CANCELLED")).toBe("danger");
    expect(deploymentStateTone("PLANNED")).toBe("muted");
  });

  it("maps node and activity statuses", () => {
    expect(nodeStatusTone("COMPLETED")).toBe("success");
    expect(nodeStatusTone("BLOCKED")).toBe("danger");
    expect(activityStatusTone("Completed")).toBe("success");
    expect(activityStatusTone("Pending")).toBe("warning");
  });
});
