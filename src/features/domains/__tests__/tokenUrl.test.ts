import { describe, expect, it } from "vitest";
import { buildTokenCreationUrl } from "../tokenUrl";

describe("buildTokenCreationUrl", () => {
  it("GitHub", () => {
    const url = buildTokenCreationUrl("github.com");
    expect(url).toContain("github.com/settings/tokens/new");
    expect(url).toContain("description=Strata");
    expect(url).not.toContain("LocalDrawDB");
  });

  it("GitLab", () => {
    const url = buildTokenCreationUrl("gitlab.com");
    expect(url).toContain("gitlab.com");
    expect(url).toContain("name=Strata");
    expect(url).not.toContain("LocalDrawDB");
  });

  it("Bitbucket", () => {
    expect(buildTokenCreationUrl("bitbucket.org")).toContain("bitbucket.org");
  });

  it("Azure DevOps", () => {
    expect(buildTokenCreationUrl("dev.azure.com")).toContain("dev.azure.com");
  });

  it("host desconhecido retorna null", () => {
    expect(buildTokenCreationUrl("git.empresa-interna.com")).toBeNull();
  });
});
