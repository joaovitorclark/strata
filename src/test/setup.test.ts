import { describe, expect, it } from "vitest";
import App from "@/App";

describe("test harness", () => {
  it("resolves the @/ alias", () => {
    expect(typeof App).toBe("function");
  });
});
