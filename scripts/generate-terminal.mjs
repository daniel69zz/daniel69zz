#!/usr/bin/env node
// Genera assets/terminal.svg: una terminal animada estilo fastfetch con el logo de GitHub.
// Uso:   node scripts/generate-terminal.mjs
// Opcional: GITHUB_TOKEN=xxxx node scripts/generate-terminal.mjs  (sube el límite de la API)
//
// GitHub no ejecuta JavaScript en los README, así que toda la animación es CSS
// (@keyframes) dentro del propio SVG.

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Configuración: edita aquí lo que se muestra
// ---------------------------------------------------------------------------
const USER = 'daniel69zz';
const HOST = 'github';
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'terminal.svg');

// Líneas fijas. Las que dependen de la API se rellenan en buildInfo().
const STATIC_INFO = {
  name: 'Luis Daniel Rojas Caceres',
  kernel: 'Systems Engineering Student',
  role: 'Backend Developer',
  shell: 'zsh',
  languages: 'TypeScript, JavaScript, Python, C++, SQL',
  frameworks: 'NestJS, Node.js, React, Spring Boot',
  databases: 'PostgreSQL, MySQL, SQL Server',
  cloud: 'AWS, Oracle Cloud, Docker, Stellar',
  awards: '1st InnovaHack 2026, Stellar Elite',
  certs: 'AWS Cloud Practitioner, Cisco',
};

// Paleta (Tokyo Night)
const C = {
  bg: '#1a1b26',
  border: '#2f334d',
  text: '#c0caf5',
  muted: '#565f89',
  key: '#bb9af7',
  user: '#7aa2f7',
  prompt: '#9ece6a',
  logoTop: '#bb9af7',
  logoBottom: '#7aa2f7',
  blocks: ['#15161e', '#f7768e', '#9ece6a', '#e0af68', '#7aa2f7', '#bb9af7', '#7dcfff', '#a9b1d6'],
};

// Logo de GitHub en pixel art (22x22). '#' = píxel encendido.
const LOGO = [
  '........######........',
  '.....############.....',
  '....##############....',
  '...################...',
  '..####.########.####..',
  '.#####..######..#####.',
  '.####............####.',
  '.####............####.',
  '#####............#####',
  '#####............#####',
  '#####............#####',
  '#####............#####',
  '#####............#####',
  '######..........######',
  '.#######......#######.',
  '.####.###....########.',
  '.####........########.',
  '..###........#######..',
  '...######....######...',
  '....#####....#####....',
  '.....####....####.....',
  '........#....#........',
];

// ---------------------------------------------------------------------------
// Datos de GitHub
// ---------------------------------------------------------------------------
async function gh(path) {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'readme-terminal-generator' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (!res.ok) throw new Error(`GitHub API ${res.status} en ${path}: ${await res.text()}`);
  return res.json();
}

async function fetchStats() {
  const user = await gh(`/users/${USER}`);

  let stars = 0;
  for (let page = 1; page <= 10; page++) {
    const repos = await gh(`/users/${USER}/repos?per_page=100&page=${page}`);
    stars += repos.filter((r) => !r.fork).reduce((s, r) => s + r.stargazers_count, 0);
    if (repos.length < 100) break;
  }

  const prs = await gh(`/search/issues?q=author:${USER}+type:pr&per_page=1`);

  return {
    repos: user.public_repos,
    followers: user.followers,
    createdAt: new Date(user.created_at),
    stars,
    prs: prs.total_count,
  };
}

function uptime(since) {
  const now = new Date();
  let months = (now.getFullYear() - since.getFullYear()) * 12 + (now.getMonth() - since.getMonth());
  if (now.getDate() < since.getDate()) months--;
  const y = Math.floor(months / 12);
  const m = months % 12;
  const parts = [];
  if (y) parts.push(`${y} year${y === 1 ? '' : 's'}`);
  if (m || !y) parts.push(`${m} month${m === 1 ? '' : 's'}`);
  return parts.join(', ');
}

