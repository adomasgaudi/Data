import { describe, it, expect } from "vitest";
import { defaultBwCoeff, exerciseCategory } from "./profile";

describe("defaultBwCoeff", () => {
  it("gives high-leverage holds a small coefficient (added weight dominates)", () => {
    expect(defaultBwCoeff("Front Lever")).toBe(0.1);
    expect(defaultBwCoeff("Front lever tuck raise")).toBe(0.1);
    expect(defaultBwCoeff("Tuck planche")).toBe(0.1);
    expect(defaultBwCoeff("Human flag")).toBe(0.1);
    expect(defaultBwCoeff("Dragon flag")).toBe(0.15);
    expect(defaultBwCoeff("Leg raise straight 85cm")).toBe(0.1);
    expect(defaultBwCoeff("Hanging Leg Raise")).toBe(0.15);
  });

  it("treats a front-lever row as a front lever, not a row", () => {
    expect(defaultBwCoeff("Front lever row old")).toBe(0.1);
    expect(defaultBwCoeff("Bent Over Row")).toBe(0); // a real row is pure load
  });

  it("scores bodyweight pulling/pushing near full bodyweight", () => {
    expect(defaultBwCoeff("Pull Ups")).toBe(0.95);
    expect(defaultBwCoeff("Chin Ups")).toBe(0.95);
    expect(defaultBwCoeff("Muscle Ups")).toBe(1);
    expect(defaultBwCoeff("Dips")).toBe(0.9);
    expect(defaultBwCoeff("Handstand Push Ups")).toBe(0.9);
    expect(defaultBwCoeff("Push Ups")).toBe(0.65);
  });

  it("distinguishes machine/seated variants from standing bodyweight ones", () => {
    expect(defaultBwCoeff("Seated Dip Machine")).toBe(0); // sits, no bodyweight
    expect(defaultBwCoeff("Triceps Dip (Assisted)")).toBe(0.5);
    expect(defaultBwCoeff("Seated Calf Raise")).toBe(0);
    expect(defaultBwCoeff("Machine Calf Raise")).toBe(0.9);
    expect(defaultBwCoeff("Machine Back Extension")).toBe(0);
    expect(defaultBwCoeff("Back Extension")).toBe(0.4);
  });

  it("scores weighted leg work by how much bodyweight moves", () => {
    expect(defaultBwCoeff("Squat")).toBe(0.6);
    expect(defaultBwCoeff("Smith Machine Squat")).toBe(0.6);
    expect(defaultBwCoeff("Pistol Squat")).toBe(0.85);
    expect(defaultBwCoeff("Bulgarian Split Squat")).toBe(0.7);
    expect(defaultBwCoeff("Deadlift")).toBe(0.3);
    expect(defaultBwCoeff("Romanian Deadlift")).toBe(0.3);
    expect(defaultBwCoeff("Hip Thrust")).toBe(0.2);
  });

  it("returns 0 for pure-load isolation and non-lifts", () => {
    expect(defaultBwCoeff("Bench Press")).toBe(0);
    expect(defaultBwCoeff("Lat Pulldown")).toBe(0);
    expect(defaultBwCoeff("Barbell Curl")).toBe(0);
    expect(defaultBwCoeff("Sled Leg Press")).toBe(0);
    expect(defaultBwCoeff("Cold shower")).toBe(0);
    expect(defaultBwCoeff("Stretch split")).toBe(0);
  });
});

describe("exerciseCategory", () => {
  it("classifies the main muscle groups", () => {
    expect(exerciseCategory("Squat")).toBe("Legs");
    expect(exerciseCategory("Romanian Deadlift")).toBe("Legs");
    expect(exerciseCategory("Bench Press")).toBe("Chest");
    expect(exerciseCategory("Lat Pulldown")).toBe("Back");
    expect(exerciseCategory("Seated Shoulder Press")).toBe("Shoulders");
    expect(exerciseCategory("Barbell Curl")).toBe("Arms");
    expect(exerciseCategory("Hanging Leg Raise")).toBe("Core");
  });
  it("routes skills and non-lifts before muscle groups", () => {
    expect(exerciseCategory("Front lever row old")).toBe("Skill");
    expect(exerciseCategory("Handstand")).toBe("Skill");
    expect(exerciseCategory("Handstand Push Ups")).toBe("Shoulders"); // push-up trains shoulders
    expect(exerciseCategory("Stretch split")).toBe("Mobility");
    expect(exerciseCategory("Bike machine Cardio")).toBe("Cardio");
  });
  it("falls back to Other for the noise", () => {
    expect(exerciseCategory("Cold shower")).toBe("Mobility");
    expect(exerciseCategory("KG - track food")).toBe("Other");
  });
});
