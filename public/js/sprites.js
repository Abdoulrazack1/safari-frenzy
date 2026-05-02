/**
 * Sprites — pixel art definitions
 *
 * Each sprite is an array of strings (rows of pixels).
 * Each character maps to a palette colour. '.' means transparent.
 * Sprites are 14x14 except the Pokéball which is also 14x14.
 *
 * Palette is intentionally Pokémon Red/Blue inspired but custom — no IP infringement.
 */

const PALETTE = {
  '.': null,           // transparent
  'k': '#1a1a2e',      // outline / black
  'd': '#3d3d52',      // shadow gray
  'w': '#fafffa',      // highlight white
  'W': '#cfd8c8',      // off-white
  'r': '#e63946',      // primary red
  'R': '#a4262e',      // dark red
  'y': '#fcbf49',      // primary yellow
  'Y': '#d97706',      // dark yellow / orange
  'o': '#f08c2a',      // orange
  'g': '#7bc950',      // bright green
  'G': '#3a7d3e',      // dark green
  'l': '#b8e986',      // light grass green
  'b': '#8b5a2b',      // brown
  'B': '#5c3317',      // dark brown
  'p': '#ffafcc',      // pink
  'P': '#cf5181',      // dark pink
  'u': '#a594d6',      // lilac
  'U': '#5b4d8a',      // dark purple
  'c': '#5dade2',      // cyan-blue
  'C': '#2874a6',      // dark blue
  's': '#fff3d6',      // cream / belly
};

/* ============ Creatures ============ */

// Wormy — green caterpillar (COMMON / 10pts)
const WORMY = [
  '..............',
  '.kk........kk.',
  'kggk......kggk',
  'kgggk....kggGk',
  '.kggk....kggk.',
  '..kgggggggggk.',
  '.kggGggggGggk.',
  'kgggwgggwgggGk',
  'kggggkkkkggggk',
  'kggggggggggGGk',
  '.kggggggggGGk.',
  '..kkggggggkk..',
  '....kkkkkk....',
  '..............',
];

// Pidgy — small brown bird (COMMON / 10pts)
const PIDGY = [
  '..............',
  '......kkk.....',
  '....kkbbbk....',
  '...kbbBbbbk...',
  '..kbbbBBbbbk..',
  '.kbbwkbbbBBk..',
  '.kbwkkbbbBkkk.',
  '.kbbbbbbbbobk.',
  '..kbbbsbbbobk.',
  '..kbbsssbbobk.',
  '...kbsssbobk..',
  '....kkbbbkk...',
  '......kk......',
  '......kk......',
];

// Rattz — purple rat (COMMON / 10pts)
const RATTZ = [
  '..............',
  '..kk......kk..',
  '.kuuk....kuuk.',
  'kuUuk....kuUuk',
  'kuuuk....kuuuk',
  '.kuuuuuuuuuk..',
  '.kuwuuuuwuuk..',
  'kuukuuuukuUuk.',
  'kussuuuussUuk.',
  '.kuuuuuuuuk...',
  '..kuuukkuuuk..',
  '...kkkk.kkkk..',
  '..............',
  '..............',
];

// Sparky — yellow electric mouse (UNCOMMON / 25pts)
const SPARKY = [
  '..............',
  '...kk......kk.',
  '..kykk....kkyk',
  '..kyyykkkkyyyk',
  '...kyyyyyyyyk.',
  '..kyrkyyyykryk',
  '..kykkyyyykkyk',
  '..kyyyywwyyyyk',
  '..kyykwwwwkyyk',
  '...kyykkkkyyk.',
  '....kyyyyyyk..',
  '....kYYkkYYk..',
  '....kk....kk..',
  '..............',
];

// Furrball — pink fox (UNCOMMON / 25pts)
const FURRBALL = [
  '..............',
  '...kk......kk.',
  '..kpwk....kwpk',
  '.kppwk..kwppk.',
  '.kpppwkkkkwppk',
  '.kpwwppppppwwk',
  'kpwkpppppppkpk',
  'kpkkppwwppkkpk',
  'kpppppkkpppppk',
  '.kpPpppppppPk.',
  '..kpPPppppPPk.',
  '...kkPPppPPk..',
  '.....kkkkkk...',
  '..............',
];