function buildInfo(s) {
  return [
    ['OS', 'GitHub Profile'],
    ['Host', `github.com/${USER}`],
    ['Kernel', STATIC_INFO.kernel],
    ['Uptime', uptime(s.createdAt)],
    ['Packages', `${plural(s.repos, 'repo')}, ${plural(s.stars, 'star')}`],
    ['Shell', STATIC_INFO.shell],
    ['Name', STATIC_INFO.name],
    ['Role', STATIC_INFO.role],
    ['Languages', STATIC_INFO.languages],
    ['Frameworks', STATIC_INFO.frameworks],
    ['Databases', STATIC_INFO.databases],
    ['Cloud', STATIC_INFO.cloud],
    ['Awards', STATIC_INFO.awards],
    ['Certs', STATIC_INFO.certs],
    ['Social', `${plural(s.followers, 'follower')}, ${plural(s.prs, 'pull request')}`],
  ];
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// ---------------------------------------------------------------------------
// SVG
// ---------------------------------------------------------------------------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const len = (s) => [...s].length;

// Métrica fija: cada texto lleva textLength para que no dependa de la fuente del sistema.
const FONT = 14;
const CW = 8.4; // ancho de carácter monoespaciado (0.6em)
const LH = 20;
const PAD = 24;
const TITLE_H = 34;
const PX = 8; // tamaño de cada píxel del logo

const W = 760;
const LOGO_X = PAD;
const INFO_X = PAD + LOGO[0].length * PX + 34;

// Tiempos de la animación (segundos)
const T = {
  typeStart: 0.6,
  perChar: 0.09,
  outputGap: 0.3,
  logoRow: 0.035,
  infoLine: 0.11,
};

function text(x, y, content, n, extra = '') {
  return `<text x="${x}" y="${y}" textLength="${(n * CW).toFixed(1)}" lengthAdjust="spacing"${extra}>${content}</text>`;
}

function promptSpans() {
  return `<tspan fill="${C.prompt}">${USER}@${HOST}</tspan><tspan fill="${C.text}">:</tspan><tspan fill="${C.user}">~</tspan><tspan fill="${C.text}">$ </tspan>`;
}

function render(info) {
  const promptLen = len(`${USER}@${HOST}:~$ `);
  const cmd = 'fastfetch';
  const typeEnd = T.typeStart + cmd.length * T.perChar;
  const outStart = typeEnd + T.outputGap;

  const y0 = TITLE_H + 30; // primera línea (comando)
  const outTop = y0 + 16; // inicio de la salida
  const infoY0 = outTop + 16;

  const parts = [];

  // --- Línea 1: prompt + "fastfetch" tecleado -------------------------------
  const cmdX = PAD + promptLen * CW;
  parts.push(text(PAD, y0, promptSpans(), promptLen));
  parts.push(text(cmdX, y0, `<tspan fill="${C.text}">${cmd}</tspan>`, cmd.length));
  // Tapa del color del fondo que se desliza revelando letra por letra
  parts.push(
    `<rect class="cover" x="${cmdX}" y="${y0 - 15}" width="${cmd.length * CW + CW}" height="${LH}" fill="${C.bg}"/>`,
  );
  parts.push(`<rect class="cursor1" x="${cmdX}" y="${y0 - 13}" width="${CW}" height="17" fill="${C.text}"/>`);

  // --- Logo, fila por fila -------------------------------------------------
  const logoH = LOGO.length * PX;
  const logoTop = outTop + 6;
  LOGO.forEach((row, j) => {
    const rects = [];
    for (let i = 0; i < row.length; i++) {
      if (row[i] !== '#') continue;
      // une píxeles contiguos en un solo rect
      let k = i;
      while (k + 1 < row.length && row[k + 1] === '#') k++;
      rects.push(`<rect x="${LOGO_X + i * PX}" y="${logoTop + j * PX}" width="${(k - i + 1) * PX}" height="${PX}"/>`);
      i = k;
    }
    const delay = (outStart + j * T.logoRow).toFixed(3);
    parts.push(`<g class="fade" style="animation-delay:${delay}s" fill="url(#logo)">${rects.join('')}</g>`);
  });

  // --- Información ---------------------------------------------------------
  const header = `${USER}@${HOST}`;
  const lines = [
    { content: `<tspan fill="${C.user}">${USER}</tspan><tspan fill="${C.text}">@</tspan><tspan fill="${C.user}">${HOST}</tspan>`, n: len(header) },
    { content: `<tspan fill="${C.muted}">${'-'.repeat(len(header))}</tspan>`, n: len(header) },
    ...info.map(([k, v]) => ({
      content: `<tspan fill="${C.key}">${esc(k)}</tspan><tspan fill="${C.text}">: ${esc(v)}</tspan>`,
      n: len(`${k}: ${v}`),
    })),
  ];
  lines.forEach((l, i) => {
    const delay = (outStart + 0.15 + i * T.infoLine).toFixed(3);
    parts.push(text(INFO_X, infoY0 + i * LH, l.content, l.n, ` class="fade" style="animation-delay:${delay}s"`));
  });

  // --- Bloques de color (como fastfetch) -----------------------------------
  const blocksY = infoY0 + lines.length * LH - 6;
  const blocksDelay = outStart + 0.15 + lines.length * T.infoLine;
  const blocks = C.blocks
    .map((c, i) => `<rect x="${INFO_X + i * 3 * CW}" y="${blocksY}" width="${3 * CW}" height="${LH - 2}" fill="${c}"/>`)
    .join('');
  parts.push(`<g class="fade" style="animation-delay:${blocksDelay.toFixed(3)}s">${blocks}</g>`);

  // --- Prompt final con cursor parpadeante ---------------------------------
  const outBottom = Math.max(blocksY + LH, logoTop + logoH);
  const yEnd = outBottom + 30;
  const endDelay = blocksDelay + 0.3;
  parts.push(
    `<g class="fade" style="animation-delay:${endDelay.toFixed(3)}s">${text(PAD, yEnd, promptSpans(), promptLen)}` +
      `<rect class="blink" style="animation-delay:${endDelay.toFixed(3)}s" x="${PAD + promptLen * CW}" y="${yEnd - 13}" width="${CW}" height="17" fill="${C.text}"/></g>`,
  );

  const H = yEnd + PAD;
  const n = cmd.length;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="t">
<title id="t">${esc(`${USER}@${HOST}: fastfetch`)}</title>
<defs>
  <linearGradient id="logo" x1="0" y1="${logoTop}" x2="0" y2="${logoTop + logoH}" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="${C.logoTop}"/><stop offset="1" stop-color="${C.logoBottom}"/>
  </linearGradient>
</defs>
<style>
  text { font: ${FONT}px ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace; white-space: pre; }
  .fade { opacity: 0; animation: fade .25s ease-out forwards; }
  .cover { animation: type ${(n * T.perChar).toFixed(2)}s steps(${n}) ${T.typeStart}s forwards; }
  .cursor1 { animation: type ${(n * T.perChar).toFixed(2)}s steps(${n}) ${T.typeStart}s forwards, hide .01s ${(typeEnd + 0.2).toFixed(2)}s forwards; }
  .blink { animation: blink 1s step-end infinite; }
  @keyframes fade { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: none; } }
  @keyframes type { to { transform: translateX(${(n * CW).toFixed(1)}px); } }
  @keyframes hide { to { opacity: 0; } }
  @keyframes blink { 50% { opacity: 0; } }
  @media (prefers-reduced-motion: reduce) {
    .fade { animation: none; opacity: 1; }
    .cover, .cursor1 { display: none; }
  }
</style>
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="10" fill="${C.bg}" stroke="${C.border}"/>
<circle cx="22" cy="18" r="6" fill="#ff5f57"/><circle cx="42" cy="18" r="6" fill="#febc2e"/><circle cx="62" cy="18" r="6" fill="#28c840"/>
${parts.join('\n')}
</svg>
`;
}

// ---------------------------------------------------------------------------
const stats = await fetchStats();
await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, render(buildInfo(stats)));
console.log(`SVG generado en ${OUT}`);
console.log(stats);
