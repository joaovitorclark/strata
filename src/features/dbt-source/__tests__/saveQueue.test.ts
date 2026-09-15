import { describe, expect, it } from "vitest";

import { createDbtSaveQueue, type DbtChanges } from "../saveQueue";

function deferred() {
  let resolve!: () => void;
  let reject!: (e: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("dbt save queue (review of D2)", () => {
  it("R3: never runs two writes at once; changes queued mid-flight go in the next write, latest wins", async () => {
    const calls: DbtChanges[] = [];
    const gates = [deferred(), deferred()];
    let inFlight = 0;
    let maxInFlight = 0;
    const q = createDbtSaveQueue(async (c) => {
      calls.push(c);
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await gates[calls.length - 1].promise;
      inFlight--;
    });

    void q.enqueue({ "models/a.yml": "v1" });
    void q.enqueue({ "models/a.yml": "v2", "models/b.yml": "b1" });
    void q.enqueue({ "models/a.yml": "v3" });
    gates[0].resolve();
    await Promise.resolve();
    await Promise.resolve();
    gates[1].resolve();
    await q.idle();

    expect(maxInFlight).toBe(1);
    expect(calls).toEqual([
      { "models/a.yml": "v1" },
      { "models/a.yml": "v3", "models/b.yml": "b1" },
    ]);
  });

  it("R3: a failed write is retried with the next change, without overwriting newer content", async () => {
    const calls: DbtChanges[] = [];
    const states: string[] = [];
    let fail = true;
    const gate = deferred();
    const q = createDbtSaveQueue(
      async (c) => {
        calls.push(c);
        if (fail) {
          await gate.promise;
          throw new Error("disk full");
        }
      },
      (s) => states.push(s),
    );

    const first = q.enqueue({ "models/a.yml": "v1", "models/b.yml": "b1" });
    void q.enqueue({ "models/a.yml": "v2" });
    gate.resolve();
    await first;
    expect(states.at(-1)).toBe("error");
    expect(q.pending).toEqual({ "models/a.yml": "v2", "models/b.yml": "b1" });

    fail = false;
    await q.enqueue({ "models/c.yml": null });
    expect(calls.at(-1)).toEqual({
      "models/a.yml": "v2",
      "models/b.yml": "b1",
      "models/c.yml": null,
    });
    expect(states.at(-1)).toBe("saved");
  });
});

describe("seed ↔ table mapping (review of D2 + S15)", () => {
  it("R5: a seed named after exactly one table of the project attaches to it; ambiguous names do not", async () => {
    const { fromDbtProject } = await import("../fromDbtProject");
    const files = {
      "dbt_project.yml": "name: d\nversion: '1.0.0'\nconfig-version: 2\n",
      "models/p/bronze/_sources.yml":
        "version: 2\nsources:\n  - name: bronze_p\n    schema: bronze\n    tables:\n      - name: canais\n        columns:\n          - name: id\n            data_type: bigint\n",
      "seeds/p/canais.csv": "id\n1\n2\n",
      "seeds/p/_canais.yml": "version: 2\nseeds:\n  - name: canais\n",
      "seeds/p/orfao.csv": "x\n1\n",
      ".strata/p/project.yml": "format_version: 1\nname: p\n",
    };
    const model = fromDbtProject(files, "p");
    const canais = model.tables.find((t) => t.name === "canais");
    expect(canais?.id).toBe("bronze.canais");
    expect(canais?.schema).toBe("bronze_p");
    const byTable = Object.fromEntries(model.records.map((r) => [r.table, r.rows.length]));
    expect(byTable["bronze.canais"]).toBe(2);
    expect(byTable["orfao"]).toBe(1);
  });
});
