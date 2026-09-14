/**
 * G8: projectFormat + GET /api/projects/:id união dbml | dbt.
 * Não altera asserções de projectsRoutes.test.ts.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'strata-dbt-format-'));
  process.env.LOCALDRAWDB_DATA_DIR = tmpDir;
  vi.resetModules();
});

afterEach(async () => {
  delete process.env.LOCALDRAWDB_DATA_DIR;
  vi.resetModules();
  await fs.rm(tmpDir, { recursive: true, force: true });
});

async function buildApp() {
  const { default: Fastify } = await import('fastify');
  const { registerRoutes } = await import('../routes.ts');
  const app = Fastify();
  await registerRoutes(app);
  return app;
}

describe('G8 projectFormat + GET union', () => {
  it('projectFormat is dbml when .strata/<slug>/project.yml is absent', async () => {
    const { ensureRegistry, projectFormat } = await import('../files.ts');
    await ensureRegistry();
    expect(await projectFormat('default')).toBe('dbml');
  });

  it('projectFormat is dbt when .strata/<slug>/project.yml exists', async () => {
    const { ensureRegistry, createProject, projectFormat } = await import('../files.ts');
    await ensureRegistry();
    const meta = await createProject('vendas');
    await fs.mkdir(path.join(tmpDir, '.strata', meta.slug), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, '.strata', meta.slug, 'project.yml'),
      'format_version: 1\nname: vendas\n',
      'utf8',
    );
    expect(await projectFormat(meta.slug)).toBe('dbt');
  });

  it('GET /api/projects/:id returns format dbml additively for legacy projects', async () => {
    const app = await buildApp();
    const listRes = await app.inject({ method: 'GET', url: '/api/projects' });
    const { projects } = listRes.json() as { projects: { id: string }[] };
    const res = await app.inject({ method: 'GET', url: `/api/projects/${projects[0].id}` });
    await app.close();
    expect(res.statusCode).toBe(200);
    const body = res.json() as { format?: string; dbml: string; canvas: unknown };
    expect(typeof body.dbml).toBe('string');
    expect(body.format).toBe('dbml');
    expect(body.canvas).toBeDefined();
  });

  it('GET /api/projects/:id returns format dbt and files for a dbt project', async () => {
    const { ensureRegistry, createProject } = await import('../files.ts');
    await ensureRegistry();
    const meta = await createProject('vendas');
    await fs.mkdir(path.join(tmpDir, '.strata', meta.slug), { recursive: true });
    await fs.mkdir(path.join(tmpDir, 'models', meta.slug, 'bronze'), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, '.strata', meta.slug, 'project.yml'),
      'format_version: 1\nname: vendas\n',
      'utf8',
    );
    await fs.writeFile(path.join(tmpDir, 'dbt_project.yml'), 'name: strata\n', 'utf8');
    await fs.writeFile(
      path.join(tmpDir, 'models', meta.slug, 'bronze', '_sources.yml'),
      'version: 2\n',
      'utf8',
    );

    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: `/api/projects/${meta.id}` });
    await app.close();
    expect(res.statusCode).toBe(200);
    const body = res.json() as { format: string; files: Record<string, string>; dbml?: string };
    expect(body.format).toBe('dbt');
    expect(body.files['dbt_project.yml']).toContain('name: strata');
    expect(body.files[`.strata/${meta.slug}/project.yml`]).toContain('format_version');
    expect(body.files[`models/${meta.slug}/bronze/_sources.yml`]).toContain('version: 2');
    expect(body.dbml).toBeUndefined();
  });

  it('PUT /api/projects/:id is a no-op for dbt projects', async () => {
    const { ensureRegistry, createProject } = await import('../files.ts');
    await ensureRegistry();
    const meta = await createProject('vendas');
    const yml = path.join(tmpDir, '.strata', meta.slug, 'project.yml');
    await fs.mkdir(path.dirname(yml), { recursive: true });
    await fs.writeFile(yml, 'format_version: 1\nname: vendas\n', 'utf8');
    await fs.writeFile(path.join(tmpDir, 'dbt_project.yml'), 'name: strata\n', 'utf8');
    const before = await fs.readFile(yml, 'utf8');

    const app = await buildApp();
    const res = await app.inject({
      method: 'PUT',
      url: `/api/projects/${meta.id}`,
      payload: { dbml: 'Table hack { id int }\n', canvas: {} },
    });
    await app.close();
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    expect(await fs.readFile(yml, 'utf8')).toBe(before);
    expect(await fs.readFile(path.join(tmpDir, 'dbt_project.yml'), 'utf8')).toBe('name: strata\n');
  });
});