// Mewzy — legendary pink (RARE / 50pts)
const MEWZY = [
  '......kkkk....',
  '....kkpppppk..',
  '...kppwwpppk..',
  '..kppwwwwppk..',
  '..kpwwkwkwpk..',
  '..kpwkwkkwpkk.',
  '..kpwwwwwwpPk.',
  '..kppppPpppPk.',
  '...kpppppPPkk.',
  '....kPpppPk...',
  '.....kkPkk....',
  '......kPk.....',
  '....kkPPkk....',
  '...kkk..kkk...',
];

// TIMECLOCK — power-up: +5 seconds (rare drop)
const TIMECLOCK = [
  '..............',
  '......kk......',
  '....kkyyyykk..',
  '...kyyWWWWyk..',
  '..kyWWkWkWWyk.',
  '..kyWWWkWWWyk.',
  '..kyWkrrrkWyk.',
  '..kyWWrkWWWyk.',
  '..kyWWWkWWWyk.',
  '..kyWWWkkWWyk.',
  '...kyyWWWWyk..',
  '....kkyyyykk..',
  '......kk......',
  '..............',
];

// STAR — power-up: freeze creatures 3s (rare drop)
const STAR = [
  '..............',
  '......kk......',
  '......yy......',
  '.....kyyk.....',
  '.....kyyk.....',
  '.kkkkkyykkkkk.',
  '.kyyyyyyyyyyk.',
  '.kyyyywwyyyyk.',
  '..kyyywwyyyk..',
  '...kyyyyyyk...',
  '..kyykkkkyyk..',
  '.kykk....kkyk.',
  '.kk........kk.',
  '..............',
];

// MASTERBALL — power-up: next click is a guaranteed AOE capture (legendary)
const MASTERBALL = [
  '..............',
  '....kkkkkk....',
  '...kuuuuuuk...',
  '..kuuuuuuuuk..',
  '..kuyuuuuyuk..',
  '.kuuuyuuyuuuk.',
  '.kkkkkkkkkkkk.',
  '.kwwwwkkwwwwk.',
  '.kwwwkwwkwwwk.',
  '..kwwkwwkwwk..',
  '..kwwwwwwwwk..',
  '...kwwwwwwk...',
  '....kkkkkk....',
  '..............',
];

// MAGNET — power-up: auto-aim 4s
const MAGNET = [
  '..............',
  '..............',
  '.kkkk....kkkk.',
  '.krrk....krrk.',
  '.krrk....krrk.',
  '.krrk....krrk.',
  '.krrk....krrk.',
  '.krrkkkkkkrrk.',
  '.krrwwwwwwrrk.',
  '.krrwwwwwwrrk.',
  '.kkkrrrrrrkkk.',
  '...kkkkkkkk...',
  '..............',
  '..............',
];

// REPEL_GUST — power-up: clears all BOOMb on screen
const REPEL_GUST = [
  '..............',
  '......kk......',
  '....kkccckk...',
  '...kcccccccck.',
  '..kccwwwwccck.',
  '.kcwwwwwwwwwck',
  '.kccwwwwwwccck',
  '.kcccwwwwwcck.',
  '..kccccwccck..',
  '..kkccccckk...',
  '...kkccckk....',
  '....kkkkk.....',
  '..............',
  '..............',
];

// BOOMb — explosive trap (DANGER / -20pts)
const BOOMB = [
  '..............',
  '....kkkkkk....',
  '...krrrrrrk...',
  '..krrrwwrrrk..',
  '..krrwwwwrrk..',
  '.krrwwwwwwrrk.',
  '.kwwwwwwwwwwk.',
  '.kwwwwwwwwwwk.',
  '.kwwwwwwwwwwk.',
  '.krrrrrrrrrrk.',
  '..krrrrrrrrk..',
  '..krrkrkkrrk..',
  '...krkkkkkrk..',
  '....kkkkkk....',
];

/* ============ Items ============ */

// Pokéball — used for throw animation
const POKEBALL = [
  '..............',
  '....kkkkkk....',
  '...krrrrrrk...',
  '..krrrrrrrrk..',
  '..krrwrrrrwrk.',
  '.krrrrrrrrrrk.',
  '.kkkkkkkkkkkk.',
  '.kwwwwkkwwwwk.',
  '.kwwwkwwkwwwk.',
  '..kwwkwwkwwk..',
  '..kwwwwwwwwk..',
  '...kwwwwwwk...',
  '....kkkkkk....',
  '..............',
];

/* ============ Background tile: tall grass ============ */

