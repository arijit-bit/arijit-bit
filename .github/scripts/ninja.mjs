#!/usr/bin/env node
// Shadow Ninja — cinematic side-scroller animation generator.
//
//   node .github/scripts/ninja.mjs [outDir=assets] [--debug]
//
// Writes <outDir>/ninja-dark.svg and <outDir>/ninja-light.svg.
// Fully deterministic (no network, no randomness, no dependencies): the same
// script always produces byte-identical output, so CI only commits on change.
//
// Output format: one self-contained animated SVG per theme (pure CSS
// keyframes, no scripts) — GitHub renders these natively inside README <img>.
// The ninja is a small skeletal rig. A choreographed timeline drives the rig;
// forward kinematics of that same rig is used to (a) draw the blade trails
// exactly along the real sword-tip path and (b) place enemies / obstacles so
// every action lines up with the thing it reacts to.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const outDir = process.argv.slice(2).find((a) => !a.startsWith("--")) || "assets";
const DEBUG = process.argv.includes("--debug");
// Simulation speed multiplier (e.g. 1.0 = original 30.3s, 2.0 = ~15.1s, 2.5 = ~12.1s ultra-fast anime pacing)
const speedArg = process.argv.find((a) => a.startsWith("--speed="));
const SPEED = speedArg ? parseFloat(speedArg.split("=")[1]) || 2.5 : 2.5;

/* ────────────────────────── scene constants ────────────────────────── */
const W = 900;                 // canvas width
const R = 30;                  // height of one row
const ROWS = 5;                // exactly five movement rows
const TOP = 18;                // space above row 1
const GROUND = TOP + ROWS * R; // y of the floor line (bottom of row 5)
const H = GROUND + 32;         // canvas height
const X0 = -42;                // ninja starts off-screen left …
const X_END = W + 70;          // … and leaves off-screen right
const S0 = 44;                 // run stride length (px per full leg cycle)
const VRUN = 50;               // nominal run speed (raw units, rescaled below)

/* ───────────────────────────── helpers ───────────────────────────── */
const D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, u) => a + (b - a) * u;
const smooth = (u) => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
const EASE = {
  io: (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2),
  o: (u) => 1 - Math.pow(1 - u, 3),
  i: (u) => u * u * u,
  l: (u) => u,
};
const n1 = (v) => String(+v.toFixed(1));
const n2 = (v) => String(+v.toFixed(2));
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/* ─────────────────────────────── rig ─────────────────────────────── */
// Dimensions chosen so a standing ninja is ~2 rows (2*R = 60px) tall.
const L = { TH: 13, SH: 13, FT: 2, TO: 17, NK: 2, HR: 6.2, UA: 10, FA: 9.5, BL: 32 };
const KEYS = ["lean", "head", "hipN", "kneeN", "hipF", "kneeF", "shN", "elN", "shF", "elF", "blade"];
const BASE = { lean: 0, head: 0, hipN: 0, kneeN: 0, hipF: 0, kneeF: 0, shN: 0, elN: 0, shF: 0, elF: 0, blade: 64 };
const pose = (o) => ({ ...BASE, ...o });
function mix(a, b, u) {
  const o = {};
  for (const k of KEYS) {
    if (k === "blade") {
      const d = ((b.blade - a.blade + 540) % 360) - 180; // shortest way round
      o.blade = a.blade + d * u;
    } else o[k] = a[k] + (b[k] - a[k]) * u;
  }
  return o;
}
// unit vector of a limb that points "down" at rest, rotated by css angle a (deg, clockwise)
const dd = (a) => [-Math.sin(a * D2R), Math.cos(a * D2R)];
// Forward kinematics, coordinates relative to the pelvis (x forward, y down).
function fk(p) {
  const up = [Math.sin(p.lean * D2R), -Math.cos(p.lean * D2R)];
  const S = [up[0] * L.TO, up[1] * L.TO];
  const hu = [Math.sin((p.lean + p.head) * D2R), -Math.cos((p.lean + p.head) * D2R)];
  const head = [S[0] + hu[0] * (L.NK + L.HR), S[1] + hu[1] * (L.NK + L.HR)];
  const arm = (sh, el) => {
    const ua = p.lean - sh, fa = ua - el;
    const u = dd(ua), f = dd(fa);
    const E = [S[0] + u[0] * L.UA, S[1] + u[1] * L.UA];
    const Hd = [E[0] + f[0] * L.FA, E[1] + f[1] * L.FA];
    return { ua, fa, E, H: Hd };
  };
  const an = arm(p.shN, p.elN), af = arm(p.shF, p.elF);
  const bd = dd(p.blade);
  const tip = [an.H[0] + bd[0] * L.BL, an.H[1] + bd[1] * L.BL];
  const mid = [an.H[0] + bd[0] * L.BL * 0.45, an.H[1] + bd[1] * L.BL * 0.45];
  const leg = (hip, knee) => {
    const th = dd(-hip), sh = dd(-hip + knee);
    const K = [th[0] * L.TH, th[1] * L.TH];
    const A = [K[0] + sh[0] * L.SH, K[1] + sh[1] * L.SH];
    return { K, A, drop: A[1] + L.FT };
  };
  const ln = leg(p.hipN, p.kneeN), lf = leg(p.hipF, p.kneeF);
  return { S, head, an, af, tip, mid, ln, lf, pelvisH: Math.max(ln.drop, lf.drop) };
}

// Distance-driven run cycle: the legs advance with the ground, so feet don't skate.
function runPose(phi, amp) {
  const s = Math.sin, c = Math.cos;
  const leg = (ph) => ({
    hip: 6 * amp + 24 * amp * s(ph),
    knee: 14 + 46 * amp * Math.pow((1 + c(ph)) / 2, 1.4),
  });
  const n = leg(phi), f = leg(phi + Math.PI);
  return {
    lean: 14 + 8 * amp, head: -10,
    hipN: n.hip, kneeN: n.knee, hipF: f.hip, kneeF: f.knee,
    shN: -40 + 4 * s(phi + Math.PI), elN: 16,    // sword arm trails behind (ninja run)
    shF: -36 + 5 * s(phi), elF: 22,
    blade: 70,
  };
}

