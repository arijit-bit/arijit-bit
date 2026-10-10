#!/usr/bin/env node
// Feudal Japan / Edo Shinobi Profile Animation Generator (zero dependencies, Node 18+).
//
// Theme: Traditional Japanese / Feudal Edo
// - Moonlit midnight sky with radiant full moon, distant pagoda silhouettes, bamboo stalks,
//   and blowing Sakura (cherry blossom) petals drifting across 5 distinct movement lanes.
// - Authentic Torii gate and traditional wooden bridge rails.
// - 5 rows of contribution tiles styled as ancient moss-stone / jade seals.
// - Shinobi Ronin character (~60px tall, 2 rows) with flowing haori coat & crimson scarf ribbons.
// - 4-frame fluid Edo sprint with authentic low-center-of-gravity stride & vertical bounce.
// - 360° aerial somersault flip over bamboo spike barricade.
// - 360° ground combat roll under suspended Torii lantern beam.
// - Sword combat with Calligraphic Sumi-e Ink and Crimson blade trails.
// - Climactic Demon Oni Mini-Boss encounter at the climax with horns, glowing eyes,
//   and dramatic spirit shatter explosion into swirling sakura petals!
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

// ---------- Edo Japanese Palettes ----------
const PALETTES = {
  dark: {
    bg: "#090d16",
    moon: "#fffbe8",
    moonHalo: "rgba(255, 251, 232, 0.12)",
    moonCrater: "rgba(217, 203, 163, 0.35)",
    toriiBeam: "#b91c1c",
    toriiGlow: "#ef4444",
    toriiCap: "#18181b",
    toriiPillar: "#991b1b",
    laneLine: "rgba(244, 114, 182, 0.08)",
    laneRowBg: [
      "rgba(15, 23, 42, 0.5)",
      "rgba(9, 13, 22, 0.3)",
      "rgba(15, 23, 42, 0.5)",
      "rgba(9, 13, 22, 0.3)",
      "rgba(15, 23, 42, 0.5)",
    ],
    emptyCell: "#131b2c",
    levels: ["#064e3b", "#047857", "#10b981", "#34d399"], // Jade seals
    bridgeRail: "#78350f",
    bridgePost: "#92400e",
    bridgeGlow: "rgba(239, 68, 68, 0.3)",
    sakura1: "#f472b6",
    sakura2: "#fbcfe8",
    sakuraGlow: "rgba(244, 114, 182, 0.6)",
    // Shinobi Ronin
    shinobiSuit: "#0f172a",
    shinobiHaori: "#1e293b",
    shinobiArmor: "#334155",
    shinobiKasa: "#d97706",
    scarf: "#f43f5e", // Crimson silk ribbon
    scarfLight: "#fb7185",
    eye: "#ffffff",
    katanaBlade: "#ffffff",
    katanaEdge: "#f43f5e",
    katanaHilt: "#e11d48",
    katanaGuard: "#f59e0b",
    // VFX: Sumi-e ink + crimson blade trails
    slashCore: "#ffffff",
    slashGlow: "#e11d48",
    slashInk: "#090d16",
    slashTrail: "rgba(225, 29, 72, 0.35)",
    spark: "#fb7185",
    sparkAlt: "#fbbf24",
    // Enemies & Mini-Boss
    enemyBody: "#1e1b4b",
    enemyArmor: "#312e81",
    enemyEye: "#f43f5e",
    // Demon Oni Mini-Boss
    oniBody: "#7f1d1d",
    oniArmor: "#1c1917",
    oniHorns: "#fbbf24",
    oniEye: "#fef08a",
    oniMask: "#991b1b",
    oniClub: "#292524",
    oniClubSpikes: "#f59e0b",
    textMuted: "#64748b",
    laneLabel: "#f43f5e",
  },
  light: {
    bg: "#fdfbf7",
    moon: "#e2e8f0",
    moonHalo: "rgba(203, 213, 225, 0.2)",
    moonCrater: "rgba(148, 163, 184, 0.3)",
    toriiBeam: "#b91c1c",
    toriiGlow: "rgba(185, 28, 28, 0.2)",
    toriiCap: "#1c1917",
    toriiPillar: "#991b1b",
    laneLine: "rgba(0, 0, 0, 0.05)",
    laneRowBg: [
      "rgba(245, 240, 230, 0.55)",
      "rgba(253, 251, 247, 0.35)",
      "rgba(245, 240, 230, 0.55)",
      "rgba(253, 251, 247, 0.35)",
      "rgba(245, 240, 230, 0.55)",
    ],
    emptyCell: "#e7e2d7",
    levels: ["#a7f3d0", "#34d399", "#059669", "#047857"],
    bridgeRail: "#78350f",
    bridgePost: "#92400e",
    bridgeGlow: "rgba(185, 28, 28, 0.2)",
    sakura1: "#ec4899",
    sakura2: "#f472b6",
    sakuraGlow: "rgba(236, 72, 153, 0.4)",
    // Shinobi Ronin
    shinobiSuit: "#1c1917",
    shinobiHaori: "#292524",
    shinobiArmor: "#44403c",
    shinobiKasa: "#b45309",
    scarf: "#dc2626",
    scarfLight: "#ef4444",
    eye: "#ffffff",
    katanaBlade: "#1c1917",
    katanaEdge: "#dc2626",
    katanaHilt: "#b91c1c",
    katanaGuard: "#d97706",
    // VFX
    slashCore: "#1c1917",
    slashGlow: "#dc2626",
    slashInk: "#1c1917",
    slashTrail: "rgba(220, 38, 38, 0.25)",
    spark: "#dc2626",
    sparkAlt: "#d97706",
    // Enemies & Mini-Boss
    enemyBody: "#3f3f46",
    enemyArmor: "#52525b",
    enemyEye: "#b91c1c",
    oniBody: "#831843",
    oniArmor: "#27272a",
    oniHorns: "#d97706",
    oniEye: "#dc2626",
    oniMask: "#9f1239",
    oniClub: "#18181b",
    oniClubSpikes: "#d97706",
    textMuted: "#78716c",
    laneLabel: "#dc2626",
  },
};

// ---------- contributions fetch with fallback ----------
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

// ---------- animation timing (total 18.0s cinematic loop) ----------
const T = 18.0;
const pct = (s) => ((s / T) * 100).toFixed(3);

