import { describe, it, expect } from "vitest";
import { escapeHtml } from "./html";

describe("escapeHtml", () => {
  it("escapes the five HTML-significant characters", () => {
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });
  it("neutralises a script-injection attempt", () => {
    expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;",
    );
  });
  it("leaves safe text untouched", () => {
    expect(escapeHtml("Bulgarian Split Squat")).toBe("Bulgarian Split Squat");
    expect(escapeHtml("")).toBe("");
  });
});