/* ───────────────────────────── key poses ───────────────────────────── */
const PO = {
  // jump
  crouch:   pose({ lean: 36, head: -24, hipN: 58, kneeN: 108, hipF: 48, kneeF: 98, shN: -62, elN: 10, shF: -58, elF: 14, blade: 96 }),
  launch:   pose({ lean: 10, head: -8, hipN: 14, kneeN: 10, hipF: -34, kneeF: 8, shN: 128, elN: 14, shF: 138, elF: 18, blade: -150 }),
  tuck:     pose({ lean: 20, head: -12, hipN: 92, kneeN: 124, hipF: 58, kneeF: 122, shN: 56, elN: 38, shF: 70, elF: 40, blade: -118 }),
  fall:     pose({ lean: 12, head: -6, hipN: 38, kneeN: 52, hipF: 8, kneeF: 42, shN: 82, elN: 20, shF: 92, elF: 24, blade: -100 }),
  landPrep: pose({ lean: 14, head: -8, hipN: 24, kneeN: 20, hipF: 10, kneeF: 18, shN: 60, elN: 20, shF: 70, elF: 22, blade: -96 }),
  land:     pose({ lean: 34, head: -22, hipN: 62, kneeN: 116, hipF: 54, kneeF: 108, shN: -10, elN: 30, shF: -20, elF: 30, blade: 80 }),
  // slide
  slidePrep: pose({ lean: 38, head: -26, hipN: 60, kneeN: 104, hipF: 44, kneeF: 92, shN: -62, elN: 10, shF: -58, elF: 16, blade: 96 }),
  slide:     pose({ lean: -76, head: 66, hipN: 84, kneeN: 6, hipF: 30, kneeF: 112, shN: -66, elN: 24, shF: -108, elF: 4, blade: 84 }),
  slideRise: pose({ lean: 34, head: -24, hipN: 70, kneeN: 96, hipF: -10, kneeF: 128, shN: 30, elN: 30, shF: -50, elF: 20, blade: -100 }),
  // ground combat
  guard:   pose({ lean: 10, head: -6, hipN: 26, kneeN: 34, hipF: -12, kneeF: 24, shN: 42, elN: 72, shF: 12, elF: 52, blade: -122 }),
  windH:   pose({ lean: 4, head: -2, hipN: 34, kneeN: 54, hipF: -30, kneeF: 14, shN: -44, elN: 88, shF: -30, elF: 60, blade: -112 }),
  strikeH: pose({ lean: 26, head: -14, hipN: 52, kneeN: 74, hipF: -44, kneeF: 6, shN: 118, elN: 4, shF: -72, elF: 30, blade: -90 }),
  followH: pose({ lean: 20, head: -10, hipN: 46, kneeN: 66, hipF: -40, kneeF: 8, shN: 104, elN: 12, shF: -60, elF: 34, blade: -84 }),
  windD:   pose({ lean: 2, head: 4, hipN: 30, kneeN: 46, hipF: -24, kneeF: 16, shN: 168, elN: 24, shF: 58, elF: 42, blade: 150 }),
  strikeD: pose({ lean: 26, head: -14, hipN: 54, kneeN: 76, hipF: -42, kneeF: 8, shN: 78, elN: 20, shF: -60, elF: 24, blade: 292 }),
  windR:   pose({ lean: 24, head: -12, hipN: 52, kneeN: 72, hipF: -40, kneeF: 8, shN: 56, elN: 30, shF: -50, elF: 28, blade: 300 }),
  strikeR: pose({ lean: 20, head: -8, hipN: 46, kneeN: 66, hipF: -34, kneeF: 10, shN: 150, elN: 10, shF: -40, elF: 30, blade: 158 }),
  followR: pose({ lean: 16, head: -6, hipN: 40, kneeN: 56, hipF: -30, kneeF: 12, shN: 120, elN: 20, shF: -30, elF: 30, blade: 200 }),
  // overhead leap
  launchO: pose({ lean: 10, head: -8, hipN: 16, kneeN: 10, hipF: -34, kneeF: 8, shN: 136, elN: 12, shF: 140, elF: 16, blade: 176 }),
  tuckO:   pose({ lean: 14, head: -10, hipN: 86, kneeN: 118, hipF: 50, kneeF: 118, shN: 170, elN: 14, shF: 150, elF: 24, blade: 180 }),
  windO:   pose({ lean: 4, head: -2, hipN: 88, kneeN: 120, hipF: 56, kneeF: 122, shN: 176, elN: 16, shF: 130, elF: 30, blade: 196 }),
  strikeO: pose({ lean: 34, head: -22, hipN: 60, kneeN: 80, hipF: 24, kneeF: 74, shN: 74, elN: 8, shF: 70, elF: 24, blade: 338 }),
  landPrepO: pose({ lean: 20, head: -12, hipN: 34, kneeN: 30, hipF: 14, kneeF: 28, shN: 84, elN: 14, shF: 60, elF: 24, blade: 300 }),
  landO:   pose({ lean: 38, head: -26, hipN: 66, kneeN: 120, hipF: 58, kneeF: 112, shN: 70, elN: 20, shF: 30, elF: 30, blade: 290 }),
};

/* ───────────────────────────── choreography ───────────────────────────── */
// Each segment: duration, speed control points [t,v] (relative), key poses
// [t, pose|'run', ease] (ease describes the move *into* that key), optional
// airborne window, and optional strikes (blade swings) with hit times.
const segs = [];
let cur = 0;
function add(name, dur, spd, keys, extra = {}) {
  const s = { name, t0: cur, t1: cur + dur, dur, spd, keys: keys || [[0, "run"], [dur, "run"]], ...extra };
  segs.push(s);
  cur += dur;
  return s;
}
add("enter", 2.4, [[0, 28], [2.4, 50]]);
add("run1", 1.1, [[0, 50], [1.1, 50]]);

// 1 ─ jump over a low obstacle
add("jumpA", 2.9,
  [[0, 50], [0.45, 46], [0.62, 50], [2.12, 54], [2.3, 42], [2.9, 50]],
  [[0, "run"], [0.45, PO.crouch, "io"], [0.62, PO.launch, "o"], [1.0, PO.tuck, "io"], [1.5, PO.tuck, "l"],
   [1.85, PO.fall, "io"], [2.12, PO.landPrep, "io"], [2.3, PO.land, "o"], [2.75, "run", "io"], [2.9, "run", "l"]],
  { air: { a: 0.62, b: 2.12, h: 60 }, obstacle: { kind: "crate", at: 1.37 }, takeoff: 0.62, landing: 2.12 });
add("run2", 1.2, [[0, 50], [1.2, 50]]);

// 2 ─ horizontal lunge slash
add("atk1", 3.8,
  [[0, 50], [0.9, 10], [1.65, 8], [1.78, 80], [1.95, 22], [2.35, 8], [2.7, 12], [3.8, 50]],
  [[0, "run"], [0.85, PO.guard, "io"], [1.4, PO.windH, "io"], [1.65, PO.windH, "l"], [1.95, PO.strikeH, "o"],
   [2.35, PO.followH, "io"], [3.05, PO.guard, "io"], [3.6, "run", "io"], [3.8, "run", "l"]],
  { strikes: [{ a: 1.65, b: 1.95, hit: 1.8, kind: "horizontal" }], enemy: "E1" });
add("run3", 1.1, [[0, 50], [1.1, 50]]);

// 3 ─ slide under an overhead barrier
add("slide", 3.1,
  [[0, 50], [0.5, 56], [0.78, 74], [1.05, 62], [1.8, 34], [2.2, 28], [2.7, 44], [3.1, 50]],
  [[0, "run"], [0.5, PO.slidePrep, "io"], [0.8, PO.slide, "o"], [2.1, PO.slide, "l"], [2.45, PO.slideRise, "io"],
   [2.8, "run", "io"], [3.1, "run", "l"]],
  { barrier: { at: 1.1 }, slideDust: [0.9, 2.0] });
add("run4", 1.0, [[0, 50], [1.0, 50]]);

// 4 ─ diagonal slice → reverse swing combo
add("atk2", 4.5,
  [[0, 50], [0.9, 10], [1.6, 8], [1.78, 60], [2.0, 14], [2.2, 8], [2.4, 40], [2.6, 12], [3.0, 8], [3.6, 14], [4.5, 50]],
  [[0, "run"], [0.85, PO.guard, "io"], [1.35, PO.windD, "io"], [1.6, PO.windD, "l"], [1.95, PO.strikeD, "o"],
   [2.2, PO.windR, "io"], [2.55, PO.strikeR, "o"], [3.0, PO.followR, "io"], [3.6, PO.guard, "io"],
   [4.2, "run", "io"], [4.5, "run", "l"]],
  { strikes: [{ a: 1.6, b: 1.95, hit: 1.78, kind: "diagonal" }, { a: 2.2, b: 2.55, hit: 2.38, kind: "reverse" }], enemy: "E2" });
add("run5", 0.9, [[0, 50], [0.9, 50]]);

// 5 ─ leap and chop downward
add("atk3", 3.5,
  [[0, 50], [0.45, 46], [0.6, 50], [2.0, 56], [2.16, 40], [2.6, 30], [3.5, 50]],
  [[0, "run"], [0.45, PO.crouch, "io"], [0.6, PO.launchO, "o"], [0.98, PO.tuckO, "io"], [1.28, PO.windO, "io"],
   [1.36, PO.windO, "l"], [1.72, PO.strikeO, "o"], [2.0, PO.landPrepO, "io"], [2.16, PO.landO, "o"],
   [2.6, PO.guard, "io"], [3.1, "run", "io"], [3.5, "run", "l"]],
  { air: { a: 0.6, b: 2.0, h: 36 }, strikes: [{ a: 1.36, b: 1.72, hit: 1.6, kind: "overhead" }], enemy: "E3",
    takeoff: 0.6, landing: 2.0 });
