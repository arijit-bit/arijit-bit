#!/usr/bin/env node
// Cinematic Shadow Ninja profile animation generator (zero dependencies, Node 18+).
//
// Features:
// - Exactly 5 movement rows / lanes (L1 to L5).
// - Ninja visual height spans approximately 2 rows (~60px tall).
// - Smooth continuous left-to-right cinematic progression.
// - Natural running cycle, parabolic jump over low spikes, low slide under overhead barrier.
// - 3 distinct blade sword attacks: Horizontal Slash, Diagonal Slice, and Overhead Cleave.
// - Dynamic blade trails, slash arcs, impact star flashes, directional sparks.
// - Enemies visibly split/react, shatter into particles, and respawn.
// - Dual theme support: ninja-dark.svg and ninja-light.svg.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const user = process.argv[2] || process.env.GITHUB_USER || "arijit-bit";
const outDir = process.argv[3] || "dist";

// ---------- scene layout constants ----------
const WIDTH = 920;
const HEIGHT = 180;
const ROWS = 5;
const ROW_H = 32;
const PAD_TOP = 10;
const GROUND_Y = PAD_TOP + ROWS * ROW_H; // 170

const COLS = 52;
const CELL_SIZE = 11;
const CELL_PITCH = 16;
const GRID_START_X = 44;

// ---------- palettes ----------
const PALETTES = {
  dark: {
    bg: "#0d1117",
    laneLine: "rgba(255, 255, 255, 0.07)",
    laneRowBg: [
      "rgba(22, 27, 34, 0.45)",
      "rgba(13, 17, 23, 0.25)",
      "rgba(22, 27, 34, 0.45)",
      "rgba(13, 17, 23, 0.25)",
      "rgba(22, 27, 34, 0.45)",
    ],
    emptyCell: "#161b22",
    levels: ["#0e4429", "#006d32", "#26a641", "#39d353"],
    rail: "#30363d",
    railGlow: "#58a6ff",
    ninjaSuit: "#1b2333",
    ninjaArmor: "#27354d",
    ninjaHead: "#141b27",
    ninjaStroke: "#3b82f6",
    scarf: "#38bdf8",
    scarfLight: "#7dd3fc",
    eye: "#ffffff",
    katanaHilt: "#0284c7",
    katanaGuard: "#38bdf8",
    katanaBlade: "#ffffff",
    katanaEdge: "#38bdf8",
    slashCore: "#ffffff",
    slashGlow: "#38bdf8",
    slashTrail: "rgba(56, 189, 248, 0.35)",
    spark: "#38bdf8",
    sparkAlt: "#ffffff",
    obstacle: "#f85149",
    obstacleDark: "#21262d",
    obstacleWarning: "#da3633",
    enemyBody: "#1c2430",
    enemyArmor: "#303b4d",
    enemyEye: "#ff7b72",
    enemyCore: "#f85149",
    enemySparks: "#ff7b72",
    textMuted: "#6e7681",
    laneLabel: "#388bfd",
  },
  light: {
    bg: "#ffffff",
    laneLine: "rgba(0, 0, 0, 0.06)",
    laneRowBg: [
      "rgba(246, 248, 250, 0.6)",
      "rgba(255, 255, 255, 0.3)",
      "rgba(246, 248, 250, 0.6)",
      "rgba(255, 255, 255, 0.3)",
      "rgba(246, 248, 250, 0.6)",
    ],
    emptyCell: "#ebedf0",
    levels: ["#9be9a8", "#40c463", "#30a14e", "#216e39"],
    rail: "#d0d7de",
    railGlow: "#0969da",
    ninjaSuit: "#1f242c",
    ninjaArmor: "#32383f",
    ninjaHead: "#161b22",
    ninjaStroke: "#0969da",
    scarf: "#0969da",
    scarfLight: "#218bff",
    eye: "#ffffff",
    katanaHilt: "#0969da",
    katanaGuard: "#57606a",
    katanaBlade: "#32383f",
    katanaEdge: "#0969da",
    slashCore: "#1b1f24",
    slashGlow: "#218bff",
    slashTrail: "rgba(9, 105, 218, 0.25)",
    spark: "#0969da",
    sparkAlt: "#cf222e",
    obstacle: "#cf222e",
    obstacleDark: "#eaeef2",
    obstacleWarning: "#cf222e",
    enemyBody: "#424a53",
    enemyArmor: "#57606a",
    enemyEye: "#cf222e",
    enemyCore: "#cf222e",
    enemySparks: "#cf222e",
    textMuted: "#8c959f",
    laneLabel: "#0969da",
  },
};

// ---------- fetch contributions with fallback ----------
async function fetchContributions(login) {
  const fallback = generateFallbackGrid();
  if (!login) return fallback;
  const url = `https://github.com/users/${login}/contributions`;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "user-agent": "ninja-profile-generator" },
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      const tags = html.match(/<td[^>]*ContributionCalendar-day[^>]*>/g) || [];
      const cells = [];
      for (const tag of tags) {
        const level = /data-level="(\d)"/.exec(tag)?.[1];
        if (level !== undefined) cells.push(Number(level));
      }
      if (cells.length > 50) {
        return mapToFiveRows(cells);
      }
    } catch {
      // Continue to next attempt or fallback
    }
  }
  return fallback;
}

function generateFallbackGrid() {
  const grid = [];
  let seed = 42;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let r = 0; r < ROWS; r++) {
    const row = [];
    for (let c = 0; c < COLS; c++) {
      const p = random();
      const lvl = p > 0.82 ? 4 : p > 0.65 ? 3 : p > 0.45 ? 2 : p > 0.22 ? 1 : 0;
      row.push(lvl);
    }
    grid.push(row);
  }
  return grid;
}

function mapToFiveRows(calendarLevels) {
  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  const total = calendarLevels.length;
  const needed = ROWS * COLS;
  const start = Math.max(0, total - needed);
  let idx = start;
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      if (idx < total) {
        grid[r][c] = calendarLevels[idx++];
      }
    }
  }
  return grid;
}

