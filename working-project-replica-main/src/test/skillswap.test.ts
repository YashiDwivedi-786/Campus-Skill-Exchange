import { describe, expect, it } from "vitest";
import { demoStudents, filterStudents, skillMatchPercent } from "@/lib/skillswap";

describe("SkillSwap discovery", () => {
  it("filters demo students by skill and category", () => {
    expect(filterStudents(demoStudents, "python", "Technology").map((student) => student.name)).toEqual([
      "Maya Chen",
      "Amir Patel",
    ]);
  });

  it("scores a two-way match as 100% when both offered and wanted skills overlap", () => {
    expect(skillMatchPercent(
      ["Python basics"],
      ["Figma & UI design"],
      demoStudents[0] ?? { teaches: [], learns: [] },
    )).toBe(100);
  });
});