add("exit", 2.6, [[0, 50], [2.6, 62]]);

const T_EXIT = cur;
const T = +(T_EXIT + 2.2).toFixed(3); // loop length (includes enemy respawn + a calm beat)
const DURATION = +(T / SPEED).toFixed(2); // actual loop duration after speed scaling

/* ───────────────────────── kinematic integration ───────────────────────── */
const segAt = (t) => segs.find((s) => t >= s.t0 && t < s.t1) || null;
function speedRaw(t) {
  const s = segAt(t);
  if (!s) return 0;
  const tau = t - s.t0;
  const p = s.spd;
  let i = 0;
  while (i < p.length - 2 && tau > p[i + 1][0]) i++;
  const u = (tau - p[i][0]) / (p[i + 1][0] - p[i][0] || 1);
  return lerp(p[i][1], p[i + 1][1], smooth(u));
}
const DT = 0.002;
const NSTEP = Math.ceil(T_EXIT / DT) + 1;
function integrate(k) {
  const X = new Float64Array(NSTEP), PHI = new Float64Array(NSTEP), V = new Float64Array(NSTEP);
  X[0] = X0;
  for (let i = 0; i < NSTEP - 1; i++) {
    const v = speedRaw(i * DT) * k;
    V[i] = v;
    const amp = clamp(v / (VRUN * k), 0.55, 1.05);
    X[i + 1] = X[i] + v * DT;
    PHI[i + 1] = PHI[i] + (2 * Math.PI * v * DT) / (S0 * amp);
  }
  V[NSTEP - 1] = V[NSTEP - 2];
  return { X, PHI, V };
}
const raw = integrate(1);
const K = (X_END - X0) / (raw.X[NSTEP - 1] - X0); // fit the whole route to the canvas
const KIN = integrate(K);
function kin(t) {
  const f = clamp(t / DT, 0, NSTEP - 1);
  const i = Math.min(NSTEP - 2, Math.floor(f)), u = f - i;
  return {
    x: lerp(KIN.X[i], KIN.X[i + 1], u),
    phi: lerp(KIN.PHI[i], KIN.PHI[i + 1], u),
    v: lerp(KIN.V[i], KIN.V[i + 1], u),
  };
}

function stateAt(t) {
  t = clamp(t, 0, T_EXIT);
  const sg = segAt(t) || segs[segs.length - 1];
  const tau = clamp(t - sg.t0, 0, sg.dur);
  const { x, phi, v } = kin(t);
  const amp = clamp(v / (VRUN * K), 0.55, 1.05);
  const runP = runPose(phi, amp);
  const ks = sg.keys;
  let i = 0;
  while (i < ks.length - 2 && tau > ks[i + 1][0]) i++;
  const k0 = ks[i], k1 = ks[i + 1];
  const u = clamp((tau - k0[0]) / (k1[0] - k0[0] || 1), 0, 1);
  const e = EASE[k1[2] || "io"](u);
  const pa = k0[1] === "run" ? runP : k0[1];
  const pb = k1[1] === "run" ? runP : k1[1];
  const p = mix(pa, pb, e);
  let lift = 0;
  if (sg.air && tau > sg.air.a && tau < sg.air.b) {
    const w = (tau - sg.air.a) / (sg.air.b - sg.air.a);
    lift = sg.air.h * 4 * w * (1 - w);
  }
  const f = fk(p);
  return { t, x, py: GROUND - f.pelvisH - lift, lift, p, f, v };
}
// world-space helpers
const W2 = (st, rel) => [st.x + rel[0], st.py + rel[1]];
const bladeDir = (st) => dd(st.p.blade);
const tipW = (st) => W2(st, st.f.tip);
const midW = (st) => W2(st, st.f.mid);
const hit = (sg, rel) => sg.t0 + rel;

/* ───────────────────────── scene layout from the timeline ───────────────────────── */
const events = { obstacles: [], barriers: [], enemies: [], dust: [], strikes: [] };
const dbg = [];
const SEG = Object.fromEntries(segs.map((s) => [s.name, s]));

// low obstacle (crate stack) sits under the apex of the jump
{
  const sg = SEG.jumpA;
  const st = stateAt(sg.t0 + sg.obstacle.at);
  events.obstacles.push({ x: st.x + 2, w: 30, h: 26 });
}
// overhead barrier hangs over the middle of the slide
{
  const sg = SEG.slide;
  const st = stateAt(sg.t0 + sg.barrier.at);
  events.barriers.push({ x: st.x - 2, w: 36, bottom: 42, top: 66 });
}
// enemies are placed where the real blade tip is at the moment of contact
function findHit(sg, s) {
  const a = sg.t0 + s.a, b = sg.t0 + s.b;
  const height = (t) => GROUND - tipW(stateAt(t))[1];
  const goal = { horizontal: 32, diagonal: 40, reverse: 26, overhead: 28 }[s.kind];
  const mid = a + (b - a) * 0.3;
  for (let t = s.kind === "reverse" ? a : mid; t <= b; t += 0.002) {
    const h = height(t);
    if (s.kind === "reverse" ? h >= goal : s.kind === "horizontal" ? h >= goal : h <= goal) return t - sg.t0;
  }
  return s.hit;
}
function placeEnemy(sg) {
  sg.strikes.forEach((s) => { s.hit = findHit(sg, s); });
  const hs = sg.strikes.map((s) => stateAt(sg.t0 + s.hit));
  const tips = hs.map(tipW);
  const ex = tips.reduce((a, t) => a + t[0], 0) / tips.length + 5;
  const en = { id: sg.enemy, x: ex, hits: [] };
  sg.strikes.forEach((s, i) => {
    const t = sg.t0 + s.hit;
    const a = stateAt(t - 0.012), b = stateAt(t + 0.012);
    const ta = tipW(a), tb = tipW(b);
    let d = [tb[0] - ta[0], tb[1] - ta[1]];
    const m = Math.hypot(d[0], d[1]) || 1;
    d = [d[0] / m, d[1] / m];
    const want = { horizontal: [1, -0.06], diagonal: [0.75, 0.66], reverse: [0.78, -0.62], overhead: [0.06, 1] }[s.kind];
    d = [0.35 * d[0] + 0.65 * want[0], 0.35 * d[1] + 0.65 * want[1]];
    const mm = Math.hypot(d[0], d[1]);
    d = [d[0] / mm, d[1] / mm];
    const c = [clamp(tips[i][0], ex - 12, ex + 10), clamp(tips[i][1], GROUND - 42, GROUND - 8)];
    en.hits.push({ t, kind: s.kind, d, c, tip: tips[i] });
    dbg.push(`${en.id} ${s.kind}: hit t=${t.toFixed(2)}s tip=(${tips[i][0].toFixed(0)}, ${(GROUND - tips[i][1]).toFixed(0)} up) dir=(${d[0].toFixed(2)}, ${d[1].toFixed(2)})`);
  });
  events.enemies.push(en);
}
placeEnemy(SEG.atk1);
placeEnemy(SEG.atk2);
placeEnemy(SEG.atk3);

