import { describe, it, expect } from "vitest";
import { parseCsv, parseCsvRows } from "./csv";

describe("parseCsvRows", () => {
  it("parses simple rows", () => {
    expect(parseCsvRows("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles quoted fields with commas and escaped quotes", () => {
    expect(parseCsvRows('a,b\n"x,y","he said ""hi"""')).toEqual([
      ["a", "b"],
      ["x,y", 'he said "hi"'],
    ]);
  });

  it("handles newlines inside quotes and \\r\\n line endings", () => {
    expect(parseCsvRows('a,b\r\n"line1\nline2",2\r\n')).toEqual([
      ["a", "b"],
      ["line1\nline2", "2"],
    ]);
  });
});

describe("parseCsv", () => {
  it("maps cells onto header keys", () => {
    const rows = parseCsv("user,weight,reps\nAda,100,5\nBob,,3");
    expect(rows).toEqual([
      { user: "Ada", weight: "100", reps: "5" },
      { user: "Bob", weight: "", reps: "3" },
    ]);
  });

  it("skips blank trailing lines", () => {
    expect(parseCsv("a,b\n1,2\n\n")).toHaveLength(1);
  });

  it("produces objects in exactly the shape the domain schema expects", () => {
    const csv =
      "user,username,date,bodyweight,exercise_name,set_number,weight,reps,notes,dropset,percentile\n" +
      "Adomas,adomasgaudi,2024-02-04,86.7,Bench Press,1,40,12,,FALSE,";
    const [row] = parseCsv(csv);
    expect(row).toMatchObject({
      user: "Adomas",
      username: "adomasgaudi",
      exercise_name: "Bench Press",
      weight: "40",
      dropset: "FALSE",
      percentile: "",
    });
  });
});
