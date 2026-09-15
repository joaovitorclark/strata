import { describe, expect, it } from "vitest";
import { writeDbtChanges, type DbtFs } from "../../../../server/dbtSource/io";

describe("D2 G6 atomic writeDbtChanges", () => {
  it("second of three writes failing leaves none of the three destinations on disk", async () => {
    const disk = new Map<string, string>();
    let writes = 0;
    const io: DbtFs = {
      mkdir: async () => undefined,
      writeFile: async (p, content) => {
        writes += 1;
        if (writes === 2) throw new Error("injected failure");
        disk.set(String(p), String(content));
      },
      rename: async (from, to) => {
        const v = disk.get(String(from));
        if (v === undefined) throw new Error(`missing tmp ${String(from)}`);
        disk.delete(String(from));
        disk.set(String(to), v);
      },
      unlink: async (p) => {
        disk.delete(String(p));
      },
    };

    await expect(
      writeDbtChanges(
        "/domain",
        {
          "models/a.yml": "a\n",
          "models/b.yml": "b\n",
          "models/c.yml": "c\n",
        },
        io,
      ),
    ).rejects.toThrow("injected failure");

    const dests = [...disk.keys()].filter((k) => !k.endsWith(".strata-tmp"));
    expect(dests).toEqual([]);
    expect([...disk.keys()].every((k) => k.endsWith(".strata-tmp"))).toBe(true);
    expect(disk.size).toBe(0);
  });

  it("rejects path traversal", async () => {
    const io: DbtFs = {
      mkdir: async () => undefined,
      writeFile: async () => undefined,
      rename: async () => undefined,
      unlink: async () => undefined,
    };
    await expect(writeDbtChanges("/domain", { "../secret": "x" }, io)).rejects.toThrow(/unsafe/);
  });
});