/* ───────────────────────── quality metrics (printed with --debug) ───────────────────────── */
function metrics() {
  const out = [];
  const stand = fk(pose({}));
  const headTop = stand.pelvisH + (-stand.head[1]) + L.HR;
  out.push(`standing height ${headTop.toFixed(1)}px  = ${(headTop / R).toFixed(2)} rows (target ~2)`);
  out.push(`rows: ${ROWS}, row height ${R}px, ground y=${GROUND}`);
  out.push(`speed scale K=${K.toFixed(3)}, loop ${T.toFixed(1)}s, route ${X0}→${X_END}`);
  // jump clearance
  const o = events.obstacles[0];
  let minC = 1e9;
  for (let t = SEG.jumpA.t0; t < SEG.jumpA.t1; t += 0.01) {
    const st = stateAt(t);
    for (const leg of [st.f.ln, st.f.lf]) {
      const px = st.x + leg.A[0];
      if (Math.abs(px - o.x) < o.w / 2 + 3) { const c = GROUND - (st.py + leg.A[1] + L.FT) - o.h; if (c < minC) { minC = c; globalThis.__w = [t, px - o.x, st.lift]; } }
      const kx = st.x + leg.K[0];
      if (Math.abs(kx - o.x) < o.w / 2 + 3) minC = Math.min(minC, GROUND - (st.py + leg.K[1]) - o.h);
    }
  }
  out.push(`jump clearance over crate: ${minC.toFixed(1)}px (need > 2) worst@t=${(globalThis.__w || []).map((v) => v.toFixed(2)).join(',')}`);
  // slide clearance: highest body point under the barrier vs the spike tips
  const b = events.barriers[0];
  const spikeY = b.bottom - 4; // height above ground of the spike tips
  let worst = 1e9;
  for (let t = SEG.slide.t0; t < SEG.slide.t1; t += 0.01) {
    const st = stateAt(t);
    const pts = [[st.f.head, L.HR], [st.f.S, 0], [st.f.an.H, 0], [st.f.af.H, 0], [st.f.tip, 0]];
    for (const [q, r] of pts) {
      const wx = st.x + q[0];
      const height = GROUND - (st.py + q[1]) + r;
      if (Math.abs(wx - b.x) < b.w / 2 + 2) { const c = spikeY - height; if (c < worst) { worst = c; globalThis.__s = [t, pts.findIndex((z) => z[0] === q), height]; } }
    }
  }
  out.push(`slide clearance under barrier: ${worst.toFixed(1)}px (need > 1) worst(t,point,height)=${(globalThis.__s || []).map((v) => v.toFixed(2)).join(',')}  [0 head,1 shoulder,2 hand,3 far hand,4 blade tip]`);
  for (const l of dbg) out.push(l);
  return out;
}

/* ───────────────────────────── palettes ───────────────────────────── */
const PAL = {
  dark: {
    sky1: "#070b14", sky2: "#111c31", moon: "#e3eefb", moonGlow: "#79C0FF", far: "#0f192b", near: "#0b1424",
    bamboo: "#0e1a2a", node: "#17283d", band: "#79C0FF", bandA: 0.045, line: "#79C0FF", lineA: 0.2, label: "#79C0FF", labelA: 0.5,
    ground: "#09101b", groundTop: "#223250", tile: "#16243b", grass: "#1f5a45",
    body: "#05070b", farBody: "#101722", scarf: "#79C0FF", eye: "#eaf7ff", blade: "#eef5fc", guard: "#79C0FF", glow: "#79C0FF", glowA: 0.8,
    trail: "#ffffff", trailStroke: "none", trailGlow: "#79C0FF", spark: "#ffe3a3", dust: "#9db2cc", mote: "#d2f5a8",
    en: { body: "#26a641", mid: "#1b8a38", shade: "#0e4429", hi: "#39d353", eye: "#ff7b6b" },
    wood: "#6f4e2e", woodD: "#42301b", woodH: "#a07645", metal: "#8b949e", metalD: "#4b5563", rust: "#c8553d", chain: "#6e7681",
  },
  light: {
    sky1: "#cfe3f7", sky2: "#f6f9fd", moon: "#ffd479", moonGlow: "#ffb84d", far: "#c5d6ea", near: "#b3c8e0",
    bamboo: "#9fb8cf", node: "#86a1ba", band: "#0969da", bandA: 0.05, line: "#0969da", lineA: 0.22, label: "#0969da", labelA: 0.55,
    ground: "#d9e2ec", groundTop: "#8aa0b8", tile: "#c3cfdc", grass: "#4f9d69",
    body: "#1b1f24", farBody: "#3a424d", scarf: "#0969da", eye: "#ffffff", blade: "#6e7781", guard: "#0969da", glow: "#57606a", glowA: 0.55,
    trail: "#ffffff", trailStroke: "#0969da", trailGlow: "#0969da", spark: "#f59e0b", dust: "#8c959f", mote: "#9be9a8",
    en: { body: "#30a14e", mid: "#2a8f45", shade: "#216e39", hi: "#40c463", eye: "#cf222e" },
    wood: "#8b5e34", woodD: "#5c3d1e", woodH: "#b98a55", metal: "#6e7781", metalD: "#424a53", rust: "#cf222e", chain: "#57606a",
  },
};

/* ───────────────────────────── svg builders ───────────────────────────── */
// Reduce a sampled series to its essential keyframes (Ramer–Douglas–Peucker).
function rdp(pts, eps) {
  if (pts.length < 3) return pts;
  const keep = new Set([0, pts.length - 1]);
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let md = 0, idx = -1;
    for (let i = a + 1; i < b; i++) {
      const u = (pts[i].t - pts[a].t) / (pts[b].t - pts[a].t);
      let d = 0;
      for (let c = 0; c < pts[i].v.length; c++) {
        d = Math.max(d, Math.abs(pts[a].v[c] + (pts[b].v[c] - pts[a].v[c]) * u - pts[i].v[c]));
      }
      if (d > md) { md = d; idx = i; }
    }
    if (md > eps && idx > 0) { keep.add(idx); stack.push([a, idx], [idx, b]); }
  }
  return [...keep].sort((x, y) => x - y).map((i) => pts[i]);
}
const pct = (t) => ((clamp(t, 0, T) / T) * 100).toFixed(3);
// frames: [[t, "css declarations"], ...] sorted by t
function kfBlock(name, frames) {
  const fr = frames.slice().sort((a, b) => a[0] - b[0]);
  if (fr[0][0] > 0) fr.unshift([0, fr[0][1]]);
  if (fr[fr.length - 1][0] < T) fr.push([T, fr[fr.length - 1][1]]);
  let last = -1;
  const parts = [];
  for (const [t, css] of fr) {
    let p = +pct(t);
    if (p <= last) p = +(last + 0.0005).toFixed(4);
    last = p;
    parts.push(`${p}%{${css}}`);
  }
  return `@keyframes ${name}{${parts.join("")}}`;
}
function unwrap(a) {
  const o = [a[0]];
  for (let i = 1; i < a.length; i++) {
    let v = a[i];
    while (v - o[i - 1] > 180) v -= 360;
    while (v - o[i - 1] < -180) v += 360;
    o.push(v);
  }
  return o;
}