// Key Choreography Benchmarks (seconds):
const EVT = {
  enter: 0.0,
  // 1. Jumping 360° somersault roll over bamboo spike barricade at X = 220
  jumpStart: 2.1,
  jumpFlipStart: 2.3,
  jumpApex: 2.8,
  jumpFlipEnd: 3.3,
  jumpLand: 3.5,
  jumpRecover: 3.8,
  // 2. Enemy 1 (Corrupted Ronin at X = 350) — Horizontal Calligraphy Slash
  e1Approach: 4.9,
  e1Windup: 5.2,
  e1Hit: 5.5,
  e1Recover: 6.0,
  // 3. Ground 360° combat forward roll under Torii Lantern Gate at X = 530
  rollStart: 7.5,
  rollSpinStart: 7.8,
  rollUnder: 8.4,
  rollSpinEnd: 9.0,
  rollEnd: 9.3,
  rollRecover: 9.7,
  // 4. Enemy 2 (Shadow Assassin at X = 650) — Diagonal Crescent Slice
  e2Approach: 10.7,
  e2Windup: 11.0,
  e2Hit: 11.3,
  e2Recover: 11.8,
  // 5. CLIMACTIC MINI-BOSS BATTLE: Demon Oni Warlord at X = 780!
  bossApproach: 12.6,
  bossLeap: 13.0,
  bossStrike: 13.5, // Ultimate Sakura Iaijutsu Strike!
  bossShatter: 13.7, // Oni breaks apart into spirit embers
  bossSheath: 14.3, // Samurai flicks blade & clicks scabbard (Noto)
  bossRecover: 15.0,
  // Exit Sprint into the moonlight
  exitDash: 16.2,
  offscreen: 16.6,
  respawn: 17.2,
  loopEnd: 18.0,
};

// Shinobi trajectory points: [time_sec, x, y_offset_from_ground]
const NINJA_TRAJECTORY = [
  [0.0, -80, 0],
  [1.0, 30, 0],
  [EVT.jumpStart - 0.2, 160, 0],
  [EVT.jumpStart, 180, 2], // Anticipation crouch before somersault
  [EVT.jumpStart + 0.35, 200, -36], // Rising
  [EVT.jumpApex, 220, -52], // Aerial somersault apex soaring over spikes
  [EVT.jumpApex + 0.35, 240, -32], // Falling
  [EVT.jumpLand, 260, 2], // Cushioned landing
  [EVT.jumpRecover, 280, 0], // Rebounded into run
  [EVT.e1Windup, 320, 0],
  [EVT.e1Hit, 350, 0], // Slash impact on Bandit
  [EVT.e1Recover, 375, 0],
  [6.8, 460, 0], // Uninterrupted moonlit run
  [EVT.rollStart, 495, 0], // Diving into ground combat roll
  [EVT.rollUnder - 0.3, 520, 0], // Rolling under Torii gate
  [EVT.rollUnder + 0.3, 545, 0],
  [EVT.rollEnd, 570, 0], // Rolling out onto knee
  [EVT.rollRecover, 590, 0], // Rising into sprint
  [EVT.e2Windup, 625, 0],
  [EVT.e2Hit, 650, 0], // Diagonal slice on Assassin
  [EVT.e2Recover, 675, 0],
  [EVT.bossApproach, 725, 0],
  [EVT.bossLeap, 750, -22], // High aerial leap toward Demon Oni
  [EVT.bossStrike, 775, 0], // Ultimate downward Iaijutsu execution!
  [EVT.bossSheath, 785, 2], // Sword sheathing pose
  [EVT.bossRecover, 805, 0],
  [EVT.exitDash, 920, 0],
  [EVT.offscreen, 1000, 0], // Exited right
  [EVT.loopEnd - 0.01, 1000, 0],
  [EVT.loopEnd, -80, 0], // Instant reset
];

