import { describe, it, expect } from "vitest";
import {
  collectBackup,
  parseBackup,
  applyBackup,
  mergeStoredValue,
  backupToText,
  backupFilename,
  type StorageLike,
} from "./backup";

/** A tiny in-memory localStorage stand-in for tests. */
class FakeStorage implements StorageLike {
  private m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.m.has(k) ? (this.m.get(k) as string) : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  /** test helper */
  snapshot() {
    return Object.fromEntries(this.m);
  }
}

function seeded(): FakeStorage {
  const s = new FakeStorage();
  s.setItem("colosseum.exerciseCodes.v1", JSON.stringify({ "Pull-up": "PU" }));
  s.setItem("colosseum.manualSets.v1", JSON.stringify([{ id: "a", reps: 5 }]));
  s.setItem("colosseum.notComparableNotes.v1", JSON.stringify(["HSPU::wall"]));
  s.setItem("colosseum.theme", "dark");
  s.setItem("colosseum.__autobackupAt.v1", "2026-01-01T00:00:00.000Z"); // must be skipped
  s.setItem("unrelated.key", "x"); // must be ignored (no prefix)
  return s;
}

describe("collectBackup", () => {
  it("captures every colosseum.* key except bookkeeping, and ignores foreign keys", () => {
    const b = collectBackup(seeded(), "b.2.5.22", new Date("2026-06-06T10:00:00Z"));
    expect(b.app).toBe("colosseum");
    expect(b.kind).toBe("full-backup");
    expect(b.appVersion).toBe("b.2.5.22");
    expect(b.exportedAt).toBe("2026-06-06T10:00:00.000Z");
    expect(Object.keys(b.data).sort()).toEqual([
      "colosseum.exerciseCodes.v1",
      "colosseum.manualSets.v1",
      "colosseum.notComparableNotes.v1",
      "colosseum.theme",
    ]);
    expect(b.data["colosseum.__autobackupAt.v1"]).toBeUndefined();
    expect(b.data["unrelated.key"]).toBeUndefined();
  });
});

describe("parseBackup", () => {
  it("round-trips a real backup", () => {
    const b = collectBackup(seeded());
    const parsed = parseBackup(backupToText(b));
    expect(parsed.data).toEqual(b.data);
  });

  it("rejects non-JSON", () => {
    expect(() => parseBackup("not json {")).toThrow(/JSON/);
  });

  it("rejects a JSON file that isn't a Colosseum backup", () => {
    expect(() => parseBackup(JSON.stringify({ hello: "world" }))).toThrow(/Colosseum full backup|isn't a backup/);
  });

  it("drops non-string and non-prefixed entries defensively", () => {
    const text = JSON.stringify({
      app: "colosseum",
      kind: "full-backup",
      data: { "colosseum.ok.v1": "1", "colosseum.bad.v1": 42, "evil.key": "y" },
    });
    expect(parseBackup(text).data).toEqual({ "colosseum.ok.v1": "1" });
  });
});

describe("applyBackup", () => {
  it("merge restores backed-up keys and leaves others alone", () => {
    const b = collectBackup(seeded());
    const target = new FakeStorage();
    target.setItem("colosseum.theme", "light"); // will be overwritten
    target.setItem("colosseum.keepMe.v1", "stay"); // not in backup, must remain
    const res = applyBackup(target, b, "merge");
    expect(res.restored).toBe(Object.keys(b.data).length);
    expect(target.getItem("colosseum.theme")).toBe("dark");
    expect(target.getItem("colosseum.keepMe.v1")).toBe("stay");
    expect(target.getItem("colosseum.exerciseCodes.v1")).toBe(JSON.stringify({ "Pull-up": "PU" }));
  });

  it("replace wipes existing colosseum data first, except bookkeeping", () => {
    const b = collectBackup(seeded());
    const target = new FakeStorage();
    target.setItem("colosseum.stale.v1", "old"); // must be gone after replace
    target.setItem("colosseum.__autobackupOn.v1", "1"); // bookkeeping must survive
    applyBackup(target, b, "replace");
    expect(target.getItem("colosseum.stale.v1")).toBeNull();
    expect(target.getItem("colosseum.__autobackupOn.v1")).toBe("1");
    expect(target.getItem("colosseum.manualSets.v1")).toBe(JSON.stringify([{ id: "a", reps: 5 }]));
  });

  it("never writes bookkeeping or foreign keys even if present in the file", () => {
    const target = new FakeStorage();
    const tainted = {
      app: "colosseum" as const,
      kind: "full-backup" as const,
      format: 1,
      exportedAt: "",
      data: { "colosseum.real.v1": "1", "colosseum.__autobackupOn.v1": "1" },
    };
    applyBackup(target, parseBackup(JSON.stringify(tainted)));
    expect(target.getItem("colosseum.real.v1")).toBe("1");
    expect(target.getItem("colosseum.__autobackupOn.v1")).toBeNull();
  });

  it("a full wipe + restore returns identical data (the cache-loss scenario)", () => {
    const original = seeded();
    const backup = collectBackup(original);
    const wiped = new FakeStorage(); // browser cache cleared — empty
    applyBackup(wiped, backup, "replace");
    // Every backed-up key is back, byte-for-byte.
    for (const [k, v] of Object.entries(backup.data)) expect(wiped.getItem(k)).toBe(v);
  });
});

describe("mergeStoredValue (deep)", () => {
  it("object maps: backup wins per entry, device-only entries kept", () => {
    const device = JSON.stringify({ a: "1", c: "device" });
    const backup = JSON.stringify({ a: "2", b: "backup" });
    expect(JSON.parse(mergeStoredValue(device, backup))).toEqual({ a: "2", c: "device", b: "backup" });
  });
  it("primitive arrays: union of both", () => {
    expect(JSON.parse(mergeStoredValue(JSON.stringify(["x", "y"]), JSON.stringify(["y", "z"])))).toEqual(["x", "y", "z"]);
  });
  it("scalars / mismatched / unparseable: backup wins", () => {
    expect(mergeStoredValue('"light"', '"dark"')).toBe('"dark"');
    expect(mergeStoredValue("not json", '{"a":1}')).toBe('{"a":1}');
  });
});

describe("applyBackup deep", () => {
  it("merges within a key — backup conflicts win, this-device-only edits survive", () => {
    const target = new FakeStorage();
    target.setItem("colosseum.setOverrides.v1", JSON.stringify({ setA: { reps: 5 }, setC: { reps: 9 } }));
    const backup = {
      app: "colosseum" as const, kind: "full-backup" as const, format: 1, exportedAt: "",
      data: { "colosseum.setOverrides.v1": JSON.stringify({ setA: { reps: 7 }, setB: { reps: 3 } }) },
    };
    applyBackup(target, backup, "deep");
    expect(JSON.parse(target.getItem("colosseum.setOverrides.v1")!)).toEqual({
      setA: { reps: 7 }, // backup wins the conflict
      setB: { reps: 3 }, // backup's new entry
      setC: { reps: 9 }, // this-device-only entry preserved
    });
  });
});

describe("backupFilename", () => {
  it("uses the date", () => {
    expect(backupFilename(new Date("2026-06-06T12:00:00Z"))).toBe("colosseum-backup-2026-06-06.json");
  });
});
