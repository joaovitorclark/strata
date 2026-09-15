import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { lockSha256, parseGeneratedLock, serializeGeneratedLock } from "../dbtSource/lock.ts";

describe("server/dbtSource/lock", () => {
  it("lockSha256 matches node:crypto and round-trips YAML", () => {
    const content = "select 1 as id\n";
    expect(lockSha256(content)).toBe(createHash("sha256").update(content, "utf8").digest("hex"));
    const lock = {
      "models/demo/main/nova.sql": { sha256: lockSha256(content), generator_version: "0.1.0" },
    };
    expect(parseGeneratedLock(serializeGeneratedLock(lock))).toEqual(lock);
  });
});