// ---------- animation timing (total 17.5s loop) ----------
const T = 17.5;
const pct = (s) => ((s / T) * 100).toFixed(3);

// Timing benchmarks (seconds):
const EVT = {
  enter: 0.0,
  // Jump over low spikes (spikes at X = 220)
  jumpStart: 2.1,
  jumpApex: 2.8,
  jumpLand: 3.5,
  jumpRecover: 3.8,
  // Enemy 1 Horizontal Slash (enemy at X = 360)
  e1Approach: 5.0,
  e1Windup: 5.3,
  e1Hit: 5.6,
  e1Recover: 6.2,
  // Overhead Barrier Crouch Slide (girder at X = 540)
  slideStart: 7.6,
  slideUnder: 8.5,
  slideEnd: 9.4,
  slideRecover: 9.8,
  // Enemy 2 Diagonal Slice (enemy at X = 670)
  e2Approach: 10.9,
  e2Windup: 11.2,
  e2Hit: 11.5,
  e2Recover: 12.1,
  // Enemy 3 Overhead Cleave (enemy at X = 790)
  e3Approach: 13.2,
  e3Leap: 13.5,
  e3Hit: 13.8,
  e3Recover: 14.4,
  // Exit Sprint
  exitDash: 15.6,
  offscreen: 16.0,
  respawn: 16.6,
  loopEnd: 17.5,
};

// Ninja trajectory points: [time_sec, x, y_offset_from_ground]
const NINJA_TRAJECTORY = [
  [0.0, -80, 0],
  [1.0, 30, 0],
  [EVT.jumpStart - 0.2, 160, 0],
  [EVT.jumpStart, 180, 3], // Anticipation crouch before jump
  [EVT.jumpStart + 0.35, 200, -36], // Rising
  [EVT.jumpApex, 220, -52], // Apex soaring over spikes at X=220 (clearing 24px spikes)
  [EVT.jumpApex + 0.35, 240, -32], // Falling
  [EVT.jumpLand, 260, 3], // Landing cushion
  [EVT.jumpRecover, 280, 0], // Rebounded back to run
  [EVT.e1Windup, 330, 0], // Windup before slash
  [EVT.e1Hit, 360, 0], // Slash impact at X=360
  [EVT.e1Recover, 385, 0], // Recovery
  [7.0, 470, 0], // Smooth run section
  [EVT.slideStart, 505, 0], // Dropping into low slide
  [EVT.slideUnder - 0.4, 530, 0], // Sliding cleanly under barrier
  [EVT.slideUnder + 0.4, 555, 0],
  [EVT.slideEnd, 580, 0], // Emerging from slide
  [EVT.slideRecover, 600, 0], // Standing back up
  [EVT.e2Windup, 645, 0], // Sword drawn high
  [EVT.e2Hit, 670, 0], // Diagonal strike impact
  [EVT.e2Recover, 695, 0], // Recovery
  [EVT.e3Approach, 755, 0],
  [EVT.e3Leap, 775, -18], // Small aerial hop for overhead cleave
  [EVT.e3Hit, 790, 0], // Downward crash impact
  [EVT.e3Recover, 810, 2],
  [EVT.exitDash, 920, 0], // Sprinting offscreen
  [EVT.offscreen, 1000, 0], // Exited right
  [EVT.loopEnd - 0.01, 1000, 0],
  [EVT.loopEnd, -80, 0], // Reset
];

