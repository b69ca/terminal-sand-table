export function createTable({ width = 60, height = 30, seed = 42, preset = 'hourglass', pouring = true } = {}) {
  if (![width, height].every(n => Number.isInteger(n) && n >= 12 && n <= 120)) throw new Error('dimensions must be integers from 12 to 120');
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff || !['hourglass', 'dunes'].includes(preset) || typeof pouring !== 'boolean') throw new Error('invalid seed, preset, or pouring flag');
  const cells = new Uint8Array(width * height), mid = Math.floor(width / 2);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (!x || x === width - 1 || y === height - 1) cells[y * width + x] = 2;
  if (preset === 'hourglass') {
    const neck = Math.floor(height * 0.45);
    for (let y = 3; y <= neck; y++) {
      const gap = Math.max(1, Math.floor((neck - y) * (width / 2 - 3) / Math.max(1, neck - 3)));
      for (let x = 1; x < width - 1; x++) if (x < mid - gap || x > mid + gap) cells[y * width + x] = 2;
    }
  } else for (let x = 1; x < width - 1; x++) {
    const mound = 2 + Math.floor((Math.sin(x * 0.23 + seed % 17) + 1) * height * 0.08);
    for (let y = height - 2; y >= height - 1 - mound; y--) cells[y * width + x] = 1;
  }
  const initialGrains = cells.reduce((n, c) => n + Number(c === 1), 0);
  return { width, height, seed, preset, pouring, cells, frame: 0, injected: 0, initialGrains, moved: 0, randomState: seed, wind: 0 };
}
export function step(table, count = 1) {
  if (!Number.isInteger(count) || count < 0 || count > 10000) throw new Error('step count must be an integer from 0 to 10000');
  const { width, height, cells } = table;
  for (let frame = 0; frame < count; frame++) {
    const processed = new Uint8Array(cells.length); let moved = 0;
    if (table.pouring) {
      table.randomState = (Math.imul(table.randomState, 1664525) + 1013904223) >>> 0;
      const x = Math.floor(width / 2) + (table.randomState % 5) - 2, id = width + x;
      if (!cells[id]) { cells[id] = 1; table.injected++; }
    }
    const reverse = table.frame % 2 === 1;
    for (let y = height - 2; y >= 0; y--) for (let column = 1; column < width - 1; column++) {
      const x = reverse ? width - 1 - column : column, id = y * width + x;
      if (cells[id] !== 1 || processed[id]) continue;
      const preferred = table.wind || ((x + y + table.frame + table.seed) % 2 ? 1 : -1);
      for (const dx of [0, preferred, -preferred]) {
        const target = (y + 1) * width + x + dx;
        if (!cells[target]) { cells[target] = 1; cells[id] = 0; processed[target] = 1; moved++; break; }
      }
    }
    table.moved = moved; table.frame++;
  }
  return table;
}
export function analyze(table) {
  const grains = table.cells.reduce((n, c) => n + Number(c === 1), 0);
  return { width: table.width, height: table.height, seed: table.seed, preset: table.preset, frame: table.frame, pouring: table.pouring, wind: table.wind, grains, initialGrains: table.initialGrains, injected: table.injected, moved: table.moved };
}
export function render(table, { color = false } = {}) {
  return Array.from({ length: table.height }, (_, y) => Array.from({ length: table.width }, (_, x) => {
    const c = table.cells[y * table.width + x], char = c === 1 ? 'o' : c === 2 ? '#' : ' ';
    return color && c ? `\x1b[${c === 1 ? 33 : 90}m${char}\x1b[0m` : char;
  }).join('')).join('\n');
}
export function renderSVG(table) {
  const size = 10, w = Math.max(640, table.width * size + 64), h = table.height * size + 130, r = analyze(table);
  const cells = [...table.cells].map((c, id) => !c ? '' : `<rect x="${32 + id % table.width * size}" y="${86 + Math.floor(id / table.width) * size}" width="${c === 1 ? 8 : 10}" height="${c === 1 ? 8 : 10}" rx="${c === 1 ? 2 : 0}" fill="${c === 1 ? '#ffd166' : '#293c56'}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="${Math.round(h * 800 / w)}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" rx="18" fill="#0d1525"/><g font-family="monospace"><text x="32" y="36" font-size="22" fill="#e8edf8">TERMINAL SAND TABLE</text><text x="32" y="62" font-size="12" fill="#93a4bc">${table.preset} / seed ${table.seed} / frame ${table.frame}</text>${cells}<text x="32" y="${h - 16}" font-size="12" fill="#93a4bc">${r.grains} grains / ${r.moved} moved / p pause . step s pour [ ] wind r reset q quit</text></g></svg>\n`;
}
