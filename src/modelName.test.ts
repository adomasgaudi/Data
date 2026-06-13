import { describe, it, expect } from "vitest";
import { modelLabelFor } from "./modelName";

describe("modelLabelFor", () => {
  it("formats each model branch into a clean label", () => {
    expect(modelLabelFor("opus-4.8")).toBe("Opus 4.8");
    expect(modelLabelFor("sonnet-4.6")).toBe("Sonnet 4.6");
    expect(modelLabelFor("haiku-4.5")).toBe("Haiku 4.5");
    expect(modelLabelFor("fable-5.0")).toBe("Fable 5.0");
  });

  it("handles deploy refs and separators", () => {
    expect(modelLabelFor("refs/heads/opus-4.8")).toBe("Opus 4.8");
    expect(modelLabelFor("OPUS-4.8")).toBe("Opus 4.8");
  });

  it("returns empty for non-model branches", () => {
    expect(modelLabelFor("main")).toBe("");
    expect(modelLabelFor("claude/strength-training-dashboard-SdAlT")).toBe("");
    expect(modelLabelFor("")).toBe("");
  });
});
