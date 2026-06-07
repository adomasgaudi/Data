import { describe, it, expect } from "vitest";
import { versionParts, displayVersion, ESPADA_NAMES, CAPTAIN_NAMES } from "./versionName";

describe("version code-names (Bleach scheme)", () => {
  it("maps a v2 minor to its Espada zanpakutō (reverse rank), patch as v.N", () => {
    expect(versionParts("b.2.7.8")).toEqual({ name: "Arrogante", patch: "v.8" });
    expect(versionParts("b.2.6.74")).toEqual({ name: "Tiburón", patch: "v.74" });
    expect(versionParts("b.2.0.5")).toEqual({ name: "Glotonería", patch: "v.5" });
  });

  it("makes the FINAL v2 minor (9) Aizen's Kyōka Suigetsu", () => {
    expect(ESPADA_NAMES[9]).toBe("Kyōka Suigetsu");
    expect(versionParts("b.2.9.3")?.name).toBe("Kyōka Suigetsu");
  });

  it("keeps the 4th tweak digit inside the patch label", () => {
    expect(versionParts("b.2.7.8.3")).toEqual({ name: "Arrogante", patch: "v.8.3" });
  });

  it("a name-only era version (no patch) carries no v.N", () => {
    expect(versionParts("b.2.7")).toEqual({ name: "Arrogante", patch: "" });
  });

  it("switches to captain zanpakutō at major 3", () => {
    expect(versionParts("b.3.0.1")?.name).toBe(CAPTAIN_NAMES[0]);
    expect(versionParts("b.3.0.1")?.name).toBe("Sōgyo no Kotowari");
  });

  it("leaves pre-v2 / unknown labels untouched", () => {
    expect(versionParts("b.1.hi")).toBeNull();
    expect(versionParts("0.x")).toBeNull();
    expect(displayVersion("b.1.hi")).toBe("b.1.hi");
  });

  it("formats spans: same name collapses the patches, a name bump shows both", () => {
    expect(displayVersion("b.2.7.1–b.2.7.8")).toBe("Arrogante v.1–v.8");
    expect(displayVersion("b.2.7.8–b.2.8.2")).toBe("Arrogante v.8 – Los Lobos v.2");
  });

  it("a single full version displays as name + v.N", () => {
    expect(displayVersion("b.2.7.8")).toBe("Arrogante v.8");
  });
});