// Sample the rig for the whole loop (30 samples/s, then simplify).
function rigKeyframes() {
  const dt = 1 / 30;
  const ts = [];
  for (let t = 0; t < T_EXIT; t += dt) ts.push(t);
  ts.push(T_EXIT);
  const sts = ts.map(stateAt);
  const ch = {};
  const push = (name, fn) => (ch[name] = sts.map(fn));
  push("to", (s) => s.p.lean);
  push("hd", (s) => s.p.head);
  push("an", (s) => -s.p.shN);
  push("fn", (s) => -s.p.elN);
  push("af", (s) => -s.p.shF);
  push("ff", (s) => -s.p.elF);
  push("ln", (s) => -s.p.hipN);
  push("sn", (s) => s.p.kneeN);
  push("lf", (s) => -s.p.hipF);
  push("sf", (s) => s.p.kneeF);
  push("sw", (s) => s.p.blade - (s.p.lean - s.p.shN - s.p.elN));
  ch.sw = unwrap(ch.sw);
  let css = "";
  for (const [name, arr] of Object.entries(ch)) {
    const pts = ts.map((t, i) => ({ t, v: [arr[i]] }));
    const kept = rdp(pts, 0.35);
    css += kfBlock("k" + name, kept.map((p) => [p.t, `transform:rotate(${n1(p.v[0])}deg)`]));
  }
  // root + shadow (position)
  const rpts = ts.map((t, i) => ({ t, v: [sts[i].x, sts[i].py] }));
  css += kfBlock("kr", rdp(rpts, 0.3).map((p) => [p.t, `transform:translate(${n1(p.v[0])}px,${n1(p.v[1])}px)`]));
  const spts = ts.map((t, i) => ({ t, v: [sts[i].x, 1 - clamp(sts[i].lift / 70, 0, 0.6)] }));
  css += kfBlock("ksh", rdp(spts, 0.02).map((p) => [p.t, `transform:translate(${n1(p.v[0])}px,${GROUND}px) scale(${n2(p.v[1])},1);opacity:${n2(0.55 * p.v[1])}`]));
  return css;
}

function ballistic(t0, o, v, g, life, steps = 5) {
  const fr = [];
  for (let i = 0; i <= steps; i++) {
    const u = i / steps, tt = u * life;
    fr.push([t0 + tt, [o[0] + v[0] * tt, o[1] + v[1] * tt + 0.5 * g * tt * tt]]);
  }
  return fr;
}