// ---------- SVG builder ----------
function buildSvg(grid, theme) {
  const p = PALETTES[theme];

  // 1. Distant Moon, Fog, and Bamboo Pagoda Silhouettes
  const moonX = 810;
  const moonY = 38;
  const moonR = 26;
  const skyBackground = `
    <!-- Glowing Full Moon -->
    <circle cx="${moonX}" cy="${moonY}" r="${moonR + 18}" fill="${p.moonHalo}"/>
    <circle cx="${moonX}" cy="${moonY}" r="${moonR + 8}" fill="${p.moonHalo}"/>
    <circle cx="${moonX}" cy="${moonY}" r="${moonR}" fill="${p.moon}"/>
    <!-- Lunar crater details -->
    <circle cx="${moonX - 8}" cy="${moonY - 6}" r="6" fill="${p.moonCrater}"/>
    <circle cx="${moonX + 9}" cy="${moonY + 7}" r="5" fill="${p.moonCrater}"/>
    <circle cx="${moonX - 3}" cy="${moonY + 11}" r="4" fill="${p.moonCrater}"/>
    <!-- Distant Pagoda & Mountain Silhouettes -->
    <path d="M 0,90 Q 60,65 140,85 T 280,80 T 420,95 T 560,75 T 700,90 T 850,70 L 920,85 L 920,170 L 0,170 Z" fill="${p.bg}" opacity="0.35"/>
  `;

  // 2. 5 Distinct Movement Lanes with Torii & Bamboo Motifs
  let lanesSvg = "";
  for (let r = 0; r < ROWS; r++) {
    const y = PAD_TOP + r * ROW_H;
    const bgCol = p.laneRowBg[r];
    lanesSvg += `<rect x="0" y="${y}" width="${WIDTH}" height="${ROW_H}" fill="${bgCol}"/>`;
    if (r > 0) {
      lanesSvg += `<line x1="0" y1="${y}" x2="${WIDTH}" y2="${y}" stroke="${p.laneLine}" stroke-dasharray="3,7" stroke-width="1"/>`;
    }
  }

  // Row Indicators on left margin (Traditional Kanji + English)
  let laneMarkers = "";
  const laneNames = ["一 · SKY", "二 · MIST", "三 · BAMBOO", "四 · TORII", "五 · PATH"];
  for (let r = 0; r < ROWS; r++) {
    const y = PAD_TOP + r * ROW_H + ROW_H / 2 + 3;
    laneMarkers += `<text x="8" y="${y}" fill="${p.textMuted}" font-family="serif, 'Hiragino Mincho Pro', sans-serif" font-size="7.5" font-weight="600" letter-spacing="0.8" opacity="0.75">${laneNames[r]}</text>`;
  }

  // 3. Contribution Grid Cells: Ancient Jade / Moss Stone Seals
  let cellsSvg = "";
  for (let r = 0; r < ROWS; r++) {
    const cy = PAD_TOP + r * ROW_H + (ROW_H - CELL_SIZE) / 2;
    for (let c = 0; c < COLS; c++) {
      const cx = GRID_START_X + c * CELL_PITCH;
      const level = grid[r][c] || 0;
      const fill = level === 0 ? p.emptyCell : p.levels[Math.min(level - 1, 3)];
      const op = level === 0 ? "0.35" : "0.95";
      cellsSvg += `<rect x="${cx}" y="${cy}" width="${CELL_SIZE}" height="${CELL_SIZE}" rx="2" fill="${fill}" opacity="${op}"/>`;
    }
  }

  // 4. Traditional Wooden Bridge Ground Rail at GROUND_Y (170)
  const railSvg = `
    <!-- Wooden bridge plank floor -->
    <line x1="0" y1="${GROUND_Y}" x2="${WIDTH}" y2="${GROUND_Y}" stroke="${p.bridgeRail}" stroke-width="2.5"/>
    <line x1="0" y1="${GROUND_Y + 2}" x2="${WIDTH}" y2="${GROUND_Y + 2}" stroke="${p.bridgePost}" stroke-width="1.5" opacity="0.8"/>
    <!-- Guard posts & hanging lanterns -->
    ${Array.from({ length: 23 }, (_, i) => `
      <rect x="${i * 40 + 6}" y="${GROUND_Y - 4}" width="4" height="8" rx="1" fill="${p.bridgePost}"/>
      <circle cx="${i * 40 + 8}" cy="${GROUND_Y - 5}" r="2.2" fill="${p.toriiBeam}" opacity="0.8"/>
    `).join("")}
  `;

  // 5. Blowing Sakura Petals (animated drifting cherry blossom petals)
  const sakuraSvg = `
    <g class="sakura-wind">
      <ellipse class="sakura s1" cx="120" cy="40" rx="3.5" ry="2" fill="${p.sakura1}"/>
      <ellipse class="sakura s2" cx="280" cy="70" rx="4" ry="2.2" fill="${p.sakura2}"/>
      <ellipse class="sakura s3" cx="440" cy="30" rx="3.2" ry="1.8" fill="${p.sakura1}"/>
      <ellipse class="sakura s4" cx="590" cy="85" rx="3.8" ry="2" fill="${p.sakura2}"/>
      <ellipse class="sakura s5" cx="720" cy="50" rx="3" ry="1.7" fill="${p.sakura1}"/>
      <ellipse class="sakura s6" cx="870" cy="65" rx="3.6" ry="2" fill="${p.sakura2}"/>
      <ellipse class="sakura s7" cx="200" cy="115" rx="3.5" ry="1.9" fill="${p.sakura1}"/>
      <ellipse class="sakura s8" cx="510" cy="125" rx="3.2" ry="1.8" fill="${p.sakura2}"/>
      <ellipse class="sakura s9" cx="820" cy="110" rx="4" ry="2.1" fill="${p.sakura1}"/>
    </g>
  `;

  // 6. Obstacle 1: Bamboo Stake Barricade at X = 220 (Low obstacle - jump somersault)
  const spikeX = 220;
  const spikeSvg = `
    <g id="bamboo-spikes">
      <!-- Sharpened bamboo stakes lashed together -->
      <polygon points="${spikeX - 16},170 ${spikeX - 11},146 ${spikeX - 6},170" fill="#a16207"/>
      <polygon points="${spikeX - 8},170 ${spikeX - 1},142 ${spikeX + 5},170" fill="#ca8a04"/>
      <polygon points="${spikeX + 3},170 ${spikeX + 10},148 ${spikeX + 16},170" fill="#a16207"/>
      <!-- Bamboo segment rings & cut angle highlights -->
      <line x1="${spikeX - 13}" y1="156" x2="${spikeX - 8}" y2="156" stroke="#4d2c00" stroke-width="1.2"/>
      <line x1="${spikeX - 4}" y1="154" x2="${spikeX + 1}" y2="154" stroke="#4d2c00" stroke-width="1.2"/>
      <line x1="${spikeX + 7}" y1="158" x2="${spikeX + 12}" y2="158" stroke="#4d2c00" stroke-width="1.2"/>
      <!-- Rope lashings & warning seal -->
      <line x1="${spikeX - 18}" y1="164" x2="${spikeX + 18}" y2="164" stroke="#eab308" stroke-width="2" stroke-dasharray="3,2"/>
    </g>
  `;

  // 7. Obstacle 2: Sacred Torii Shrine Gate with Hanging Lanterns at X = 530
  // Clearance under Torii crossbeam = 28px (ninja rolls 360° forward underneath!)
  const toriiX = 530;
  const toriiSvg = `
    <g id="torii-gate">
      <!-- Curved Top Kasagi Beam -->
      <path d="M ${toriiX - 30},12 Q ${toriiX},6 ${toriiX + 30},12 L ${toriiX + 28},19 Q ${toriiX},13 ${toriiX - 28},19 Z" fill="${p.toriiCap}"/>
      <!-- Primary Vermilion Shimaki Crossbeam -->
      <rect x="${toriiX - 26}" y="19" width="52" height="7" rx="1.5" fill="${p.toriiBeam}"/>
      <!-- Secondary Nuki Tie-beam at y = 40 -->
      <rect x="${toriiX - 24}" y="40" width="48" height="4.5" rx="1" fill="${p.toriiBeam}"/>
      <!-- Twin Vermilion Pillars grounded to path -->
      <rect x="${toriiX - 20}" y="19" width="6" height="151" fill="${p.toriiPillar}"/>
      <rect x="${toriiX + 14}" y="19" width="6" height="151" fill="${p.toriiPillar}"/>
      <!-- Stone Pedestal Base Feet (Kamebara) at ground level -->
      <rect x="${toriiX - 22}" y="166" width="10" height="4" rx="1" fill="${p.toriiCap}"/>
      <rect x="${toriiX + 12}" y="166" width="10" height="4" rx="1" fill="${p.toriiCap}"/>
      <!-- Mid-height Lintel & Sacred Shimenawa Rope at y = 132 -->
      <rect x="${toriiX - 20}" y="132" width="40" height="3" rx="0.5" fill="${p.toriiBeam}"/>
      <path d="M ${toriiX - 19},134 Q ${toriiX},138 ${toriiX + 19},134" stroke="#fef08a" stroke-width="1.8" fill="none"/>
      <polygon points="${toriiX - 9},135 ${toriiX - 6},135 ${toriiX - 8},142 ${toriiX - 11},142" fill="#ffffff"/>
      <polygon points="${toriiX + 6},135 ${toriiX + 9},135 ${toriiX + 7},142 ${toriiX + 4},142" fill="#ffffff"/>
      <!-- Hanging Paper Lantern in center (clearance below lantern = 28px) -->
      <rect x="${toriiX - 4.5}" y="132" width="9" height="10" rx="2" fill="${p.toriiBeam}"/>
      <circle cx="${toriiX}" cy="137" r="2.5" fill="#fef08a"/>
    </g>
  `;

  // 8. Regular Enemies (Corrupted Bandits & Shadow Assassins):
  const enemy1Svg = `
    <g id="enemy-1" class="e1-group">
      <!-- Top half: Rogue Bandit with Straw Cape & Mask -->
      <g class="e1-top">
        <path d="M 340,147 L 344,128 L 356,128 L 360,147 Z" fill="${p.enemyBody}" stroke="${p.enemyArmor}" stroke-width="1.3"/>
        <ellipse cx="350" cy="133" rx="7" ry="5" fill="${p.toriiCap}"/>
        <rect x="345" y="135" width="10" height="2.5" rx="1" fill="${p.enemyEye}"/>
      </g>
      <!-- Bottom half: Hakama & Tabi -->
      <g class="e1-bot">
        <path d="M 339,148 L 361,148 L 358,170 L 342,170 Z" fill="${p.enemyBody}" stroke="${p.enemyArmor}" stroke-width="1.3"/>
        <line x1="350" y1="152" x2="350" y2="168" stroke="${p.enemyArmor}" stroke-width="1"/>
      </g>
    </g>
  `;

  const enemy2Svg = `
    <g id="enemy-2" class="e2-group">
      <!-- Upper piece: Shadow Ronin with Jingasa helmet -->
      <g class="e2-top">
        <polygon points="640,128 660,128 663,152 646,148" fill="${p.enemyBody}" stroke="${p.enemyArmor}" stroke-width="1.3"/>
        <polygon points="636,132 664,132 650,126" fill="${p.toriiCap}"/>
        <rect x="645" y="136" width="9" height="2.5" rx="1" fill="${p.enemyEye}"/>
      </g>
      <!-- Lower piece: Armored greaves -->
      <g class="e2-bot">
        <polygon points="640,130 647,149 662,153 659,170 642,170 638,151" fill="${p.enemyBody}" stroke="${p.enemyArmor}" stroke-width="1.3"/>
      </g>
    </g>
  `;

  // 9. CLIMACTIC MINI-BOSS: Imposing Demon Oni Warlord (at X = 780)!
  // Stature: Taller (spans ~2.4 rows!), horned Oni demon mask, glowing eyes, massive spiked Kanabo club!
  const bossSvg = `
    <g id="mini-boss-oni" class="boss-group">
      <!-- Left side of Demon Oni -->
      <g class="boss-left">
        <!-- Horn left -->
        <path d="M 776,110 C 772,98 764,96 760,94 C 764,103 770,111 774,114 Z" fill="${p.oniHorns}"/>
        <!-- Mask & Head Left -->
        <path d="M 778,112 L 766,118 L 768,136 L 778,144 Z" fill="${p.oniMask}" stroke="${p.oniArmor}" stroke-width="1.4"/>
        <circle cx="771" cy="124" r="3" fill="${p.oniEye}"/>
        <!-- Torso & Armor Left -->
        <path d="M 778,144 L 760,148 L 763,170 L 778,170 Z" fill="${p.oniBody}" stroke="${p.oniArmor}" stroke-width="1.5"/>
        <polygon points="764,136 754,142 760,154" fill="${p.oniArmor}"/>
      </g>
      <!-- Right side of Demon Oni + Giant Kanabo Club -->
      <g class="boss-right">
        <!-- Horn right -->
        <path d="M 780,110 C 784,98 792,96 796,94 C 792,103 786,111 782,114 Z" fill="${p.oniHorns}"/>
        <!-- Mask & Head Right -->
        <path d="M 778,112 L 790,118 L 788,136 L 778,144 Z" fill="${p.oniMask}" stroke="${p.oniArmor}" stroke-width="1.4"/>
        <circle cx="785" cy="124" r="3" fill="${p.oniEye}"/>
        <!-- Torso & Armor Right -->
        <path d="M 778,144 L 796,148 L 793,170 L 778,170 Z" fill="${p.oniBody}" stroke="${p.oniArmor}" stroke-width="1.5"/>
        <polygon points="792,136 802,142 796,154" fill="${p.oniArmor}"/>
        <!-- Giant Iron Kanabo Club held in hand -->
        <path d="M 796,146 L 808,124 L 814,127 L 802,149 Z" fill="${p.oniClub}"/>
        <circle cx="810" cy="124" r="2.2" fill="${p.oniClubSpikes}"/>
        <circle cx="806" cy="131" r="2.2" fill="${p.oniClubSpikes}"/>
        <circle cx="803" cy="138" r="2.2" fill="${p.oniClubSpikes}"/>
      </g>
    </g>
  `;

  // 10. Visual Effects (Calligraphic Sumi-e & Crimson Slashes + Boss Sakura Burst)
  // Attack 1: Horizontal Calligraphy Slash (at X = 350)
  const vfx1Svg = `
    <g class="vfx-1">
      <path d="M 305,152 Q 345,138 410,144 Q 350,152 305,152 Z" fill="${p.slashTrail}"/>
      <path d="M 300,150 Q 350,140 415,146" stroke="${p.slashGlow}" stroke-width="5" stroke-linecap="round" fill="none" opacity="0.9"/>
      <path d="M 302,150 Q 350,140 413,146" stroke="${p.slashCore}" stroke-width="2" stroke-linecap="round" fill="none"/>
      <!-- Cherry blossom impact spark petals -->
      <ellipse cx="360" cy="138" rx="3.5" ry="2" fill="${p.sakura1}"/>
      <ellipse cx="372" cy="148" rx="4" ry="2.2" fill="${p.sakura2}"/>
      <circle cx="350" cy="146" r="2" fill="${p.sparkAlt}"/>
    </g>
  `;

  // Attack 2: Diagonal Crescent Slice (at X = 650)
  const vfx2Svg = `
    <g class="vfx-2">
      <path d="M 610,105 Q 648,136 686,168 Q 655,146 618,115 Z" fill="${p.slashTrail}"/>
      <path d="M 608,103 Q 650,140 690,170" stroke="${p.slashGlow}" stroke-width="5.2" stroke-linecap="round" fill="none" opacity="0.9"/>
      <path d="M 610,105 Q 650,140 688,168" stroke="${p.slashCore}" stroke-width="2.2" stroke-linecap="round" fill="none"/>
      <ellipse cx="660" cy="134" rx="4" ry="2" fill="${p.sakura1}"/>
      <circle cx="672" cy="150" r="2.2" fill="${p.sparkAlt}"/>
      <circle cx="640" cy="120" r="1.8" fill="${p.spark}"/>
    </g>
  `;

  // Attack 3: CLIMACTIC BOSS EXECUTION: Sakura Iaijutsu Blossom Cleave (at X = 780)!
  const vfxBossSvg = `
    <g class="vfx-boss">
      <!-- Massive Radiant Curved Slash Arc -->
      <path d="M 750,65 Q 815,115 775,174 Q 760,125 745,80 Z" fill="${p.slashTrail}"/>
      <path d="M 746,62 Q 820,118 775,176" stroke="${p.slashGlow}" stroke-width="6.5" stroke-linecap="round" fill="none" opacity="0.95"/>
      <path d="M 748,64 Q 818,118 775,174" stroke="${p.slashCore}" stroke-width="2.8" stroke-linecap="round" fill="none"/>
      <!-- Dramatic Sakura Petal Blossom Explosion -->
      <ellipse cx="780" cy="115" rx="5" ry="2.5" fill="${p.sakura1}"/>
      <ellipse cx="795" cy="126" rx="4.5" ry="2.2" fill="${p.sakura2}"/>
      <ellipse cx="765" cy="132" rx="4.8" ry="2.4" fill="${p.sakura1}"/>
      <ellipse cx="805" cy="145" rx="5.2" ry="2.6" fill="${p.sakura2}"/>
      <ellipse cx="760" cy="150" rx="4" ry="2" fill="${p.sakura1}"/>
      <!-- Impact Shockwave Star -->
      <polygon points="780,120 784,133 798,137 784,141 780,154 776,141 762,137 776,133" fill="${p.slashCore}"/>
      <circle cx="780" cy="137" r="4" fill="${p.sparkAlt}"/>
    </g>
  `;

  // 11. Shinobi Ronin Character Rig:
  // Height: ~60px (2 rows).
  // Features:
  // - Traditional Ronin Straw Kasa / Shinobi Hood with glowing eye slit.
  // - Flowing Haori coat ripples in the wind.
  // - Crimson silk scarf ribbons.
  // - Katana & wakizashi daisho.
  // - 4-Frame Fluid Edo Sprint.
  // - Acrobatic 360° Aerial Somersault Flip.
  // - Ground 360° Combat Forward Roll.
  // - Sword Slashes + Sword-sheathing Noto pose!
  const ninjaRigDef = `
    <g id="ninja-char">
      <!-- POSE 1: EDO RONIN SPRINT (4-Frame Stride with Haori flutter & Torso Bob) -->
      <g class="pose-run">
        <g class="run-bob">
          <!-- Flowing Crimson Silk Ribbon -->
          <path class="scarf-strand-1" d="M -8,-52 C -24,-45 -38,-62 -54,-56 C -38,-66 -22,-56 -8,-55 Z" fill="${p.scarf}"/>
          <path class="scarf-strand-2" d="M -7,-49 C -20,-42 -30,-52 -44,-48 C -28,-55 -18,-48 -7,-51 Z" fill="${p.scarfLight}" opacity="0.85"/>
          <!-- Flowing Haori Coat -->
          <path d="M -10,-46 C -18,-40 -24,-30 -22,-20 C -18,-24 -12,-30 -8,-36 Z" fill="${p.shinobiHaori}"/>
          <!-- Torso & Hakama -->
          <polygon points="-8,-46 10,-44 7,-24 -9,-24" fill="${p.shinobiSuit}" stroke="${p.shinobiArmor}" stroke-width="1.2"/>
          <polygon points="-7,-45 5,-44 3,-25 -8,-25" fill="${p.shinobiArmor}"/>
          <rect x="-10" y="-27" width="19" height="5" rx="1.5" fill="${p.scarf}"/>
          <!-- Ronin Head & Straw Kasa Hat -->
          <ellipse cx="2" cy="-53" rx="7.5" ry="7.5" fill="${p.shinobiSuit}"/>
          <!-- Conical / Angled Kasa Hat -->
          <polygon points="-12,-55 16,-52 2,-62" fill="${p.shinobiKasa}"/>
          <polygon points="1,-53 9,-53 8,-51 0,-51" fill="${p.eye}"/>
          <!-- Sheathed Katana Daisho -->
          <path d="M 1,-36 L -18,-24" stroke="${p.katanaGuard}" stroke-width="3" stroke-linecap="round"/>
          <path d="M -18,-24 L -36,-12" stroke="${p.katanaBlade}" stroke-width="2.2" stroke-linecap="round"/>
          <line x1="-18" y1="-24" x2="-36" y2="-12" stroke="${p.katanaEdge}" stroke-width="1"/>

          <!-- FRAME 1: Left Lead Contact Stride -->
          <g class="rf rf1">
            <path d="M -3,-24 L 7,-14 L 16,0" stroke="${p.shinobiSuit}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            <path d="M -4,-24 L -13,-14 L -18,-2" stroke="${p.shinobiArmor}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            <path d="M 2,-42 L 11,-32 L 18,-24" stroke="${p.shinobiSuit}" stroke-width="4.2" stroke-linecap="round" fill="none"/>
          </g>

          <!-- FRAME 2: Left Absorption / Passing Stride -->
          <g class="rf rf2">
            <path d="M -3,-24 L 8,-12 L 11,0" stroke="${p.shinobiSuit}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            <path d="M -4,-24 L -5,-12 L -2,-1" stroke="${p.shinobiArmor}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            <path d="M 2,-42 L 8,-32 L 12,-22" stroke="${p.shinobiSuit}" stroke-width="4.2" stroke-linecap="round" fill="none"/>
          </g>

          <!-- FRAME 3: Right Lead Contact Stride -->
          <g class="rf rf3">
            <path d="M -3,-24 L -13,-14 L -18,-2" stroke="${p.shinobiSuit}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            <path d="M -4,-24 L 7,-14 L 16,0" stroke="${p.shinobiArmor}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            <path d="M 2,-42 L -6,-32 L -12,-24" stroke="${p.shinobiSuit}" stroke-width="4.2" stroke-linecap="round" fill="none"/>
          </g>

          <!-- FRAME 4: Right Absorption / Passing Stride -->
          <g class="rf rf4">
            <path d="M -3,-24 L -5,-12 L -2,-1" stroke="${p.shinobiSuit}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            <path d="M -4,-24 L 8,-12 L 11,0" stroke="${p.shinobiArmor}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            <path d="M 2,-42 L 4,-32 L 6,-22" stroke="${p.shinobiSuit}" stroke-width="4.2" stroke-linecap="round" fill="none"/>
          </g>
        </g>
      </g>

      <!-- POSE 2: JUMPING 360° AERIAL SOMERSAULT FLIP (over bamboo spikes) -->
      <g class="pose-jump">
        <g class="aerial-flip-spinner">
          <circle cx="0" cy="-26" r="23" stroke="${p.slashGlow}" stroke-width="1.6" stroke-dasharray="28,14" fill="none" opacity="0.45"/>
          <path d="M -10,-34 C -26,-36 -32,-20 -28,-6 C -24,8 -8,4 -4,-2 C -12,2 -20,-10 -16,-24 Z" fill="${p.scarf}"/>
          <path d="M -13,-36 C -20,-24 -17,-10 -5,-4 C 8,-4 15,-12 13,-24 C 11,-36 1,-40 -13,-36 Z" fill="${p.shinobiSuit}" stroke="${p.shinobiArmor}" stroke-width="1.4"/>
          <ellipse cx="-4" cy="-25" rx="7.5" ry="7.5" fill="${p.shinobiSuit}"/>
          <polygon points="-7,-25 0,-25 -1,-23 -6,-23" fill="${p.eye}"/>
          <path d="M -6,-6 C 4,-4 11,-9 8,-19" stroke="${p.shinobiSuit}" stroke-width="4.5" stroke-linecap="round" fill="none"/>
          <path d="M -12,-38 C -4,-42 12,-34 22,-20" stroke="${p.katanaBlade}" stroke-width="2.6" stroke-linecap="round" fill="none"/>
          <line x1="-12" y1="-38" x2="22" y2="-20" stroke="${p.katanaEdge}" stroke-width="1.2"/>
        </g>
      </g>

      <!-- POSE 3: GROUND 360° COMBAT FORWARD ROLL (under Torii gate) -->
      <g class="pose-roll">
        <g class="ground-roll-spinner">
          <circle cx="0" cy="-13" r="14" stroke="${p.slashGlow}" stroke-width="1.4" stroke-dasharray="18,10" fill="none" opacity="0.4"/>
          <path d="M -10,-19 C -18,-17 -22,-8 -18,-1 C -12,2 -4,0 0,-3" stroke="${p.scarf}" stroke-width="2.5" fill="none"/>
          <path d="M -11,-21 C -16,-15 -15,-6 -5,-1 C 6,-1 13,-6 11,-14 C 9,-21 1,-25 -11,-21 Z" fill="${p.shinobiSuit}" stroke="${p.shinobiArmor}" stroke-width="1.3"/>
          <ellipse cx="-3" cy="-13" rx="6.5" ry="6.5" fill="${p.shinobiSuit}"/>
          <polygon points="-6,-13 0,-13 -1,-11 -5,-11" fill="${p.eye}"/>
          <path d="M -6,-2 C 3,-1 8,-4 6,-11" stroke="${p.shinobiSuit}" stroke-width="4" stroke-linecap="round" fill="none"/>
          <path d="M -10,-20 L 14,-7" stroke="${p.katanaBlade}" stroke-width="2.2" stroke-linecap="round"/>
          <circle cx="5" cy="0" r="1.6" fill="${p.sakura1}"/>
          <circle cx="-6" cy="0" r="1.4" fill="${p.sparkAlt}"/>
        </g>
      </g>

      <!-- POSE 4: HORIZONTAL IAI SLASH (Deep lunge against Bandit) -->
      <g class="pose-slash-h">
        <path d="M -16,-48 C -32,-52 -48,-46 -64,-50 C -48,-58 -32,-53 -16,-51 Z" fill="${p.scarf}"/>
        <polygon points="-12,-44 10,-42 8,-21 -10,-21" fill="${p.shinobiSuit}" stroke="${p.shinobiArmor}" stroke-width="1.2"/>
        <rect x="-12" y="-25" width="21" height="5" rx="1.5" fill="${p.scarf}"/>
        <ellipse cx="6" cy="-50" rx="8" ry="8" fill="${p.shinobiSuit}"/>
        <polygon points="5,-50 13,-50 12,-48 4,-48" fill="${p.eye}"/>
        <path d="M 6,-21 L 20,-10 L 28,0" stroke="${p.shinobiSuit}" stroke-width="5.2" stroke-linecap="round" fill="none"/>
        <path d="M -10,-21 L -24,-12 L -34,0" stroke="${p.shinobiArmor}" stroke-width="4.8" stroke-linecap="round" fill="none"/>
        <path d="M 8,-36 L 54,-33" stroke="${p.katanaBlade}" stroke-width="2.8" stroke-linecap="round"/>
        <line x1="8" y1="-36" x2="54" y2="-33" stroke="${p.katanaEdge}" stroke-width="1.4"/>
        <rect x="6" y="-39" width="3.5" height="6" rx="1" fill="${p.katanaGuard}"/>
      </g>

      <!-- POSE 5: DIAGONAL CRESCENT SLICE (against Assassin) -->
      <g class="pose-slash-d">
        <path d="M -12,-50 C -30,-58 -42,-50 -54,-54 C -40,-64 -26,-58 -12,-54 Z" fill="${p.scarf}"/>
        <polygon points="-10,-44 10,-42 6,-21 -10,-21" fill="${p.shinobiSuit}" stroke="${p.shinobiArmor}" stroke-width="1.2"/>
        <rect x="-11" y="-26" width="20" height="5" rx="1.5" fill="${p.scarf}"/>
        <ellipse cx="4" cy="-50" rx="8" ry="8" fill="${p.shinobiSuit}"/>
        <polygon points="3,-50 11,-50 10,-48 2,-48" fill="${p.eye}"/>
        <path d="M 6,-21 L 18,-8 L 22,0" stroke="${p.shinobiSuit}" stroke-width="5.2" stroke-linecap="round" fill="none"/>
        <path d="M -10,-21 L -20,-10 L -26,0" stroke="${p.shinobiArmor}" stroke-width="4.8" stroke-linecap="round" fill="none"/>
        <path d="M -3,-50 L 40,-12" stroke="${p.katanaBlade}" stroke-width="3" stroke-linecap="round"/>
        <line x1="-3" y1="-50" x2="40" y2="-12" stroke="${p.katanaEdge}" stroke-width="1.4"/>
      </g>

      <!-- POSE 6: CLIMACTIC BOSS EXECUTION / BLADE SHEATHING (Noto pose) -->
      <g class="pose-slash-o">
        <path d="M -10,-46 C -26,-38 -38,-26 -48,-18 C -36,-28 -22,-40 -10,-48 Z" fill="${p.scarf}"/>
        <!-- Dynamic low stance -->
        <polygon points="-10,-42 8,-40 6,-19 -10,-19" fill="${p.shinobiSuit}" stroke="${p.shinobiArmor}" stroke-width="1.2"/>
        <rect x="-11" y="-24" width="19" height="5" rx="1.5" fill="${p.scarf}"/>
        <ellipse cx="3" cy="-47" rx="8" ry="8" fill="${p.shinobiSuit}"/>
        <polygon points="2,-47 10,-47 9,-45 1,-45" fill="${p.eye}"/>
        <!-- Deep stance legs -->
        <path d="M 6,-19 L 14,-6 L 16,0" stroke="${p.shinobiSuit}" stroke-width="5.2" stroke-linecap="round" fill="none"/>
        <path d="M -10,-19 L -18,-8 L -20,0" stroke="${p.shinobiArmor}" stroke-width="4.8" stroke-linecap="round" fill="none"/>
        <!-- Katana brought down with two hands -->
        <path d="M 14,-56 L 26,-2" stroke="${p.katanaBlade}" stroke-width="3.4" stroke-linecap="round"/>
        <line x1="14" y1="-56" x2="26" y2="-2" stroke="${p.katanaEdge}" stroke-width="1.5"/>
        <circle cx="14" cy="-52" r="2.8" fill="${p.katanaGuard}"/>
      </g>
    </g>
  `;

  // 12. CSS Keyframes
  const ninjaKf = NINJA_TRAJECTORY.map(([time, x, y]) => {
    const pVal = pct(time);
    const ty = GROUND_Y + y;
    return `${pVal}% { transform: translate(${x.toFixed(1)}px, ${ty.toFixed(1)}px); }`;
  }).join("\n");

  const dur = `${T.toFixed(3)}s`;

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
      opacity: 0.32;
    }
    .ghost-2 {
      animation: ninjaTravel ${dur} linear infinite;
      animation-delay: -0.14s;
      opacity: 0.16;
    }
    @keyframes ninjaTravel {
      ${ninjaKf}
    }

    /* Poses visibility */
    .pose-run { animation: animRun ${dur} step-end infinite; }
    .pose-jump { opacity: 0; animation: animJump ${dur} step-end infinite; }
    .pose-roll { opacity: 0; animation: animRoll ${dur} step-end infinite; }
    .pose-slash-h { opacity: 0; animation: animSlashH ${dur} step-end infinite; }
    .pose-slash-d { opacity: 0; animation: animSlashD ${dur} step-end infinite; }
    .pose-slash-o { opacity: 0; animation: animSlashO ${dur} step-end infinite; }

    @keyframes animRun {
      0%, 11.66% { opacity: 1; }
      11.67%, 21.09% { opacity: 0; }
      21.10%, 28.88% { opacity: 1; }
      28.89%, 34.44% { opacity: 0; }
      34.45%, 41.66% { opacity: 1; }
      41.67%, 53.88% { opacity: 0; }
      53.89%, 61.10% { opacity: 1; }
      61.11%, 67.77% { opacity: 0; }
      67.78%, 72.21% { opacity: 1; }
      72.22%, 83.33% { opacity: 0; }
      83.34%, 100% { opacity: 1; }
    }

    @keyframes animJump {
      0%, 11.66% { opacity: 0; }
      11.67%, 21.09% { opacity: 1; }
      21.10%, 100% { opacity: 0; }
    }

    @keyframes animRoll {
      0%, 41.66% { opacity: 0; }
      41.67%, 53.88% { opacity: 1; }
      53.89%, 100% { opacity: 0; }
    }

    @keyframes animSlashH {
      0%, 28.88% { opacity: 0; }
      28.89%, 34.44% { opacity: 1; }
      34.45%, 100% { opacity: 0; }
    }

    @keyframes animSlashD {
      0%, 61.10% { opacity: 0; }
      61.11%, 67.77% { opacity: 1; }
      67.78%, 100% { opacity: 0; }
    }

    @keyframes animSlashO {
      0%, 72.21% { opacity: 0; }
      72.22%, 83.33% { opacity: 1; }
      83.34%, 100% { opacity: 0; }
    }

    /* Edo Run Mechanics */
    .run-bob {
      animation: runBob 0.36s ease-in-out infinite;
    }
    @keyframes runBob {
      0%, 50%, 100% { transform: translateY(0px); }
      25%, 75% { transform: translateY(-2.5px); }
    }

    .rf { opacity: 0; }
    .rf1 { animation: cycleRf1 0.36s step-end infinite; }
    .rf2 { animation: cycleRf2 0.36s step-end infinite; }
    .rf3 { animation: cycleRf3 0.36s step-end infinite; }
    .rf4 { animation: cycleRf4 0.36s step-end infinite; }

    @keyframes cycleRf1 {
      0%, 24.99% { opacity: 1; }
      25.00%, 100% { opacity: 0; }
    }
    @keyframes cycleRf2 {
      0%, 24.99% { opacity: 0; }
      25.00%, 49.99% { opacity: 1; }
      50.00%, 100% { opacity: 0; }
    }
    @keyframes cycleRf3 {
      0%, 49.99% { opacity: 0; }
      50.00%, 74.99% { opacity: 1; }
      75.00%, 100% { opacity: 0; }
    }
    @keyframes cycleRf4 {
      0%, 74.99% { opacity: 0; }
      75.00%, 100% { opacity: 1; }
    }

    /* 360° Aerial Somersault Jump over bamboo stakes */
    .aerial-flip-spinner {
      transform-origin: 0px -26px;
      animation: animAerialSomersault ${dur} linear infinite;
    }
    @keyframes animAerialSomersault {
      0%, ${pct(EVT.jumpFlipStart)}% { transform: rotate(0deg); }
      ${pct(EVT.jumpFlipEnd)}%, 100% { transform: rotate(360deg); }
    }

    /* 360° Ground Combat Roll under Torii Gate */
    .ground-roll-spinner {
      transform-origin: 0px -13px;
      animation: animGroundRoll ${dur} linear infinite;
    }
    @keyframes animGroundRoll {
      0%, ${pct(EVT.rollSpinStart)}% { transform: rotate(0deg); }
      ${pct(EVT.rollSpinEnd)}%, 100% { transform: rotate(360deg); }
    }

    /* Attack 1 VFX and Bandit reaction (X = 350) */
    .vfx-1 { opacity: 0; animation: animVfx1 ${dur} ease-out infinite; }
    @keyframes animVfx1 {
      0%, 30.29% { opacity: 0; }
      30.30% { opacity: 1; }
      32.50% { opacity: 0; }
      100% { opacity: 0; }
    }
    .e1-top {
      transform-origin: 350px 147px;
      animation: animE1Top ${dur} ease-out infinite;
    }
    .e1-bot {
      transform-origin: 350px 148px;
      animation: animE1Bot ${dur} ease-out infinite;
    }
    @keyframes animE1Top {
      0%, 30.55% { opacity: 1; transform: translate(0, 0) rotate(0deg); }
      33.00% { opacity: 0; transform: translate(24px, -14px) rotate(35deg) scale(0.3); }
      95.55% { opacity: 0; transform: translate(0, 0) rotate(0deg); }
      97.50%, 100% { opacity: 1; transform: translate(0, 0) rotate(0deg); }
    }
    @keyframes animE1Bot {
      0%, 30.55% { opacity: 1; transform: translate(0, 0); }
      33.00% { opacity: 0; transform: translate(-10px, 12px) scale(0.3); }
      95.55% { opacity: 0; transform: translate(0, 0); }
      97.50%, 100% { opacity: 1; transform: translate(0, 0); }
    }

    /* Attack 2 VFX and Assassin reaction (X = 650) */
    .vfx-2 { opacity: 0; animation: animVfx2 ${dur} ease-out infinite; }
    @keyframes animVfx2 {
      0%, 62.49% { opacity: 0; }
      62.50% { opacity: 1; }
      64.60% { opacity: 0; }
      100% { opacity: 0; }
    }
    .e2-top {
      transform-origin: 650px 145px;
      animation: animE2Top ${dur} ease-out infinite;
    }
    .e2-bot {
      transform-origin: 650px 145px;
      animation: animE2Bot ${dur} ease-out infinite;
    }
    @keyframes animE2Top {
      0%, 62.77% { opacity: 1; transform: translate(0, 0) rotate(0deg); }
      65.20% { opacity: 0; transform: translate(24px, -16px) rotate(40deg) scale(0.3); }
      95.55% { opacity: 0; transform: translate(0, 0); }
      97.50%, 100% { opacity: 1; transform: translate(0, 0); }
    }
    @keyframes animE2Bot {
      0%, 62.77% { opacity: 1; transform: translate(0, 0) rotate(0deg); }
      65.20% { opacity: 0; transform: translate(-14px, 14px) rotate(-24deg) scale(0.3); }
      95.55% { opacity: 0; transform: translate(0, 0); }
      97.50%, 100% { opacity: 1; transform: translate(0, 0); }
    }

    /* CLIMACTIC MINI-BOSS BATTLE: Demon Oni Warlord (X = 780) */
    .vfx-boss { opacity: 0; animation: animVfxBoss ${dur} ease-out infinite; }
    @keyframes animVfxBoss {
      0%, 74.89% { opacity: 0; }
      74.90% { opacity: 1; }
      78.00% { opacity: 0; }
      100% { opacity: 0; }
    }
    .boss-left {
      transform-origin: 770px 140px;
      animation: animBossLeft ${dur} ease-out infinite;
    }
    .boss-right {
      transform-origin: 790px 140px;
      animation: animBossRight ${dur} ease-out infinite;
    }
    @keyframes animBossLeft {
      0%, 75.20% { opacity: 1; transform: translate(0, 0) rotate(0deg); }
      78.50% { opacity: 0; transform: translate(-28px, -18px) rotate(-45deg) scale(0.2); }
      95.55% { opacity: 0; transform: translate(0, 0) rotate(0deg); }
      97.50%, 100% { opacity: 1; transform: translate(0, 0) rotate(0deg); }
    }
    @keyframes animBossRight {
      0%, 75.20% { opacity: 1; transform: translate(0, 0) rotate(0deg); }
      78.50% { opacity: 0; transform: translate(28px, -18px) rotate(45deg) scale(0.2); }
      95.55% { opacity: 0; transform: translate(0, 0) rotate(0deg); }
      97.50%, 100% { opacity: 1; transform: translate(0, 0) rotate(0deg); }
    }

    /* Drifting Sakura Petals Wind Animation */
    .sakura {
      animation: sakuraFloat 6s ease-in-out infinite;
    }
    .s1 { animation-delay: 0.0s; }
    .s2 { animation-delay: 1.2s; }
    .s3 { animation-delay: 2.5s; }
    .s4 { animation-delay: 3.8s; }
    .s5 { animation-delay: 4.9s; }
    .s6 { animation-delay: 0.7s; }
    .s7 { animation-delay: 2.1s; }
    .s8 { animation-delay: 3.4s; }
    .s9 { animation-delay: 4.3s; }
    @keyframes sakuraFloat {
      0% { transform: translate(0, 0) rotate(0deg); opacity: 0.8; }
      50% { transform: translate(35px, 12px) rotate(120deg); opacity: 0.95; }
      100% { transform: translate(70px, 24px) rotate(240deg); opacity: 0.6; }
    }

    /* Crimson Scarf Ribbon Flutter */
    .scarf-strand-1 {
      animation: scarfFlutter 0.45s ease-in-out infinite alternate;
      transform-origin: -8px -52px;
    }
    .scarf-strand-2 {
      animation: scarfFlutter 0.45s ease-in-out infinite alternate;
      animation-delay: -0.2s;
      transform-origin: -7px -49px;
    }
    @keyframes scarfFlutter {
      0% { transform: rotate(-3deg) scaleY(0.9); }
      100% { transform: rotate(6deg) scaleY(1.18); }
    }

    /* Reduced motion accessibility */
    @media (prefers-reduced-motion: reduce) {
      #ninja-carrier, .ghost-1, .ghost-2, .vfx-1, .vfx-2, .vfx-boss,
      .e1-top, .e1-bot, .e2-top, .e2-bot, .boss-left, .boss-right,
      .aerial-flip-spinner, .ground-roll-spinner, .run-bob, .sakura {
        animation: none !important;
      }
      .ghost-1, .ghost-2, .vfx-1, .vfx-2, .vfx-boss { display: none; }
      #ninja-carrier { transform: translate(350px, ${GROUND_Y}px); }
    }
  `;

  // 13. Assemble complete SVG document
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="Feudal Edo Shinobi Moonlit Journey with Oni Mini-Boss">
      <title>Edo Shinobi — Moonlit Bamboo Journey and Demon Oni Mini-Boss</title>
      <style><![CDATA[
${css}
      ]]></style>
      <defs>
        ${ninjaRigDef}
      </defs>
      <!-- Deep Sky & Glowing Full Moon -->
      <rect width="${WIDTH}" height="${HEIGHT}" class="bg"/>
      ${skyBackground}
      <!-- 5 Traditional Movement Lanes -->
      ${lanesSvg}
      <!-- Kanji Lane Guide Markers -->
      ${laneMarkers}
      <!-- Drifting Sakura Petals -->
      ${sakuraSvg}
      <!-- 5-Row Jade & Moss Stone Seals -->
      ${cellsSvg}
      <!-- Wooden Bridge Pathway -->
      ${railSvg}
      <!-- Obstacles: Bamboo Stakes & Torii Gate -->
      ${spikeSvg}
      ${toriiSvg}
      <!-- Regular Enemies & Demon Oni Mini-Boss -->
      ${enemy1Svg}
      ${enemy2Svg}
      ${bossSvg}
      <!-- Calligraphic Slashes & Boss Sakura Burst -->
      ${vfx1Svg}
      ${vfx2Svg}
      ${vfxBossSvg}
      <!-- Shadow Clones (After-images) -->
      <g class="ghost-2"><use href="#ninja-char"/></g>
      <g class="ghost-1"><use href="#ninja-char"/></g>
      <!-- Shinobi Ronin Carrier -->
      <g id="ninja-carrier">
        <use href="#ninja-char"/>
      </g>
    </svg>
  `.trim();
}

// ---------- execution ----------
console.log(`Generating Feudal Edo Shinobi Animation with Demon Oni Mini-Boss for user: "${user}"...`);
const grid = await fetchContributions(user);
mkdirSync(outDir, { recursive: true });

for (const theme of ["dark", "light"]) {
  const svg = buildSvg(grid, theme);
  const file = join(outDir, `ninja-${theme}.svg`);
  writeFileSync(file, svg, "utf-8");
  console.log(`✓ Wrote ${file} (${(svg.length / 1024).toFixed(1)} KB, 5 rows, ${T.toFixed(1)}s loop)`);
}
