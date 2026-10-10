#!/usr/bin/env node
/**
 * Five-lane cinematic ninja scene for a profile README.
 * No packages are required: the generated SVG uses CSS keyframes so GitHub can
 * display it directly from the output branch.
 *
 * Usage: node .github/scripts/ninja.mjs [output-directory]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const outDir = process.argv[2] || "dist";
const WIDTH = 960;
const HEIGHT = 320;
const LANES = 5;
const LANE_H = 50;
const TOP = 42;
const LOOP = 24;

const themes = {
  dark: {
    sky: "#090d18", horizon: "#121b2e", laneA: "#111b2c", laneB: "#0d1626",
    grid: "#23334b", ground: "#3b5b7a", body: "#070a10", cloth: "#65d6ff",
    blade: "#ecf7ff", eye: "#e8fbff", enemy: "#ef5b72", enemyDark: "#4a1d31",
    glow: "#65d6ff", slash: "#f6fcff", text: "#92acc8", spark: "#ffd978",
  },
  light: {
    sky: "#eff5fb", horizon: "#d9e6f2", laneA: "#e4edf5", laneB: "#d8e5f0",
    grid: "#b7cada", ground: "#6f8ca7", body: "#18212b", cloth: "#0969da",
    blade: "#34495e", eye: "#ffffff", enemy: "#b42340", enemyDark: "#6b1830",
    glow: "#0969da", slash: "#18212b", text: "#516a81", spark: "#d17c00",
  },
};

const pct = (seconds) => `${((seconds / LOOP) * 100).toFixed(3)}%`;

function scene(themeName) {
  const c = themes[themeName];
  const laneY = (n) => TOP + n * LANE_H + LANE_H - 7;
  const laneRects = Array.from({ length: LANES }, (_, i) => {
    const y = TOP + i * LANE_H;
    return `<rect class="lane" x="0" y="${y}" width="${WIDTH}" height="${LANE_H}" fill="${i % 2 ? c.laneB : c.laneA}"/>` +
      `<path class="guide" d="M0 ${laneY(i)}H${WIDTH}"/>` +
      `<text x="18" y="${y + 20}" class="lane-label">0${i + 1}</text>`;
  }).join("");

  const runMarks = Array.from({ length: 17 }, (_, i) => `<path d="M${i * 62 - 25} ${laneY(2) + 8}h26" class="ground-mark"/>`).join("");
  const ninja = `
    <g id="ninja" aria-label="running ninja">
      <path class="scarf-tail tail-one" d="M-13 -42 C-35 -55 -49 -48 -65 -59 C-55 -39 -35 -31 -13 -33Z"/>
      <path class="scarf-tail tail-two" d="M-14 -34 C-35 -31 -48 -19 -61 -24 C-46 -10 -30 -16 -12 -25Z" opacity=".76"/>
      <circle class="head" cx="-5" cy="-40" r="18"/>
      <path class="band" d="M-22 -48H15v8H-22z"/>
      <path class="eye" d="M2 -43h13v5H2z"/>
      <path class="torso" d="M-23 -22 Q-5 -30 15 -20 L11 19H-22Z"/>
      <g class="back-arm"><path d="M-16 -17L-42 -1"/><path d="M-42 -1l-8 15"/></g>
      <g class="front-arm"><path d="M8 -18L31 -34"/><path d="M31 -34l9 -17"/></g>
      <g class="back-leg"><path d="M-16 17L-43 39"/><path d="M-43 39l-15 0"/></g>
      <g class="front-leg"><path d="M4 17L29 41"/><path d="M29 41l17 0"/></g>
      <g class="katana"><path class="handle" d="M38 -50l8 8"/><path class="blade" d="M43 -55L92 -94"/></g>
    </g>`;

  const enemies = `
    <g id="enemy-a" class="enemy e-a"><circle cx="0" cy="-25" r="15"/><path d="M-18 -9H18L27 32H-25Z"/><path d="M-19 2L-38 25M18 2L38 25"/></g>
    <g id="enemy-b" class="enemy e-b"><circle cx="0" cy="-25" r="15"/><path d="M-18 -9H18L27 32H-25Z"/><path d="M-19 2L-38 25M18 2L38 25"/></g>
    <g id="enemy-c" class="enemy e-c"><circle cx="0" cy="-25" r="15"/><path d="M-18 -9H18L27 32H-25Z"/><path d="M-19 2L-38 25M18 2L38 25"/></g>`;

  const css = `
    .lane-label{font:700 10px ui-monospace,monospace;fill:${c.text};letter-spacing:2px}.guide{stroke:${c.grid};stroke-width:1;stroke-dasharray:4 8}.ground-mark{stroke:${c.ground};stroke-width:3;opacity:.45}
    .obstacle{fill:${c.ground};stroke:${c.glow};stroke-width:1}.enemy{fill:${c.enemy};stroke:${c.enemyDark};stroke-width:3;stroke-linecap:round;stroke-linejoin:round}.enemy path{fill:${c.enemy}}
    .head,.torso{fill:${c.body}}.band,.scarf-tail{fill:${c.cloth}}.eye{fill:${c.eye}}#ninja g:not(.katana){fill:none;stroke:${c.body};stroke-width:10;stroke-linecap:round;stroke-linejoin:round}.blade{fill:none;stroke:${c.blade};stroke-width:4;stroke-linecap:round}.handle{fill:none;stroke:${c.cloth};stroke-width:7;stroke-linecap:round}
    .runner{animation:travel ${LOOP}s linear infinite}.pose{animation:pose ${LOOP}s linear infinite;transform-origin:0 0}.front-leg{animation:front-leg .62s ease-in-out infinite alternate}.back-leg{animation:back-leg .62s ease-in-out infinite alternate}.front-arm{animation:front-arm .62s ease-in-out infinite alternate}.back-arm{animation:back-arm .62s ease-in-out infinite alternate}.tail-one{animation:tail .62s ease-in-out infinite alternate}.tail-two{animation:tail .62s .2s ease-in-out infinite alternate}
    .e-a{animation:enemy-a ${LOOP}s linear infinite}.e-b{animation:enemy-b ${LOOP}s linear infinite}.e-c{animation:enemy-c ${LOOP}s linear infinite}.slash{fill:none;stroke:${c.slash};stroke-linecap:round;opacity:0}.trail{fill:none;stroke:${c.glow};stroke-width:10;opacity:0;filter:url(#glow)}.impact{fill:${c.spark};opacity:0;filter:url(#glow)}
    @keyframes travel{0%,${pct(.7)}{transform:translate(-85px,${laneY(2)}px)}${pct(1)}{transform:translate(-45px,${laneY(2)}px)}${pct(4)}{transform:translate(130px,${laneY(2)}px)}${pct(4.8)}{transform:translate(174px,${laneY(2)}px)}${pct(5.8)}{transform:translate(230px,${laneY(2) - 50}px)}${pct(7)}{transform:translate(292px,${laneY(2)}px)}${pct(8.8)}{transform:translate(405px,${laneY(2)}px)}${pct(9.8)}{transform:translate(457px,${laneY(2)}px)}${pct(11.5)}{transform:translate(547px,${laneY(2)}px)}${pct(13.5)}{transform:translate(645px,${laneY(2)}px)}${pct(15)}{transform:translate(730px,${laneY(2)}px)}${pct(17.5)}{transform:translate(835px,${laneY(2)}px)}${pct(20.4)}{transform:translate(958px,${laneY(2)}px)}${pct(22.5)}{transform:translate(1050px,${laneY(2)}px)}100%{transform:translate(-85px,${laneY(2)}px)}}
    @keyframes pose{0%,${pct(4.5)},${pct(7.3)},${pct(8.7)},${pct(11.8)},${pct(14)},${pct(15.5)},${pct(18)},${pct(21)},100%{transform:translateY(0) rotate(0) scale(1)}${pct(4.8)}{transform:translateY(8px) rotate(-9deg)}${pct(5.8)}{transform:translateY(-7px) rotate(-8deg)}${pct(6.5)}{transform:translateY(3px) rotate(5deg)}${pct(9.8)}{transform:translateY(17px) scaleY(.63) scaleX(1.14)}${pct(10.8)}{transform:translateY(17px) scaleY(.63) scaleX(1.14)}${pct(13.2)}{transform:rotate(-18deg) scale(1.04)}${pct(13.7)}{transform:rotate(20deg) scale(1.04)}${pct(17.2)}{transform:rotate(-34deg) scale(1.05)}${pct(17.7)}{transform:rotate(16deg)}${pct(20.1)}{transform:rotate(-53deg) scale(1.06)}${pct(20.7)}{transform:rotate(11deg)}}
    @keyframes front-leg{to{transform:translate(-8px,5px) rotate(-17deg)}}@keyframes back-leg{to{transform:translate(9px,-4px) rotate(18deg)}}@keyframes front-arm{to{transform:rotate(-17deg)}}@keyframes back-arm{to{transform:rotate(16deg)}}@keyframes tail{to{transform:translate(-8px,5px) rotate(8deg)}}
    @keyframes enemy-a{0%,${pct(13.4)}{transform:translate(650px,${laneY(2)}px);opacity:1}${pct(13.8)}{transform:translate(676px,${laneY(2)-16}px) rotate(34deg) scale(.6);opacity:0}${pct(23)},100%{opacity:0}}@keyframes enemy-b{0%,${pct(17.4)}{transform:translate(840px,${laneY(2)}px);opacity:1}${pct(17.8)}{transform:translate(865px,${laneY(2)-20}px) rotate(-45deg) scale(.55);opacity:0}${pct(23)},100%{opacity:0}}@keyframes enemy-c{0%,${pct(20.3)}{transform:translate(950px,${laneY(2)}px);opacity:1}${pct(20.8)}{transform:translate(972px,${laneY(2)+12}px) rotate(55deg) scale(.5);opacity:0}${pct(23)},100%{opacity:0}}
    .s1{animation:s1 ${LOOP}s linear infinite}.s2{animation:s2 ${LOOP}s linear infinite}.s3{animation:s3 ${LOOP}s linear infinite}.t1{animation:t1 ${LOOP}s linear infinite}.t2{animation:t2 ${LOOP}s linear infinite}.t3{animation:t3 ${LOOP}s linear infinite}.i1{animation:i1 ${LOOP}s linear infinite}.i2{animation:i2 ${LOOP}s linear infinite}.i3{animation:i3 ${LOOP}s linear infinite}
    @keyframes s1{0%,${pct(13.35)}{opacity:0}${pct(13.5)}{opacity:1;stroke-width:4}${pct(14)}{opacity:0;stroke-width:1}100%{opacity:0}}@keyframes s2{0%,${pct(17.35)}{opacity:0}${pct(17.5)}{opacity:1;stroke-width:4}${pct(18)}{opacity:0}100%{opacity:0}}@keyframes s3{0%,${pct(20.25)}{opacity:0}${pct(20.5)}{opacity:1;stroke-width:4}${pct(21)}{opacity:0}100%{opacity:0}}@keyframes t1{0%,${pct(13.35)}{opacity:0}${pct(13.5)}{opacity:.72}${pct(14)}{opacity:0}100%{opacity:0}}@keyframes t2{0%,${pct(17.35)}{opacity:0}${pct(17.5)}{opacity:.72}${pct(18)}{opacity:0}100%{opacity:0}}@keyframes t3{0%,${pct(20.25)}{opacity:0}${pct(20.5)}{opacity:.72}${pct(21)}{opacity:0}100%{opacity:0}}@keyframes i1{0%,${pct(13.5)}{opacity:0}${pct(13.7)}{opacity:1}${pct(14.2)}{opacity:0}100%{opacity:0}}@keyframes i2{0%,${pct(17.5)}{opacity:0}${pct(17.7)}{opacity:1}${pct(18.2)}{opacity:0}100%{opacity:0}}@keyframes i3{0%,${pct(20.5)}{opacity:0}${pct(20.7)}{opacity:1}${pct(21.2)}{opacity:0}100%{opacity:0}}
    @media(prefers-reduced-motion:reduce){.runner,.pose,.front-leg,.back-leg,.front-arm,.back-arm,.tail-one,.tail-two,.enemy,.slash,.trail,.impact{animation:none}.runner{transform:translate(470px,${laneY(2)}px)}.e-a,.e-b,.e-c,.slash,.trail,.impact{display:none}}
  `;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-labelledby="title desc"><title id="title">Cinematic five-lane ninja run</title><desc id="desc">A ninja moves slowly across five game lanes, jumps an obstacle, slides under a barrier, and defeats three enemies with distinct katana slashes.</desc><defs><filter id="glow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>${ninja}<style>${css}</style></defs><rect width="${WIDTH}" height="${HEIGHT}" fill="${c.sky}"/><path d="M0 32H${WIDTH}" stroke="${c.horizon}" stroke-width="2"/>${laneRects}${runMarks}<g aria-label="jump obstacle"><path class="obstacle" d="M225 ${laneY(2)}l11-34 11 34z"/><path class="obstacle" d="M208 ${laneY(2)}h38"/></g><g aria-label="low barrier"><path class="obstacle" d="M448 ${laneY(2)}V${laneY(2)-37}H514V${laneY(2)}"/><path class="obstacle" d="M444 ${laneY(2)-37}h74"/></g>${enemies}<g class="s1"><path class="trail t1" d="M597 ${laneY(2)-70}Q665 ${laneY(2)-44} 718 ${laneY(2)-13}"/><path class="slash" d="M597 ${laneY(2)-70}Q665 ${laneY(2)-44} 718 ${laneY(2)-13}"/></g><g class="s2"><path class="trail t2" d="M790 ${laneY(2)-80}L888 ${laneY(2)+8}"/><path class="slash" d="M790 ${laneY(2)-80}L888 ${laneY(2)+8}"/></g><g class="s3"><path class="trail t3" d="M912 ${laneY(2)-92}Q978 ${laneY(2)-41} 920 ${laneY(2)+10}"/><path class="slash" d="M912 ${laneY(2)-92}Q978 ${laneY(2)-41} 920 ${laneY(2)+10}"/></g><g class="impact i1"><circle cx="674" cy="${laneY(2)-18}" r="9"/><path d="M674 ${laneY(2)-42}v48M650 ${laneY(2)-18}h48" stroke="${c.spark}" stroke-width="3"/></g><g class="impact i2"><circle cx="860" cy="${laneY(2)-20}" r="9"/><path d="M860 ${laneY(2)-44}v48M836 ${laneY(2)-20}h48" stroke="${c.spark}" stroke-width="3"/></g><g class="impact i3"><circle cx="962" cy="${laneY(2)-15}" r="9"/><path d="M962 ${laneY(2)-39}v48M938 ${laneY(2)-15}h48" stroke="${c.spark}" stroke-width="3"/></g><g class="runner"><g class="pose"><use href="#ninja" filter="url(#glow)"/></g></g><text x="18" y="24" fill="${c.text}" font-family="ui-monospace,monospace" font-size="12" letter-spacing="3">SHADOW RUN // FIVE-LANE SEQUENCE</text></svg>`;
}

mkdirSync(outDir, { recursive: true });
for (const theme of Object.keys(themes)) {
  const file = join(outDir, `ninja-${theme}.svg`);
  writeFileSync(file, scene(theme));
  console.log(`Wrote ${file} (${LANES} lanes, ${LOOP}s loop)`);
}