function build(theme) {
  const p = PAL[theme];
  let css = "";
  let defs = "";
  let bg = "", obst = "", enem = "", fxLow = "", fxHigh = "";
  let uid = 0;
  const R1 = rng(7);

  /* ---------- background ---------- */
  bg += `<rect width="${W}" height="${H}" fill="url(#sky)"/>`;
  defs += `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.sky1}"/><stop offset="1" stop-color="${p.sky2}"/></linearGradient>`;
  defs += `<radialGradient id="moon"><stop offset="0" stop-color="${p.moonGlow}" stop-opacity=".55"/><stop offset="1" stop-color="${p.moonGlow}" stop-opacity="0"/></radialGradient>`;
  if (theme === "dark") {
    for (let i = 0; i < 46; i++) {
      bg += `<circle cx="${n1(R1() * W)}" cy="${n1(R1() * (GROUND - 40))}" r="${n1(0.4 + R1() * 0.7)}" fill="#cfe3ff" opacity="${n2(0.15 + R1() * 0.45)}"/>`;
    }
  }
  bg += `<circle cx="${W - 120}" cy="${TOP + 22}" r="46" fill="url(#moon)"/><circle cx="${W - 120}" cy="${TOP + 22}" r="14" fill="${p.moon}"/>`;
  // mountains
  const mtn = (base, amp, step, seed, col, op) => {
    const r = rng(seed);
    let d = `M0 ${GROUND}`;
    for (let x = 0; x <= W + step; x += step) d += ` L${x} ${n1(base - r() * amp)}`;
    d += ` L${W} ${GROUND}Z`;
    return `<path d="${d}" fill="${col}" opacity="${op}"/>`;
  };
  bg += mtn(GROUND - 52, 38, 46, 11, p.far, 0.9);
  bg += mtn(GROUND - 30, 24, 34, 5, p.near, 0.95);
  // bamboo
  const rb = rng(21);
  for (let i = 0; i < 16; i++) {
    const x = 20 + i * 56 + rb() * 24, hgt = 90 + rb() * 70;
    bg += `<rect x="${n1(x)}" y="${n1(GROUND - hgt)}" width="3" height="${n1(hgt)}" fill="${p.bamboo}" opacity=".8"/>`;
    for (let j = 1; j < 5; j++) bg += `<rect x="${n1(x - 0.5)}" y="${n1(GROUND - hgt * (j / 5))}" width="4" height="1.2" fill="${p.node}" opacity=".7"/>`;
  }
  // five rows
  for (let r = 0; r < ROWS; r++) {
    const y = TOP + r * R;
    bg += `<rect x="0" y="${y}" width="${W}" height="${R}" fill="${p.band}" opacity="${r % 2 === 0 ? p.bandA : p.bandA * 0.3}"/>`;
    bg += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${p.line}" stroke-opacity="${p.lineA}" stroke-width=".7" stroke-dasharray="3 5"/>`;
    bg += `<text x="7" y="${y + 11}" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" font-size="8" fill="${p.label}" opacity="${p.labelA}">${r + 1}</text>`;
  }
  bg += `<line x1="0" y1="${GROUND}" x2="${W}" y2="${GROUND}" stroke="${p.line}" stroke-opacity="${p.lineA + 0.15}" stroke-width=".9"/>`;
  // ground
  bg += `<rect x="0" y="${GROUND}" width="${W}" height="${H - GROUND}" fill="${p.ground}"/>`;
  bg += `<rect x="0" y="${GROUND}" width="${W}" height="2" fill="${p.groundTop}"/>`;
  for (let x = 0; x < W; x += 30) bg += `<path d="M${x} ${GROUND + 2}v${H - GROUND}" stroke="${p.tile}" stroke-width="1"/>`;
  bg += `<path d="M0 ${GROUND + 16}H${W}" stroke="${p.tile}" stroke-width="1"/>`;
  const rg = rng(33);
  for (let i = 0; i < 70; i++) {
    const gx = rg() * W;
    bg += `<path d="M${n1(gx)} ${GROUND}l-1.2 -${n1(2 + rg() * 3)}m1.2 ${n1(0)}l1 -${n1(2 + rg() * 3)}" stroke="${p.grass}" stroke-width=".9" opacity=".7"/>`;
  }
  // motes / fireflies (independent gentle loops)
  const rm = rng(99);
  for (let i = 0; i < 9; i++) {
    const mx = 40 + rm() * (W - 80), my = TOP + 8 + rm() * (R * 3);
    const name = `m${i}`;
    css += `@keyframes ${name}{0%{transform:translate(${n1(mx)}px,${n1(my)}px);opacity:.1}50%{transform:translate(${n1(mx + 12 * (rm() - 0.5) * 2)}px,${n1(my - 8 - rm() * 8)}px);opacity:.8}100%{transform:translate(${n1(mx)}px,${n1(my)}px);opacity:.1}}`;
    bg += `<circle r="1.3" fill="${p.mote}" style="animation:${name} ${n1(5 + rm() * 5)}s ease-in-out infinite;animation-delay:-${n1(rm() * 6)}s"/>`;
  }

  /* ---------- obstacles ---------- */
  const crate = events.obstacles[0];
  obst += `<g transform="translate(${n1(crate.x)},${GROUND})">` +
    `<rect x="-15" y="-13" width="30" height="13" fill="${p.wood}" stroke="${p.woodD}" stroke-width="1.2"/>` +
    `<path d="M-15 -13L15 0M15 -13L-15 0" stroke="${p.woodD}" stroke-width="1.2"/>` +
    `<rect x="-15" y="-13" width="30" height="2.2" fill="${p.woodH}"/>` +
    `<rect x="-10" y="-26" width="20" height="13" fill="${p.wood}" stroke="${p.woodD}" stroke-width="1.2"/>` +
    `<path d="M-10 -26L10 -13M10 -26L-10 -13" stroke="${p.woodD}" stroke-width="1.1"/>` +
    `<rect x="-10" y="-26" width="20" height="2" fill="${p.woodH}"/>` +
    `<rect x="-15" y="-8" width="30" height="2.4" fill="${p.rust}" opacity=".85"/>` +
    `</g>`;
  const bar = events.barriers[0];
  const by0 = GROUND - bar.top, by1 = GROUND - bar.bottom;
  let chains = "";
  for (const cx of [bar.x - 13, bar.x + 13]) {
    chains += `<line x1="${n1(cx)}" y1="${TOP}" x2="${n1(cx)}" y2="${by0}" stroke="${p.chain}" stroke-width="2" stroke-dasharray="3 2"/>`;
    chains += `<rect x="${n1(cx - 4)}" y="${TOP}" width="8" height="3" fill="${p.metalD}"/>`;
  }
  let spikes = "";
  for (let i = 0; i < 6; i++) {
    const sx = bar.x - bar.w / 2 + 3 + i * ((bar.w - 6) / 5);
    spikes += `<path d="M${n1(sx - 2.6)} ${by1}L${n1(sx)} ${by1 + 4}L${n1(sx + 2.6)} ${by1}Z" fill="${p.metal}"/>`;
  }
  obst += chains +
    `<rect x="${n1(bar.x - bar.w / 2)}" y="${by0}" width="${bar.w}" height="${by1 - by0}" rx="3" fill="${p.wood}" stroke="${p.woodD}" stroke-width="1.2"/>` +
    `<rect x="${n1(bar.x - bar.w / 2)}" y="${by0}" width="${bar.w}" height="3" rx="1.5" fill="${p.woodH}"/>` +
    `<rect x="${n1(bar.x - bar.w / 2)}" y="${by0 + 8}" width="${bar.w}" height="2" fill="${p.woodD}" opacity=".6"/>` +
    `<rect x="${n1(bar.x - bar.w / 2 + 6)}" y="${by0}" width="3" height="${by1 - by0}" fill="${p.metalD}"/>` +
    `<rect x="${n1(bar.x + bar.w / 2 - 9)}" y="${by0}" width="3" height="${by1 - by0}" fill="${p.metalD}"/>` +
    spikes;

  /* ---------- enemy art + filters ---------- */
  const E = p.en;
  defs += `<filter id="white"><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0"/></filter>`;
  defs += `<g id="enemy">` +
    `<rect x="-9" y="-12" width="7" height="12" fill="${E.shade}"/><rect x="2" y="-12" width="7" height="12" fill="${E.shade}"/>` +
    `<rect x="-17" y="-33" width="5" height="16" fill="${E.mid}"/><rect x="12" y="-33" width="5" height="16" fill="${E.mid}"/>` +
    `<rect x="-13" y="-34" width="26" height="23" fill="${E.body}"/>` +
    `<rect x="-13" y="-34" width="26" height="3" fill="${E.hi}"/>` +
    `<rect x="-13" y="-14" width="26" height="3" fill="${E.shade}"/>` +
    `<rect x="-8.5" y="-48" width="17" height="14" fill="${E.body}"/>` +
    `<rect x="-8.5" y="-48" width="17" height="3" fill="${E.hi}"/>` +
    `<rect x="-5.5" y="-42" width="3.4" height="2.6" fill="${E.eye}"/><rect x="2.1" y="-42" width="3.4" height="2.6" fill="${E.eye}"/>` +
    `<rect x="-6" y="-36.5" width="12" height="1.6" fill="${E.shade}"/>` +
    // little contribution-graph emblem on the chest
    [0, 1, 2].map((r) => [0, 1, 2].map((c) => `<rect x="${-5 + c * 3.6}" y="${-28 + r * 3.6}" width="3" height="3" fill="${[E.hi, E.mid, E.shade, E.hi, E.body, E.mid, E.shade, E.hi, E.hi][r * 3 + c]}"/>`).join("")).join("") +
    `</g>`;

  const respawn0 = T_EXIT + 0.5;
  events.enemies.forEach((en, ei) => {
    const id = ei;
    const last = en.hits[en.hits.length - 1];
    const rs = respawn0 + ei * 0.22;
    const d = last.d;
    const nrm = [-d[1], d[0]];
    const c = [last.c[0] - en.x, last.c[1] - GROUND];
    const Ln = 120;
    const poly = (s) => [
      [c[0] - d[0] * Ln, c[1] - d[1] * Ln], [c[0] + d[0] * Ln, c[1] + d[1] * Ln],
      [c[0] + d[0] * Ln + nrm[0] * Ln * s, c[1] + d[1] * Ln + nrm[1] * Ln * s],
      [c[0] - d[0] * Ln + nrm[0] * Ln * s, c[1] - d[1] * Ln + nrm[1] * Ln * s],
    ].map((q) => `${n1(q[0])},${n1(q[1])}`).join(" ");
    defs += `<clipPath id="ca${id}"><polygon points="${poly(1)}"/></clipPath><clipPath id="cb${id}"><polygon points="${poly(-1)}"/></clipPath>`;
    // recoil + flash for every hit
    const rec = [[0, "transform:none"]];
    const fl = [[0, "opacity:0"]];
    en.hits.forEach((h) => {
      rec.push([h.t - 0.002, "transform:translate(0,0)"], [h.t + 0.05, "transform:translate(3.5px,0)"], [h.t + 0.3, "transform:translate(0,0)"]);
      fl.push([h.t - 0.002, "opacity:0"], [h.t + 0.012, "opacity:.95"], [h.t + 0.16, "opacity:0"]);
    });
    css += kfBlock(`rc${id}`, rec) + kfBlock(`fl${id}`, fl);
    const half = (sgn, tag) => {
      const push = 1 + 0.5 * (tag === "a" ? 1 : 0.8);
      const dirv = [nrm[0] * sgn * 20 + d[0] * sgn * 9, nrm[1] * sgn * 20 + d[1] * sgn * 9];
      const rot = (sgn * (nrm[0] >= 0 ? 1 : -1) * (14 + 18 * ((ei * 37 + (tag === "a" ? 5 : 11)) % 10) / 10)).toFixed(0);
      const th = last.t;
      const fr = [[0, "opacity:1;transform:none"], [th, "opacity:1;transform:none"]];
      const samples = [0.1, 0.25, 0.45, 0.7, 1.0];
      samples.forEach((u, i) => {
        const g = 120 * u * u;
        const op = u < 0.55 ? 1 : Math.max(0, 1 - (u - 0.55) / 0.45);
        const ty = Math.min(3, dirv[1] * u * push + g * 0.35 * (dirv[1] < 0 ? 1 : 0.15));
        fr.push([th + u * 0.95, `opacity:${n2(op)};transform:translate(${n1(dirv[0] * u * push)}px,${n1(ty)}px) rotate(${n1(rot * u)}deg)`]);
      });
      fr.push([rs, "opacity:0;transform:none"], [rs + 0.45, "opacity:1;transform:none"]);
      return fr;
    };
    css += kfBlock(`ha${id}`, half(1, "a")) + kfBlock(`hb${id}`, half(-1, "b"));
    enem += `<g transform="translate(${n1(en.x)},${GROUND})"><g class="a" style="animation-name:rc${id}">` +
      `<g class="a" clip-path="url(#ca${id})" style="animation-name:ha${id}"><use href="#enemy"/></g>` +
      `<g class="a" clip-path="url(#cb${id})" style="animation-name:hb${id}"><use href="#enemy"/></g>` +
      `<use href="#enemy" filter="url(#white)" class="a" style="opacity:0;animation-name:fl${id}"/>` +
      `</g></g>`;

    // impact effects for every hit
    en.hits.forEach((h, hi) => {
      const k = `${id}_${hi}`;
      const ang = Math.atan2(h.d[1], h.d[0]) / D2R;
      // slash mark (lens) along the cut direction
      css += kfBlock(`lens${k}`, [
        [0, `opacity:0;transform:translate(${n1(h.c[0])}px,${n1(h.c[1])}px) rotate(${n1(ang)}deg) scale(.2,.5)`],
        [h.t - 0.002, `opacity:0;transform:translate(${n1(h.c[0])}px,${n1(h.c[1])}px) rotate(${n1(ang)}deg) scale(.2,.5)`],
        [h.t + 0.03, `opacity:1;transform:translate(${n1(h.c[0])}px,${n1(h.c[1])}px) rotate(${n1(ang)}deg) scale(1,1)`],
        [h.t + 0.3, `opacity:0;transform:translate(${n1(h.c[0])}px,${n1(h.c[1])}px) rotate(${n1(ang)}deg) scale(1.2,.25)`],
      ]);
      fxHigh += `<path class="a fx" style="animation-name:lens${k}" d="M-30,0 Q0,-6 30,0 Q0,6 -30,0Z" fill="${p.trail}" stroke="${p.trailStroke}" stroke-width=".6"/>`;
      // impact flash star
      css += kfBlock(`star${k}`, [
        [0, `opacity:0;transform:translate(${n1(h.c[0])}px,${n1(h.c[1])}px) scale(.3)`],
        [h.t - 0.002, `opacity:0;transform:translate(${n1(h.c[0])}px,${n1(h.c[1])}px) scale(.3)`],
        [h.t + 0.025, `opacity:1;transform:translate(${n1(h.c[0])}px,${n1(h.c[1])}px) scale(1.25)`],
        [h.t + 0.2, `opacity:0;transform:translate(${n1(h.c[0])}px,${n1(h.c[1])}px) scale(1.7)`],
      ]);
      fxHigh += `<path class="a fx" style="animation-name:star${k}" d="M0,-9L2,-2L9,0L2,2L0,9L-2,2L-9,0L-2,-2Z" fill="${p.spark}" opacity="0"/>`;
      // sparks
      const rs2 = rng(100 + ei * 10 + hi);
      for (let s = 0; s < 9; s++) {
        const a = Math.atan2(h.d[1], h.d[0]) + (rs2() - 0.5) * 2.6 + (rs2() < 0.5 ? 0 : Math.PI);
        const sp = 45 + rs2() * 80;
        const life = 0.28 + rs2() * 0.22;
        const fr = ballistic(h.t, h.c.map((v, i2) => (i2 === 0 ? v : v)), [Math.cos(a) * sp, Math.sin(a) * sp], 260, life, 4);
        const nm = `sp${k}_${s}`;
        css += kfBlock(nm, [[0, `opacity:0;transform:translate(${n1(h.c[0])}px,${n1(h.c[1])}px)`],
          [h.t - 0.002, `opacity:0;transform:translate(${n1(h.c[0])}px,${n1(h.c[1])}px)`],
          ...fr.map(([tt, q], i3) => [tt, `opacity:${i3 === fr.length - 1 ? 0 : n2(1 - i3 / (fr.length * 1.2))};transform:translate(${n1(q[0])}px,${n1(q[1])}px)`])]);
        fxHigh += `<circle class="a fx" style="animation-name:${nm}" r="${n1(0.9 + rs2() * 0.8)}" fill="${p.spark}"/>`;
      }
    });
    // block debris from the final cut
    const rd = rng(500 + ei);
    const cols = [E.hi, E.body, E.mid, E.shade];
    for (let s = 0; s < 10; s++) {
      const a = Math.atan2(nrm[1], nrm[0]) + (rd() - 0.5) * 3.4 + (rd() < 0.5 ? 0 : Math.PI);
      const sp = 40 + rd() * 90;
      const life = 0.7 + rd() * 0.3;
      const o = [en.x + (rd() - 0.5) * 22, GROUND - 10 - rd() * 36];
      const fr = ballistic(last.t + 0.04, o, [Math.cos(a) * sp, Math.sin(a) * sp - 30], 300, life, 5);
      const nm = `db${id}_${s}`;
      const rot0 = rd() * 90, rot1 = rot0 + (rd() - 0.5) * 360;
      css += kfBlock(nm, [[0, `opacity:0;transform:translate(${n1(o[0])}px,${n1(o[1])}px)`],
        [last.t + 0.039, `opacity:0;transform:translate(${n1(o[0])}px,${n1(o[1])}px)`],
        ...fr.map(([tt, q], i3) => [tt, `opacity:${i3 === fr.length - 1 ? 0 : (i3 < 3 ? 1 : n2(1 - (i3 - 2) / 3))};transform:translate(${n1(q[0])}px,${n1(q[1])}px) rotate(${n1(lerp(rot0, rot1, i3 / (fr.length - 1)))}deg)`])]);
      const sz = 2.4 + rd() * 2.4;
      fxHigh += `<rect class="a fx" style="animation-name:${nm}" x="${n1(-sz / 2)}" y="${n1(-sz / 2)}" width="${n1(sz)}" height="${n1(sz)}" fill="${cols[s % 4]}"/>`;
    }
  });

  /* ---------- blade trails: quads along the real tip path ---------- */
  let trails = "";
  let tid = 0;
  for (const sg of segs.filter((s) => s.strikes)) {
    for (const s of sg.strikes) {
      const ta = sg.t0 + s.a - 0.02, tb = sg.t0 + s.b + 0.05;
      const dtt = 1 / 45;
      let prev = null;
      for (let t = ta; t <= tb + 1e-9; t += dtt) {
        const st = stateAt(t);
        const tp = tipW(st), md = midW(st);
        if (prev) {
          const mv = Math.hypot(tp[0] - prev.tp[0], tp[1] - prev.tp[1]);
          if (mv > 0.8) {
            const nm = `tr${tid++}`;
            css += kfBlock(nm, [[0, "opacity:0"], [t - 0.025, "opacity:0"], [t, "opacity:.92"], [t + 0.07, "opacity:.62"], [t + 0.34, "opacity:0"]]);
            trails += `<g class="a fx" style="animation-name:${nm}">` +
              `<polygon points="${n1(prev.tp[0])},${n1(prev.tp[1])} ${n1(tp[0])},${n1(tp[1])} ${n1(md[0])},${n1(md[1])} ${n1(prev.md[0])},${n1(prev.md[1])}" fill="${p.trailGlow}" opacity=".55"/>` +
              `<line x1="${n1(prev.tp[0])}" y1="${n1(prev.tp[1])}" x2="${n1(tp[0])}" y2="${n1(tp[1])}" stroke="${p.trail}" stroke-width="2.2" stroke-linecap="round"/>` +
              (p.trailStroke !== "none" ? `<line x1="${n1(prev.tp[0])}" y1="${n1(prev.tp[1])}" x2="${n1(tp[0])}" y2="${n1(tp[1])}" stroke="${p.trailStroke}" stroke-width=".7" stroke-linecap="round" opacity=".9"/>` : "") +
              `</g>`;
          }
        }
        prev = { tp, md };
      }
    }
  }

  /* ---------- dust puffs ---------- */
  let dust = "";
  let did = 0;
  const puff = (t, x, y, r0, r1, drift, a = 0.35) => {
    const nm = `du${did++}`;
    css += kfBlock(nm, [
      [0, `opacity:0;transform:translate(${n1(x)}px,${n1(y)}px) scale(.4)`],
      [t - 0.002, `opacity:0;transform:translate(${n1(x)}px,${n1(y)}px) scale(.4)`],
      [t + 0.05, `opacity:${a};transform:translate(${n1(x)}px,${n1(y - 1)}px) scale(${n1(r0)})`],
      [t + 0.7, `opacity:0;transform:translate(${n1(x + drift)}px,${n1(y - 7)}px) scale(${n1(r1)})`],
    ]);
    dust += `<circle class="a fx" style="animation-name:${nm}" r="2" fill="${p.dust}"/>`;
  };
  for (const sg of segs) {
    if (sg.takeoff != null) { const st = stateAt(sg.t0 + sg.takeoff); puff(sg.t0 + sg.takeoff, st.x - 4, GROUND - 1, 1.3, 2.8, -8, 0.4); puff(sg.t0 + sg.takeoff + 0.03, st.x + 4, GROUND - 1, 1.1, 2.4, 6, 0.3); }
    if (sg.landing != null) { const st = stateAt(sg.t0 + sg.landing); puff(sg.t0 + sg.landing, st.x - 6, GROUND - 1, 1.4, 3, -10, 0.42); puff(sg.t0 + sg.landing, st.x + 8, GROUND - 1, 1.3, 2.8, 10, 0.38); }
    if (sg.slideDust) for (let t = sg.slideDust[0]; t < sg.slideDust[1]; t += 0.14) { const st = stateAt(sg.t0 + t); puff(sg.t0 + t, st.x - 10, GROUND - 1, 1, 2.3, -9, 0.3); }
    if (sg.strikes && sg.name === "atk1") { const st = stateAt(sg.t0 + 1.78); puff(sg.t0 + 1.78, st.x - 18, GROUND - 1, 1.2, 2.8, -10, 0.38); }
  }
  // footfalls while running at pace
  for (const sg of segs) {
    if (!/^(enter|run|exit)/.test(sg.name)) continue;
    let lastIdx = Math.floor((kin(sg.t0).phi - Math.PI / 2) / Math.PI);
    for (let t = sg.t0; t < sg.t1; t += 0.01) {
      const { phi, x, v } = kin(t);
      const idx = Math.floor((phi - Math.PI / 2) / Math.PI);
      if (idx !== lastIdx) {
        lastIdx = idx;
        if (v > 28 && x > 10 && x < W - 10) puff(t, x + 7, GROUND - 1, 0.7, 1.7, -5, 0.2);
      }
    }
  }

  /* ---------- ninja rig ---------- */
  const B = p.body, F = p.farBody;
  const limb = (len, w, col) => `<path d="M0,0L0,${len}" stroke="${col}" stroke-width="${w}" stroke-linecap="round" fill="none"/>`;
  const foot = (col) => `<path d="M-2.4,11.6L5.8,13.4L5.4,15.2L-2.4,15.2Z" fill="${col}"/>`;
  const leg = (cls, th, sh, col) =>
    `<g class="a" style="animation-name:${th}">${limb(L.TH, 5.2, col)}<g transform="translate(0,${L.TH})"><g class="a" style="animation-name:${sh}">${limb(L.SH, 4.2, col)}${foot(col)}</g></g></g>`;
  const sword = `<g transform="translate(0,${L.FA})"><g class="a" style="animation-name:ksw">` +
    `<rect x="-1.4" y="-4" width="2.8" height="9" rx="1" fill="${B}" stroke="${p.guard}" stroke-width=".35"/>` +
    `<rect x="-3.6" y="4.6" width="7.2" height="1.8" rx=".9" fill="${p.guard}"/>` +
    `<path d="M-1.5,6.4L1.5,6.4L1.1,29.5L0,32L-1.1,29.5Z" fill="${p.blade}"/>` +
    `<path d="M0.55,7L0.4,29" stroke="#fff" stroke-width=".5" opacity=".75"/>` +
    `</g></g>`;
  const arm = (a1, a2, col, withSword) =>
    `<g transform="translate(0,-${L.TO})"><g class="a" style="animation-name:${a1}">${limb(L.UA, 3.8, col)}<g transform="translate(0,${L.UA})"><g class="a" style="animation-name:${a2}">${limb(L.FA, 3.2, col)}<circle cy="${L.FA}" r="1.9" fill="${col}"/>${withSword ? sword : ""}</g></g></g></g>`;
  const headG = `<g transform="translate(0,-${L.TO})"><g class="a" style="animation-name:khd">` +
    `<g transform="translate(-5.6,-8.6)"><g class="sc1"><path d="M0,0C-5,-2.4 -9,0 -15.5,-1.6C-10.5,2.4 -5,2.6 0,2.6Z" fill="${p.scarf}"/></g>` +
    `<g class="sc2"><path d="M0,1.4C-5,2 -8,5 -13,5.4C-9,7 -4.5,6 0,4Z" fill="${p.scarf}" opacity=".8"/></g></g>` +
    `<circle cx="0" cy="-${L.NK + L.HR}" r="${L.HR}" fill="${B}"/>` +
    `<path d="M-6.1,-9.9L6.1,-9.9L6.2,-7.9L-6.2,-7.9Z" fill="${p.scarf}"/>` +
    `<rect x="2.2" y="-6.9" width="3.6" height="1.3" rx=".6" fill="${p.eye}"/>` +
    `</g></g>`;
  const torso = `<path d="M-4.6,0L-5.4,-9L-5.8,-${L.TO}L5.6,-${L.TO}L5.2,-9L4.6,0Z" fill="${B}"/>` +
    `<rect x="-5.2" y="-5.4" width="10.4" height="2.6" fill="${p.scarf}"/>` +
    `<path d="M-5,-4.2L-9,-2.6L-8.4,-5.2Z" fill="${p.scarf}" opacity=".85"/>`;
  const rig =
    `<g class="a r" filter="url(#glow)" style="animation-name:kr">` +
    leg("lf", "klf", "ksf", F) +
    `<g class="a" style="animation-name:kto">` + arm("kaf", "kff", F, false) + torso + headG + arm("kan", "kfn", B, true) + `</g>` +
    leg("ln", "kln", "ksn", B) +
    `</g>`;
  defs += `<filter id="glow" x="-70%" y="-70%" width="240%" height="240%">` +
    `<feGaussianBlur in="SourceAlpha" stdDeviation="1.5" result="b"/><feFlood flood-color="${p.glow}" flood-opacity="${p.glowA}"/>` +
    `<feComposite in2="b" operator="in" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
  const shadow = `<ellipse class="a" style="animation-name:ksh" cx="0" cy="0" rx="15" ry="2.6" fill="#000" opacity=".5"/>`;

  css += rigKeyframes();

  const sc1Dur = n2(0.62 / SPEED);
  const sc2Dur = n2(0.83 / SPEED);
  const style =
    `.a{animation-duration:${DURATION}s;animation-iteration-count:infinite;animation-timing-function:linear}` +
    `.fx{opacity:0}` +
    `@keyframes fl1{0%,100%{transform:rotate(-5deg)}50%{transform:rotate(6deg)}}` +
    `@keyframes fl2{0%,100%{transform:rotate(4deg)}50%{transform:rotate(-7deg)}}` +
    `.sc1{animation:fl1 ${sc1Dur}s ease-in-out infinite}.sc2{animation:fl2 ${sc2Dur}s ease-in-out infinite}` +
    css +
    `@media (prefers-reduced-motion:reduce){.r,.fx{display:none}.a{animation:none}}`;

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="A shadow ninja runs left to right through five lanes, jumping a crate, sliding under a barrier and slicing three enemies">` +
    `<title>Shadow ninja action scene</title><style>${style}</style><defs>${defs}</defs>` +
    bg + obst + enem + dust + shadow + rig + trails + fxHigh +
    `<rect width="${W}" height="${H}" fill="url(#vig)"/>` +
    `</svg>`.replace("</svg>", "");
  const vig = `<linearGradient id="vig" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${p.sky1}" stop-opacity=".55"/><stop offset=".08" stop-color="${p.sky1}" stop-opacity="0"/><stop offset=".92" stop-color="${p.sky1}" stop-opacity="0"/><stop offset="1" stop-color="${p.sky1}" stop-opacity=".55"/></linearGradient>`;
  return svg.replace("</defs>", `${vig}</defs>`) + "</svg>";
}

/* ───────────────────────────── main ───────────────────────────── */
mkdirSync(outDir, { recursive: true });
for (const theme of ["dark", "light"]) {
  const svg = build(theme);
  const file = join(outDir, `ninja-${theme}.svg`);
  writeFileSync(file, svg);
  console.log(`${file}: ${(svg.length / 1024).toFixed(0)} KB, loop ${DURATION}s (${SPEED}x speed, baseline ${T.toFixed(1)}s)`);
}
if (DEBUG) for (const l of metrics()) console.log("  " + l);