const GRASS_TILE = [
  'GGGgGGGgGGGgGGGg',
  'GgGGGgGGGgGGGgGG',
  'GGGgGgGGGGGgGgGG',
  'lGGgglGGGGglGGgg',
  'GGgGGGGgGgGGGGgG',
  'GgGgGgGgGgGgGgGg',
  'GGglGGGGGGglGGGG',
  'gGGGgGGGGGGGgGGg',
  'GgGGGgGGGGGgGGGg',
  'GGgGGGGgGgGGGGgG',
  'lGGGglGGGGglGGGg',
  'GgGgGgGgGgGgGgGg',
  'GGglGGGGGGglGGGG',
  'gGGGgGGGGGGGgGGg',
  'GgGGGgGGGGGgGGGg',
  'GGgGGGGGGgGGGGgG',
];

/* ============ Creature catalog ============ */

const CREATURES = [
  { id: 'wormy',    sprite: WORMY,    name: 'Wormy',    points: 10,  rarity: 'common',    weight: 30, lifeMs: 1100 },
  { id: 'pidgy',    sprite: PIDGY,    name: 'Pidgy',    points: 10,  rarity: 'common',    weight: 28, lifeMs: 1050 },
  { id: 'rattz',    sprite: RATTZ,    name: 'Rattz',    points: 10,  rarity: 'common',    weight: 28, lifeMs: 1000 },
  { id: 'sparky',   sprite: SPARKY,   name: 'Sparky',   points: 25,  rarity: 'uncommon',  weight: 14, lifeMs: 850  },
  { id: 'furrball', sprite: FURRBALL, name: 'Furrball', points: 25,  rarity: 'uncommon',  weight: 12, lifeMs: 850  },
  { id: 'mewzy',    sprite: MEWZY,    name: 'Mewzy',    points: 50,  rarity: 'rare',      weight: 3,  lifeMs: 600  },
  { id: 'boomb',    sprite: BOOMB,    name: 'BOOMb',    points: -20, rarity: 'danger',    weight: 18, lifeMs: 1200 },
];

/* ============ Power-up items (rare random drops) ============ */

const ITEMS = [
  { id: 'clock',     sprite: TIMECLOCK,  name: 'Time+5',     effect: 'time_bonus', weight: 5, lifeMs: 2200, rarity: 'item' },
  { id: 'star',      sprite: STAR,       name: 'Freeze',     effect: 'freeze',     weight: 4, lifeMs: 2200, rarity: 'item' },
  { id: 'masterball',sprite: MASTERBALL, name: 'Master AOE', effect: 'master_aoe', weight: 2, lifeMs: 2000, rarity: 'item' },
  { id: 'magnet',    sprite: MAGNET,     name: 'Magnet',     effect: 'magnet',     weight: 3, lifeMs: 2000, rarity: 'item' },
  { id: 'repel',     sprite: REPEL_GUST, name: 'Repel',      effect: 'repel',      weight: 3, lifeMs: 2000, rarity: 'item' },
];

/* ============ Renderer ============ */

/**
 * Draws a sprite onto a canvas context.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string[]} sprite — array of pixel rows
 * @param {number} x — top-left x
 * @param {number} y — top-left y
 * @param {number} pixelSize — size of one pixel in screen units
 */
function drawSprite(ctx, sprite, x, y, pixelSize) {
  for (let row = 0; row < sprite.length; row++) {
    const line = sprite[row];
    for (let col = 0; col < line.length; col++) {
      const ch = line[col];
      const colour = PALETTE[ch];
      if (!colour) continue;
      ctx.fillStyle = colour;
      ctx.fillRect(
        Math.floor(x + col * pixelSize),
        Math.floor(y + row * pixelSize),
        Math.ceil(pixelSize),
        Math.ceil(pixelSize),
      );
    }
  }
}

/**
 * Draws a tiled background of tall grass.
 */
function drawGrassPattern(ctx, x, y, w, h, pixelSize) {
  const tileW = GRASS_TILE[0].length * pixelSize;
  const tileH = GRASS_TILE.length * pixelSize;
  for (let ty = y; ty < y + h; ty += tileH) {
    for (let tx = x; tx < x + w; tx += tileW) {
      drawSprite(ctx, GRASS_TILE, tx, ty, pixelSize);
    }
  }
}

window.SafariSprites = {
  PALETTE,
  CREATURES,
  ITEMS,
  POKEBALL,
  drawSprite,
  drawGrassPattern,
};
