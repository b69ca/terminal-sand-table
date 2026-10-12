import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createTable, step, analyze, render, renderSVG } from '../src/index.js';
const cli = args => spawnSync(process.execPath, ['src/cli.js', ...args], { encoding: 'utf8' });
test('seeded tables are reproducible and batch stepping matches single steps', () => {
  const a = createTable(), b = createTable(); step(a, 100); for (let i = 0; i < 100; i++) step(b); assert.deepEqual(a, b);
  assert.notDeepEqual(a.cells, step(createTable({ seed: 12 }), 100).cells);
});
test('grains are conserved including injection, and walls never move', () => {
  for (const preset of ['dunes', 'hourglass']) {
    const t = createTable({ width: 30, height: 20, preset }); const rocks = [...t.cells].flatMap((c, id) => c === 2 ? [id] : []);
    for (let n = 0; n < 500; n++) { step(t); const r = analyze(t); assert.equal(r.grains, r.initialGrains + r.injected); assert.ok(r.moved <= r.grains); }
    for (const id of rocks) assert.equal(t.cells[id], 2);
    assert.ok(t.cells.every(c => [0, 1, 2].includes(c)));
  }
});
test('without pouring sand settles and wind chooses between open diagonals', () => {
  const t = createTable({ preset: 'dunes', pouring: false }); step(t, 300); assert.equal(t.moved, 0); assert.equal(t.injected, 0);
  for (const wind of [-1, 1]) {
    const x = 10, y = 2, t = createTable({ width: 20, height: 12, preset: 'dunes', pouring: false }); t.cells.fill(0); t.cells[y * 20 + x] = 1; t.cells[(y + 1) * 20 + x] = 2; t.wind = wind; step(t);
    assert.equal(t.cells[(y + 1) * 20 + x + wind], 1); assert.equal(t.cells[y * 20 + x], 0);
  }
});
test('each grain descends at most one row per step and a full source cannot inject', () => {
  const t = createTable({ width: 20, height: 12, preset: 'dunes', pouring: false }); t.cells.fill(0); t.cells[20 + 10] = 1; step(t); assert.equal(t.cells[40 + 10], 1); assert.equal(t.cells[60 + 10], 0);
  const blocked = createTable(); for (let x = 1; x < blocked.width - 1; x++) { blocked.cells[blocked.width + x] = 1; blocked.cells[2 * blocked.width + x] = 2; } step(blocked); assert.equal(blocked.injected, 0);
});
test('arguments are validated and renderers produce plain output and SVG', () => {
  for (const options of [{ width: 11 }, { seed: -1 }, { preset: 'bad' }, { pouring: 1 }]) assert.throws(() => createTable(options));
  assert.throws(() => step(createTable(), -1)); const t = createTable({ width: 20, height: 12 });
  const rows = render(t).split('\n'); assert.equal(rows.length, 12); assert.ok(rows.every(r => r.length === 20)); assert.equal(render(t).includes('\x1b'), false); assert.match(renderSVG(t), /^<svg/);
});
test('CLI supports summary, snapshots, validation, and SVG writes', () => {
  const r = cli(['--steps', '100', '--json']); assert.equal(r.status, 0); assert.equal(JSON.parse(r.stdout).frame, 100);
  assert.equal(cli([]).stdout.includes('\x1b'), false);
  for (const args of [['--seed'], ['--preset', 'bad'], ['--steps', '-1'], ['--frames', '1', '--json'], ['--wat']]) assert.equal(cli(args).status, 2);
  const dir = mkdtempSync(join(tmpdir(), 'sand-')); try { const file = join(dir, 'x.svg'); assert.equal(cli(['--svg', file]).status, 0); assert.match(readFileSync(file, 'utf8'), /SAND TABLE/); assert.equal(cli(['--svg', join(dir, 'missing', 'x.svg')]).status, 2); } finally { rmSync(dir, { recursive: true, force: true }); }
});