// ---------- SVG builder ----------
function buildSvg(grid, theme) {
  const p = PALETTES[theme];

  // 1. Five Distinct Movement Rows / Lanes
  let lanesSvg = "";
  for (let r = 0; r < ROWS; r++) {
    const y = PAD_TOP + r * ROW_H;
    const bgCol = p.laneRowBg[r];
    lanesSvg += `<rect x="0" y="${y}" width="${WIDTH}" height="${ROW_H}" fill="${bgCol}"/>`;
    if (r > 0) {
      lanesSvg += `<line x1="0" y1="${y}" x2="${WIDTH}" y2="${y}" stroke="${p.laneLine}" stroke-dasharray="4,6" stroke-width="1"/>`;
    }
  }

  // Row Indicators on left margin (L1 to L5)
  let laneMarkers = "";
  const laneNames = ["L1 · HIGH", "L2 · UPPER", "L3 · MID", "L4 · LOWER", "L5 · GROUND"];
  for (let r = 0; r < ROWS; r++) {
    const y = PAD_TOP + r * ROW_H + ROW_H / 2 + 3;
    laneMarkers += `<text x="8" y="${y}" fill="${p.textMuted}" font-family="monospace, sans-serif" font-size="7.5" font-weight="600" letter-spacing="0.5" opacity="0.65">${laneNames[r]}</text>`;
  }

  // 2. 5-Row Matrix Cells (GitHub contribution tiles)
  let cellsSvg = "";
  for (let r = 0; r < ROWS; r++) {
    const cy = PAD_TOP + r * ROW_H + (ROW_H - CELL_SIZE) / 2;
    for (let c = 0; c < COLS; c++) {
      const cx = GRID_START_X + c * CELL_PITCH;
      const level = grid[r][c] || 0;
      const fill = level === 0 ? p.emptyCell : p.levels[Math.min(level - 1, 3)];
      const op = level === 0 ? "0.4" : "0.95";
      cellsSvg += `<rect x="${cx}" y="${cy}" width="${CELL_SIZE}" height="${CELL_SIZE}" rx="2.5" fill="${fill}" opacity="${op}"/>`;
    }
  }

  // 3. Ground Platform Rail at GROUND_Y (170)
  const railSvg = `
    <line x1="0" y1="${GROUND_Y}" x2="${WIDTH}" y2="${GROUND_Y}" stroke="${p.rail}" stroke-width="2.5"/>
    <line x1="0" y1="${GROUND_Y}" x2="${WIDTH}" y2="${GROUND_Y}" stroke="${p.railGlow}" stroke-width="1" opacity="0.5"/>
    ${Array.from({ length: 46 }, (_, i) => `<line x1="${i * 20}" y1="${GROUND_Y}" x2="${i * 20 + 6}" y2="${GROUND_Y + 4}" stroke="${p.rail}" stroke-width="1.2" opacity="0.45"/>`).join("")}
  `;

  // 4. Low Obstacle: Ground Spikes at X = 220 (Row 5)
  // Height = 24px, from y=146 to 170. Ninja leaps high to clear this.
  const spikeX = 220;
  const spikeSvg = `
    <g id="low-obstacle-spikes">
      <!-- Glow warning -->
      <polygon points="${spikeX - 16},170 ${spikeX - 11},148 ${spikeX - 6},170" fill="${p.obstacleWarning}" opacity="0.85"/>
      <polygon points="${spikeX - 7},170 ${spikeX - 1},144 ${spikeX + 5},170" fill="${p.obstacle}" opacity="0.95"/>
      <polygon points="${spikeX + 4},170 ${spikeX + 10},150 ${spikeX + 16},170" fill="${p.obstacleWarning}" opacity="0.85"/>
      <!-- Inner sharp cores -->
      <line x1="${spikeX - 11}" y1="148" x2="${spikeX - 11}" y2="170" stroke="#fff" stroke-width="1.2" opacity="0.7"/>
      <line x1="${spikeX - 1}" y1="144" x2="${spikeX - 1}" y2="170" stroke="#fff" stroke-width="1.4" opacity="0.85"/>
      <line x1="${spikeX + 10}" y1="150" x2="${spikeX + 10}" y2="170" stroke="#fff" stroke-width="1.2" opacity="0.7"/>
      <!-- Base warning plate -->
      <rect x="${spikeX - 18}" y="167" width="36" height="3" fill="${p.obstacleDark}" stroke="${p.obstacleWarning}" stroke-width="0.8"/>
    </g>
  `;

  // 5. Overhead Barrier: Suspended Laser Girder at X = 540 (Rows 1-3)
  // Hangs down from ceiling (y=10) to y=134. Clearance at bottom = 36px.
  // Ninja standing is 60px tall, so must crouch/slide (20px tall) to pass under!
  const barrierX = 540;
  const barrierSvg = `
    <g id="overhead-barrier">
      <!-- Hanging structural girder -->
      <rect x="${barrierX - 15}" y="10" width="30" height="116" fill="${p.obstacleDark}" stroke="${p.rail}" stroke-width="1.2"/>
      <line x1="${barrierX - 15}" y1="20" x2="${barrierX + 15}" y2="50" stroke="${p.rail}" stroke-width="1" opacity="0.5"/>
      <line x1="${barrierX + 15}" y1="50" x2="${barrierX - 15}" y2="80" stroke="${p.rail}" stroke-width="1" opacity="0.5"/>
      <line x1="${barrierX - 15}" y1="80" x2="${barrierX + 15}" y2="110" stroke="${p.rail}" stroke-width="1" opacity="0.5"/>
      <!-- Warning hazard stripes at lower block -->
      <rect x="${barrierX - 17}" y="116" width="34" height="14" rx="2" fill="${p.obstacleDark}" stroke="${p.obstacleWarning}" stroke-width="1.2"/>
      <path d="M${barrierX - 12},128 L${barrierX - 6},118 M${barrierX - 4},128 L${barrierX + 2},118 M${barrierX + 4},128 L${barrierX + 10},118" stroke="${p.obstacleWarning}" stroke-width="1.8"/>
      <!-- Laser emitter beam at y = 134 -->
      <rect x="${barrierX - 13}" y="132" width="26" height="4" rx="2" fill="${p.obstacle}"/>
      <line x1="${barrierX - 20}" y1="134" x2="${barrierX + 20}" y2="134" stroke="${p.obstacle}" stroke-width="2.5" opacity="0.8"/>
      <!-- Hazard warning label -->
      <text x="${barrierX}" y="105" fill="${p.obstacle}" font-family="monospace, sans-serif" font-size="7" font-weight="700" text-anchor="middle" letter-spacing="1">DANGER</text>
    </g>
  `;

  // 6. Enemies & Combat Encounters:
  // Enemy 1: Ground Cyber Sentry at X = 360 (Sliced horizontally)
  // Enemy 2: Armored Ronin at X = 670 (Sliced diagonally)
  // Enemy 3: Floating Drone Sentinel at X = 790 (Sliced overhead)
  const enemy1Svg = `
    <g id="enemy-1" class="e1-group">
      <!-- Top half -->
      <g class="e1-top">
        <path d="M 348,148 L 353,128 L 367,128 L 372,148 Z" fill="${p.enemyBody}" stroke="${p.enemyArmor}" stroke-width="1.4"/>
        <rect x="353" y="135" width="14" height="3" rx="1.5" fill="${p.enemyEye}"/>
        <circle cx="360" cy="142" r="2.2" fill="${p.enemyCore}"/>
      </g>
      <!-- Bottom half -->
      <g class="e1-bot">
        <path d="M 347,149 L 373,149 L 369,170 L 351,170 Z" fill="${p.enemyBody}" stroke="${p.enemyArmor}" stroke-width="1.4"/>
        <line x1="360" y1="152" x2="360" y2="168" stroke="${p.enemyArmor}" stroke-width="1"/>
      </g>
    </g>
  `;

  const enemy2Svg = `
    <g id="enemy-2" class="e2-group">
      <!-- Upper-right piece -->
      <g class="e2-top">
        <polygon points="658,128 679,128 683,153 666,149" fill="${p.enemyBody}" stroke="${p.enemyArmor}" stroke-width="1.4"/>
        <rect x="664" y="135" width="12" height="3" rx="1" fill="${p.enemyEye}"/>
        <circle cx="672" cy="143" r="2.5" fill="${p.enemyCore}"/>
      </g>
      <!-- Lower-left piece -->
      <g class="e2-bot">
        <polygon points="658,130 665,150 682,154 679,170 659,170 655,151" fill="${p.enemyBody}" stroke="${p.enemyArmor}" stroke-width="1.4"/>
        <rect x="662" y="156" width="14" height="3" rx="1" fill="${p.enemyArmor}"/>
      </g>
    </g>
  `;

  const enemy3Svg = `
    <g id="enemy-3" class="e3-group">
      <!-- Left half -->
      <g class="e3-left">
        <path d="M 788,124 L 773,135 L 775,157 L 788,163 Z" fill="${p.enemyBody}" stroke="${p.enemyArmor}" stroke-width="1.4"/>
        <line x1="772" y1="144" x2="788" y2="144" stroke="${p.enemyEye}" stroke-width="1.5"/>
        <circle cx="781" cy="144" r="2.5" fill="${p.enemyEye}"/>
      </g>
      <!-- Right half -->
      <g class="e3-right">
        <path d="M 790,124 L 805,135 L 803,157 L 790,163 Z" fill="${p.enemyBody}" stroke="${p.enemyArmor}" stroke-width="1.4"/>
        <line x1="790" y1="144" x2="806" y2="144" stroke="${p.enemyEye}" stroke-width="1.5"/>
        <circle cx="797" cy="144" r="2.5" fill="${p.enemyEye}"/>
      </g>
    </g>
  `;

  // 7. Attack Effects (Slash Arcs, Blade Trails, Impact Sparks)
  // Attack 1: Horizontal Slash Arc & Sparks at X = 360
  const vfx1Svg = `
    <g class="vfx-1">
      <!-- Dynamic Blade Slash Trail Ribbon -->
      <path d="M 310,152 Q 355,140 420,145 Q 360,152 310,152 Z" fill="${p.slashTrail}"/>
      <!-- Sharp Glowing Arc -->
      <path d="M 305,150 Q 360,142 425,147" stroke="${p.slashGlow}" stroke-width="4.8" stroke-linecap="round" fill="none" opacity="0.85"/>
      <path d="M 307,150 Q 360,142 423,147" stroke="${p.slashCore}" stroke-width="2" stroke-linecap="round" fill="none"/>
      <!-- Impact Star Burst -->
      <polygon points="360,135 362,145 372,147 362,149 360,159 358,149 348,147 358,145" fill="${p.slashCore}"/>
      <!-- Radiating Sparks -->
      <circle cx="372" cy="138" r="1.8" fill="${p.spark}"/>
      <circle cx="382" cy="148" r="2.2" fill="${p.sparkAlt}"/>
      <circle cx="368" cy="158" r="1.8" fill="${p.spark}"/>
      <circle cx="348" cy="138" r="1.6" fill="${p.spark}"/>
      <circle cx="390" cy="142" r="1.4" fill="${p.sparkAlt}"/>
    </g>
  `;

  // Attack 2: Diagonal Slice Arc & Sparks at X = 670 (45° angle)
  const vfx2Svg = `
    <g class="vfx-2">
      <!-- Diagonal Trail Ribbon -->
      <path d="M 630,108 Q 668,138 706,168 Q 675,148 638,118 Z" fill="${p.slashTrail}"/>
      <!-- Sharp Diagonal Arc -->
      <path d="M 628,106 Q 670,142 710,170" stroke="${p.slashGlow}" stroke-width="5" stroke-linecap="round" fill="none" opacity="0.9"/>
      <path d="M 630,108 Q 670,142 708,168" stroke="${p.slashCore}" stroke-width="2.2" stroke-linecap="round" fill="none"/>
      <!-- Impact Star -->
      <polygon points="670,130 673,141 684,144 673,147 670,158 667,147 656,144 667,141" fill="${p.slashCore}"/>
      <!-- Diagonal Sparks Spray -->
      <circle cx="684" cy="134" r="2.2" fill="${p.spark}"/>
      <circle cx="694" cy="152" r="2.5" fill="${p.sparkAlt}"/>
      <circle cx="678" cy="162" r="1.8" fill="${p.spark}"/>
      <circle cx="658" cy="124" r="1.6" fill="${p.sparkAlt}"/>
    </g>
  `;

  // Attack 3: Overhead Cleave Arc & Shockwave at X = 790
  const vfx3Svg = `
    <g class="vfx-3">
      <!-- Overhead Curved Trail Ribbon -->
      <path d="M 776,72 Q 798,120 790,172 Q 780,130 772,82 Z" fill="${p.slashTrail}"/>
      <!-- Vertical Downward Crescent Arc -->
      <path d="M 774,70 Q 800,122 790,174" stroke="${p.slashGlow}" stroke-width="5.2" stroke-linecap="round" fill="none" opacity="0.95"/>
      <path d="M 776,72 Q 798,122 790,172" stroke="${p.slashCore}" stroke-width="2.4" stroke-linecap="round" fill="none"/>
      <!-- Ground Impact Shockwave -->
      <ellipse cx="790" cy="170" rx="24" ry="4.5" stroke="${p.slashGlow}" stroke-width="2" fill="none" opacity="0.85"/>
      <!-- Impact Star & Sparks -->
      <polygon points="790,132 793,143 804,146 793,149 790,160 787,149 776,146 787,143" fill="${p.slashCore}"/>
      <circle cx="776" cy="130" r="2.4" fill="${p.spark}"/>
      <circle cx="806" cy="134" r="2.4" fill="${p.sparkAlt}"/>
      <circle cx="800" cy="160" r="2" fill="${p.spark}"/>
      <circle cx="780" cy="162" r="1.8" fill="${p.sparkAlt}"/>
    </g>
  `;

  // 8. The Ninja Character Rig:
  // Standing Height = 60px (spanning ~2 rows: feet at y=0, head at y=-60).
  const ninjaRigDef = `
    <g id="ninja-char">
      <!-- POSE 1: RUNNING (Cycles smoothly during run phases) -->
      <g class="pose-run">
        <!-- Flowing animated scarf ribbons -->
        <path class="scarf-strand-1" d="M -9,-52 C -24,-45 -36,-62 -52,-56 C -36,-66 -22,-56 -9,-55 Z" fill="${p.scarf}"/>
        <path class="scarf-strand-2" d="M -8,-49 C -20,-42 -28,-52 -42,-48 C -26,-55 -18,-48 -8,-51 Z" fill="${p.scarfLight}" opacity="0.85"/>
        <!-- Torso & Shinobi Tunic -->
        <polygon points="-8,-46 10,-44 7,-24 -9,-24" fill="${p.ninjaSuit}" stroke="${p.ninjaArmor}" stroke-width="1.2"/>
        <polygon points="-7,-45 5,-44 3,-25 -8,-25" fill="${p.ninjaArmor}"/>
        <!-- Obi Sash / Belt -->
        <rect x="-10" y="-27" width="19" height="5" rx="1.5" fill="${p.scarf}"/>
        <!-- Shinobi Head & Cowl -->
        <ellipse cx="2" cy="-53" rx="8" ry="8.5" fill="${p.ninjaHead}" stroke="${p.ninjaArmor}" stroke-width="1"/>
        <!-- Forehead protector plate -->
        <rect x="-4" y="-57" width="13" height="3.5" rx="1" fill="${p.scarf}"/>
        <!-- Glowing eye slit -->
        <polygon points="1,-53 9,-53 8,-51 0,-51" fill="${p.eye}"/>
        <!-- Running Legs: Left Leg (Forward drive) -->
        <path class="leg-l" d="M -3,-24 L 6,-13 L 14,0" stroke="${p.ninjaSuit}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        <!-- Running Legs: Right Leg (Back stride) -->
        <path class="leg-r" d="M -4,-24 L -12,-13 L -16,-1" stroke="${p.ninjaHead}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        <!-- Katana Sheathed / Held Angled Behind -->
        <path d="M 1,-36 L -18,-24" stroke="${p.katanaGuard}" stroke-width="3" stroke-linecap="round"/>
        <path d="M -18,-24 L -36,-12" stroke="${p.katanaBlade}" stroke-width="2.2" stroke-linecap="round"/>
        <line x1="-18" y1="-24" x2="-36" y2="-12" stroke="${p.katanaEdge}" stroke-width="1"/>
        <!-- Pumping Arms -->
        <path class="arm-f" d="M 2,-42 L 10,-32 L 16,-24" stroke="${p.ninjaSuit}" stroke-width="4.2" stroke-linecap="round" fill="none"/>
      </g>

      <!-- POSE 2: JUMP (Tucked acrobatic leap, height 36px, clearing ground spikes) -->
      <g class="pose-jump">
        <!-- Streaming downward scarf ribbons -->
        <path d="M -7,-48 C -24,-40 -36,-26 -46,-14 C -34,-26 -16,-40 -7,-50 Z" fill="${p.scarf}"/>
        <path d="M -6,-45 C -20,-32 -30,-18 -38,-6 C -28,-18 -14,-36 -6,-47 Z" fill="${p.scarfLight}" opacity="0.85"/>
        <!-- Tilted ninja body -->
        <g transform="rotate(20, 0, -32)">
          <polygon points="-8,-46 10,-44 7,-24 -9,-24" fill="${p.ninjaSuit}" stroke="${p.ninjaArmor}" stroke-width="1.2"/>
          <rect x="-10" y="-27" width="19" height="5" rx="1.5" fill="${p.scarf}"/>
          <ellipse cx="2" cy="-53" rx="8" ry="8.5" fill="${p.ninjaHead}"/>
          <rect x="-4" y="-57" width="13" height="3.5" rx="1" fill="${p.scarf}"/>
          <polygon points="1,-53 9,-53 8,-51 0,-51" fill="${p.eye}"/>
          <!-- Tucked Legs (tightly drawn toward chest, clearing 24px spikes!) -->
          <path d="M -3,-24 L 10,-19 L 5,-8" stroke="${p.ninjaSuit}" stroke-width="5" stroke-linecap="round" fill="none"/>
          <path d="M -5,-24 L -11,-15 L -5,-8" stroke="${p.ninjaHead}" stroke-width="4.5" stroke-linecap="round" fill="none"/>
          <!-- Katana poised in mid-air -->
          <path d="M 5,-38 L 26,-24" stroke="${p.katanaBlade}" stroke-width="2.4" stroke-linecap="round"/>
          <line x1="5" y1="-38" x2="26" y2="-24" stroke="${p.katanaEdge}" stroke-width="1.2"/>
          <rect x="4" y="-40" width="3.5" height="5.5" rx="1" fill="${p.katanaGuard}"/>
          <!-- Reaching Arms -->
          <path d="M 2,-40 L 14,-28" stroke="${p.ninjaSuit}" stroke-width="4.2" stroke-linecap="round"/>
        </g>
      </g>

      <!-- POSE 3: CROUCH SLIDE (Super low profile: height only 20px!) -->
      <g class="pose-slide">
        <!-- Low flat streaming scarf -->
        <path d="M -18,-17 C -34,-15 -48,-12 -62,-10 C -48,-17 -34,-19 -18,-20 Z" fill="${p.scarf}"/>
        <path d="M -16,-14 C -30,-11 -42,-8 -54,-6 C -40,-13 -28,-15 -16,-17 Z" fill="${p.scarfLight}" opacity="0.85"/>
        <!-- Body angled back flat to floor -->
        <polygon points="-16,-19 6,-17 2,-6 -18,-7" fill="${p.ninjaSuit}" stroke="${p.ninjaArmor}" stroke-width="1.2"/>
        <ellipse cx="8" cy="-20" rx="7.5" ry="7" fill="${p.ninjaHead}"/>
        <polygon points="7,-20 14,-20 13,-18 6,-18" fill="${p.eye}"/>
        <!-- Extended sliding forward leg -->
        <path d="M 2,-7 L 20,-4 L 32,-2" stroke="${p.ninjaSuit}" stroke-width="5" stroke-linecap="round" fill="none"/>
        <!-- Folded back leg tucked to floor -->
        <path d="M -16,-7 L -9,-4 L 3,-2" stroke="${p.ninjaHead}" stroke-width="4.5" stroke-linecap="round" fill="none"/>
        <!-- Katana trailing flat along floor -->
        <path d="M -12,-11 L -36,-4" stroke="${p.katanaBlade}" stroke-width="2.4" stroke-linecap="round"/>
        <line x1="-12" y1="-11" x2="-36" y2="-4" stroke="${p.katanaEdge}" stroke-width="1.2"/>
        <rect x="-14" y="-13" width="3.5" height="5" rx="1" fill="${p.katanaGuard}"/>
        <!-- Friction floor sparks -->
        <circle cx="28" cy="0" r="1.8" fill="${p.spark}"/>
        <circle cx="34" cy="-2" r="1.4" fill="${p.sparkAlt}"/>
        <circle cx="-8" cy="0" r="1.6" fill="${p.spark}"/>
      </g>

      <!-- POSE 4: HORIZONTAL SLASH (Aggressive forward lunge with straight horizontal blade) -->
      <g class="pose-slash-h">
        <!-- Violent scarf snap -->
        <path d="M -16,-48 C -32,-52 -48,-46 -64,-50 C -48,-58 -32,-53 -16,-51 Z" fill="${p.scarf}"/>
        <!-- Deep forward lunge body -->
        <polygon points="-12,-44 10,-42 8,-21 -10,-21" fill="${p.ninjaSuit}" stroke="${p.ninjaArmor}" stroke-width="1.2"/>
        <rect x="-12" y="-25" width="21" height="5" rx="1.5" fill="${p.scarf}"/>
        <ellipse cx="6" cy="-50" rx="8" ry="8" fill="${p.ninjaHead}"/>
        <polygon points="5,-50 13,-50 12,-48 4,-48" fill="${p.eye}"/>
        <!-- Wide lunge legs -->
        <path d="M 6,-21 L 20,-10 L 28,0" stroke="${p.ninjaSuit}" stroke-width="5.2" stroke-linecap="round" fill="none"/>
        <path d="M -10,-21 L -24,-12 L -34,0" stroke="${p.ninjaHead}" stroke-width="4.8" stroke-linecap="round" fill="none"/>
        <!-- Katana extended straight forward horizontally! -->
        <path d="M 8,-36 L 54,-33" stroke="${p.katanaBlade}" stroke-width="2.8" stroke-linecap="round"/>
        <line x1="8" y1="-36" x2="54" y2="-33" stroke="${p.katanaEdge}" stroke-width="1.4"/>
        <rect x="6" y="-39" width="3.5" height="6" rx="1" fill="${p.katanaGuard}"/>
        <!-- Thrusting Arms -->
        <path d="M 4,-40 L 16,-36 L 10,-36" stroke="${p.ninjaSuit}" stroke-width="4.5" stroke-linecap="round"/>
      </g>

      <!-- POSE 5: DIAGONAL SLICE (45-degree angle downward cutting strike) -->
      <g class="pose-slash-d">
        <!-- Sweeping scarf arc -->
        <path d="M -12,-50 C -30,-58 -42,-50 -54,-54 C -40,-64 -26,-58 -12,-54 Z" fill="${p.scarf}"/>
        <!-- Torqued body stance -->
        <polygon points="-10,-44 10,-42 6,-21 -10,-21" fill="${p.ninjaSuit}" stroke="${p.ninjaArmor}" stroke-width="1.2"/>
        <rect x="-11" y="-26" width="20" height="5" rx="1.5" fill="${p.scarf}"/>
        <ellipse cx="4" cy="-50" rx="8" ry="8" fill="${p.ninjaHead}"/>
        <polygon points="3,-50 11,-50 10,-48 2,-48" fill="${p.eye}"/>
        <!-- Stride legs -->
        <path d="M 6,-21 L 18,-8 L 22,0" stroke="${p.ninjaSuit}" stroke-width="5.2" stroke-linecap="round" fill="none"/>
        <path d="M -10,-21 L -20,-10 L -26,0" stroke="${p.ninjaHead}" stroke-width="4.8" stroke-linecap="round" fill="none"/>
        <!-- Katana cutting down diagonally across chest -->
        <path d="M -3,-50 L 40,-12" stroke="${p.katanaBlade}" stroke-width="3" stroke-linecap="round"/>
        <line x1="-3" y1="-50" x2="40" y2="-12" stroke="${p.katanaEdge}" stroke-width="1.4"/>
        <circle cx="0" cy="-47" r="2.6" fill="${p.katanaGuard}"/>
        <path d="M 2,-40 L 16,-28" stroke="${p.ninjaSuit}" stroke-width="4.5" stroke-linecap="round"/>
      </g>

      <!-- POSE 6: OVERHEAD CLEAVE (Two hands high, crashing straight down) -->
      <g class="pose-slash-o">
        <path d="M -10,-46 C -26,-38 -38,-26 -48,-18 C -36,-28 -22,-40 -10,-48 Z" fill="${p.scarf}"/>
        <!-- Downward follow-through body -->
        <polygon points="-10,-42 8,-40 6,-19 -10,-19" fill="${p.ninjaSuit}" stroke="${p.ninjaArmor}" stroke-width="1.2"/>
        <rect x="-11" y="-24" width="19" height="5" rx="1.5" fill="${p.scarf}"/>
        <ellipse cx="3" cy="-47" rx="8" ry="8" fill="${p.ninjaHead}"/>
        <polygon points="2,-47 10,-47 9,-45 1,-45" fill="${p.eye}"/>
        <!-- Landing legs -->
        <path d="M 6,-19 L 14,-6 L 16,0" stroke="${p.ninjaSuit}" stroke-width="5.2" stroke-linecap="round" fill="none"/>
        <path d="M -10,-19 L -18,-8 L -20,0" stroke="${p.ninjaHead}" stroke-width="4.8" stroke-linecap="round" fill="none"/>
        <!-- Katana crashing straight down from overhead -->
        <path d="M 14,-56 L 24,-2" stroke="${p.katanaBlade}" stroke-width="3.2" stroke-linecap="round"/>
        <line x1="14" y1="-56" x2="24" y2="-2" stroke="${p.katanaEdge}" stroke-width="1.5"/>
        <circle cx="14" cy="-52" r="2.8" fill="${p.katanaGuard}"/>
        <path d="M 2,-38 L 16,-50" stroke="${p.ninjaSuit}" stroke-width="4.5" stroke-linecap="round"/>
      </g>
    </g>
  `;

  // 9. CSS Keyframes Generation
  // Ninja translation keyframes
  const ninjaKf = NINJA_TRAJECTORY.map(([time, x, y]) => {
    const pVal = pct(time);
    const ty = GROUND_Y + y;
    return `${pVal}% { transform: translate(${x.toFixed(1)}px, ${ty.toFixed(1)}px); }`;
  }).join("\n");

  const dur = `${T.toFixed(3)}s`;

  // Explicit non-overlapping keyframe ranges for bulletproof pose switching
  const css = `
    /* Canvas base */
    .bg { fill: ${p.bg}; }
    
    /* Ninja carrier motion */
    #ninja-carrier {
      animation: ninjaTravel ${dur} linear infinite;
    }
    .ghost-1 {
      animation: ninjaTravel ${dur} linear infinite;
      animation-delay: -0.07s;
      opacity: 0.3;
    }
    .ghost-2 {
      animation: ninjaTravel ${dur} linear infinite;
      animation-delay: -0.14s;
      opacity: 0.15;
    }
    @keyframes ninjaTravel {
      ${ninjaKf}
    }

    /* Poses visibility (deterministic non-overlapping intervals) */
    .pose-run { animation: animRun ${dur} step-end infinite; }
    .pose-jump { opacity: 0; animation: animJump ${dur} step-end infinite; }
    .pose-slide { opacity: 0; animation: animSlide ${dur} step-end infinite; }
    .pose-slash-h { opacity: 0; animation: animSlashH ${dur} step-end infinite; }
    .pose-slash-d { opacity: 0; animation: animSlashD ${dur} step-end infinite; }
    .pose-slash-o { opacity: 0; animation: animSlashO ${dur} step-end infinite; }

    @keyframes animRun {
      0%, 11.99% { opacity: 1; }
      12.00%, 21.09% { opacity: 0; }
      21.10%, 29.69% { opacity: 1; }
      29.70%, 35.39% { opacity: 0; }
      35.40%, 43.39% { opacity: 1; }
      43.40%, 54.89% { opacity: 0; }
      54.90%, 62.89% { opacity: 1; }
      62.90%, 69.69% { opacity: 0; }
      69.70%, 75.99% { opacity: 1; }
      76.00%, 82.89% { opacity: 0; }
      82.90%, 100% { opacity: 1; }
    }

    @keyframes animJump {
      0%, 11.99% { opacity: 0; }
      12.00%, 21.09% { opacity: 1; }
      21.10%, 100% { opacity: 0; }
    }

    @keyframes animSlide {
      0%, 43.39% { opacity: 0; }
      43.40%, 54.89% { opacity: 1; }
      54.90%, 100% { opacity: 0; }
    }

    @keyframes animSlashH {
      0%, 29.69% { opacity: 0; }
      29.70%, 35.39% { opacity: 1; }
      35.40%, 100% { opacity: 0; }
    }

    @keyframes animSlashD {
      0%, 62.89% { opacity: 0; }
      62.90%, 69.69% { opacity: 1; }
      69.70%, 100% { opacity: 0; }
    }

    @keyframes animSlashO {
      0%, 75.99% { opacity: 0; }
      76.00%, 82.89% { opacity: 1; }
      82.90%, 100% { opacity: 0; }
    }

    /* Attack 1 VFX and Enemy 1 reaction (X = 360) */
    .vfx-1 { opacity: 0; animation: animVfx1 ${dur} ease-out infinite; }
    @keyframes animVfx1 {
      0%, 31.39% { opacity: 0; }
      31.40% { opacity: 1; transform: scale(1.05); }
      33.50% { opacity: 0; transform: scale(1); }
      100% { opacity: 0; }
    }
    .e1-top {
      transform-origin: 360px 148px;
      animation: animE1Top ${dur} ease-out infinite;
    }
    .e1-bot {
      transform-origin: 360px 149px;
      animation: animE1Bot ${dur} ease-out infinite;
    }
    @keyframes animE1Top {
      0%, 31.99% { opacity: 1; transform: translate(0, 0) rotate(0deg); }
      34.50% { opacity: 0; transform: translate(22px, -14px) rotate(32deg) scale(0.4); }
      94.79% { opacity: 0; transform: translate(0, 0) rotate(0deg); }
      97.00%, 100% { opacity: 1; transform: translate(0, 0) rotate(0deg); }
    }
    @keyframes animE1Bot {
      0%, 31.99% { opacity: 1; transform: translate(0, 0); }
      34.50% { opacity: 0; transform: translate(-10px, 12px) scale(0.4); }
      94.79% { opacity: 0; transform: translate(0, 0); }
      97.00%, 100% { opacity: 1; transform: translate(0, 0); }
    }

    /* Attack 2 VFX and Enemy 2 reaction (X = 670) */
    .vfx-2 { opacity: 0; animation: animVfx2 ${dur} ease-out infinite; }
    @keyframes animVfx2 {
      0%, 65.39% { opacity: 0; }
      65.40% { opacity: 1; }
      67.50% { opacity: 0; }
      100% { opacity: 0; }
    }
    .e2-top {
      transform-origin: 670px 145px;
      animation: animE2Top ${dur} ease-out infinite;
    }
    .e2-bot {
      transform-origin: 670px 145px;
      animation: animE2Bot ${dur} ease-out infinite;
    }
    @keyframes animE2Top {
      0%, 65.69% { opacity: 1; transform: translate(0, 0) rotate(0deg); }
      68.20% { opacity: 0; transform: translate(24px, -16px) rotate(40deg) scale(0.4); }
      94.79% { opacity: 0; transform: translate(0, 0); }
      97.00%, 100% { opacity: 1; transform: translate(0, 0); }
    }
    @keyframes animE2Bot {
      0%, 65.69% { opacity: 1; transform: translate(0, 0) rotate(0deg); }
      68.20% { opacity: 0; transform: translate(-14px, 14px) rotate(-24deg) scale(0.4); }
      94.79% { opacity: 0; transform: translate(0, 0); }
      97.00%, 100% { opacity: 1; transform: translate(0, 0); }
    }

    /* Attack 3 VFX and Enemy 3 reaction (X = 790) */
    .vfx-3 { opacity: 0; animation: animVfx3 ${dur} ease-out infinite; }
    @keyframes animVfx3 {
      0%, 78.79% { opacity: 0; }
      78.80% { opacity: 1; }
      80.90% { opacity: 0; }
      100% { opacity: 0; }
    }
    .e3-left {
      transform-origin: 780px 144px;
      animation: animE3Left ${dur} ease-out infinite;
    }
    .e3-right {
      transform-origin: 800px 144px;
      animation: animE3Right ${dur} ease-out infinite;
    }
    @keyframes animE3Left {
      0%, 78.79% { opacity: 1; transform: translate(0, 0) rotate(0deg); }
      81.30% { opacity: 0; transform: translate(-20px, 12px) rotate(-35deg) scale(0.4); }
      94.79% { opacity: 0; transform: translate(0, 0); }
      97.00%, 100% { opacity: 1; transform: translate(0, 0); }
    }
    @keyframes animE3Right {
      0%, 78.79% { opacity: 1; transform: translate(0, 0) rotate(0deg); }
      81.30% { opacity: 0; transform: translate(20px, 12px) rotate(35deg) scale(0.4); }
      94.79% { opacity: 0; transform: translate(0, 0); }
      97.00%, 100% { opacity: 1; transform: translate(0, 0); }
    }

    /* Micro-animations: fluttering scarf during run */
    .scarf-strand-1 {
      animation: scarfFlutter 0.45s ease-in-out infinite alternate;
      transform-origin: -9px -52px;
    }
    .scarf-strand-2 {
      animation: scarfFlutter 0.45s ease-in-out infinite alternate;
      animation-delay: -0.2s;
      transform-origin: -8px -49px;
    }
    @keyframes scarfFlutter {
      0% { transform: rotate(-3deg) scaleY(0.9); }
      100% { transform: rotate(6deg) scaleY(1.18); }
    }

    /* Micro-animations: running legs cycling */
    .leg-l {
      animation: legCycleL 0.36s ease-in-out infinite alternate;
      transform-origin: -3px -24px;
    }
    .leg-r {
      animation: legCycleR 0.36s ease-in-out infinite alternate;
      transform-origin: -4px -24px;
    }
    @keyframes legCycleL {
      0% { transform: rotate(-16deg); }
      100% { transform: rotate(20deg); }
    }
    @keyframes legCycleR {
      0% { transform: rotate(20deg); }
      100% { transform: rotate(-16deg); }
    }

    /* Reduced motion accessibility */
    @media (prefers-reduced-motion: reduce) {
      #ninja-carrier, .ghost-1, .ghost-2, .vfx-1, .vfx-2, .vfx-3,
      .e1-top, .e1-bot, .e2-top, .e2-bot, .e3-left, .e3-right {
        animation: none !important;
      }
      .ghost-1, .ghost-2, .vfx-1, .vfx-2, .vfx-3 { display: none; }
      #ninja-carrier { transform: translate(360px, ${GROUND_Y}px); }
    }
  `;

  // 10. Assemble full SVG document
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="Cinematic shadow ninja journey across 5-row combat grid">
      <title>Cinematic Shadow Ninja — 5-Row Action Sequence</title>
      <style><![CDATA[
${css}
      ]]></style>
      <defs>
        ${ninjaRigDef}
      </defs>
      <!-- Background canvas -->
      <rect width="${WIDTH}" height="${HEIGHT}" class="bg"/>
      <!-- 5-Row Lanes -->
      ${lanesSvg}
      <!-- Lane guide markers -->
      ${laneMarkers}
      <!-- 5-Row Matrix Cells -->
      ${cellsSvg}
      <!-- Ground Platform Rail -->
      ${railSvg}
      <!-- Obstacles and Enemies in world space -->
      ${spikeSvg}
      ${barrierSvg}
      ${enemy1Svg}
      ${enemy2Svg}
      ${enemy3Svg}
      <!-- Attack VFX -->
      ${vfx1Svg}
      ${vfx2Svg}
      ${vfx3Svg}
      <!-- Cinematic Ghost Shadow Clones (After-images) -->
      <use class="ghost-2" href="#ninja-char"/>
      <use class="ghost-1" href="#ninja-char"/>
      <!-- Ninja Character Carrier -->
      <g id="ninja-carrier">
        <use href="#ninja-char"/>
      </g>
    </svg>
  `.trim();
}

// ---------- execution ----------
console.log(`Generating Cinematic Ninja Animation for user: "${user}"...`);
const grid = await fetchContributions(user);
mkdirSync(outDir, { recursive: true });

for (const theme of ["dark", "light"]) {
  const svg = buildSvg(grid, theme);
  const file = join(outDir, `ninja-${theme}.svg`);
  writeFileSync(file, svg, "utf-8");
  console.log(`✓ Wrote ${file} (${(svg.length / 1024).toFixed(1)} KB, 5 rows, ${T.toFixed(1)}s loop)`);
}
