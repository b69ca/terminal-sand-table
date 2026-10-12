#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { createTable, step, analyze, render, renderSVG } from './index.js';
import { parse, integer, terminal } from './terminal.js';
const args = process.argv.slice(2);
if (args.includes('--help')) { console.log('Usage: terminal-sand-table [--preset hourglass|dunes] [--seed N] [--width N] [--height N] [--steps N] [--frames N] [--no-pour] [--json] [--svg FILE] [--no-color]\nControls: p pause, . step, s pouring, [/] wind, 1/2 presets, n seed, r reset, +/- speed, q quit'); process.exit(0); }
try {
  const options = parse(args, ['--preset', '--seed', '--width', '--height', '--steps', '--frames', '--svg'], ['--no-pour']);
  const live = !!(process.stdout.isTTY && process.stdin.isTTY && !options['--json'] && !options['--svg']);
  const width = integer(options, '--width', live ? Math.max(12, Math.min(80, (process.stdout.columns || 80) - 1)) : 60, 120);
  const height = integer(options, '--height', live ? Math.max(12, Math.min(36, (process.stdout.rows || 32) - 4)) : 30, 120);
  let seed = integer(options, '--seed', 42, 0xffffffff), preset = options['--preset'] || 'hourglass', paused = false, delay = 50;
  const make = () => createTable({ width, height, seed, preset, pouring: !options['--no-pour'] }); let table = make();
  const frames = integer(options, '--frames', live ? Infinity : 1, 100000); step(table, integer(options, '--steps', 0, 10000));
  if (options['--json'] || options['--svg']) {
    if (options['--frames'] !== undefined) throw new Error('--frames is only for terminal output');
    if (options['--svg']) await writeFile(options['--svg'], renderSVG(table));
    if (options['--json']) console.log(JSON.stringify(analyze(table), null, 2));
  } else await terminal({ live, frames, interval: () => delay,
    onKey: key => {
      if (key === 'p' || key === ' ') paused = !paused;
      else if (key === '.') { paused = true; step(table); }
      else if (key === 's') table.pouring = !table.pouring;
      else if (key === '[' || key === ']') table.wind = Math.max(-1, Math.min(1, table.wind + (key === ']' ? 1 : -1)));
      else if (key === 'n') { seed = (seed + 1) >>> 0; table = make(); }
      else if (key === 'r') table = make();
      else if (key === '1' || key === '2') { preset = key === '1' ? 'hourglass' : 'dunes'; table = make(); }
      else if (key === '+' || key === '=') delay = Math.max(10, Math.floor(delay / 2));
      else if (key === '-') delay = Math.min(1000, delay * 2);
    }, onTick: () => { if (paused) return false; step(table); return true; },
    draw: () => { const r = analyze(table); return `SAND TABLE | ${preset} | seed ${seed} | frame ${r.frame}${paused ? ' PAUSED' : ''}\n${render(table, { color: live && !options['--no-color'] && !process.env.NO_COLOR })}\n${r.grains} grains | pour ${table.pouring ? 'on' : 'off'} wind ${table.wind} | p pause s pour . step r reset q quit`; }
  });
} catch (error) { console.error(`terminal-sand-table: ${error.message}`); process.exitCode = 2; }
