// ---------------------------------------------------------------------------
// zones.js - map area lookup by coordinate
// ---------------------------------------------------------------------------
//
// Format: [name, minX, minY, minZ, maxX, maxY, maxZ]
//
// Lookup returns the FIRST box that contains the point, so ordering matters:
// SUB_ZONES is searched before MAIN_ZONES. Add smaller districts to SUB_ZONES
// and they'll automatically take priority over the region they sit inside.
//
// The eight entries in MAIN_ZONES are San Andreas' top-level regions and cover
// the whole map. SA also defines roughly 370 named sub-zones (Idlewood,
// Ganton, Verdant Bluffs, The Strip and so on). I've deliberately left
// SUB_ZONES empty rather than fill it with coordinates I'd be estimating -
// wrong boundaries are worse than a correct region name. If you want street
// level detail, the full table ships with SA-MP as a zone-names include, and
// converting it is mechanical: each entry there is already
// name/minX/minY/minZ/maxX/maxY/maxZ in exactly this order.

export const SUB_ZONES = [
  // Example of the shape - uncomment and add your own:
  // ["Ganton", 2222.6, -1852.6, -89.0, 2632.8, -1722.1, 110.9],
];

export const MAIN_ZONES = [
  ["Los Santos",     44.5, -2892.2, -242.9, 2997.0,  -768.0, 900.0],
  ["San Fierro",  -2997.0, -1115.6, -242.9, -1213.9,  1176.4, 900.0],
  ["Las Venturas",  869.4,   596.3, -242.9, 2997.0,  2993.5, 900.0],
  ["Whetstone",   -2997.0, -2892.2, -242.9, -1213.9, -1115.6, 900.0],
  ["Flint County", -1213.9, -2892.2, -242.9,   44.5,  -768.0, 900.0],
  ["Red County",  -1213.9,  -768.0, -242.9, 2997.0,   596.3, 900.0],
  ["Bone County",  -480.5,   596.3, -242.9,  869.4,  2993.5, 900.0],
  ["Tierra Robada", -2997.0, 1176.4, -242.9, -480.5,  2993.5, 900.0],
  ["Tierra Robada", -1213.9,  596.3, -242.9, -480.5,  1176.4, 900.0],
];

function findIn(list, x, y, z) {
  for (let i = 0; i < list.length; i++) {
    const b = list[i];
    if (x >= b[1] && x <= b[4] && y >= b[2] && y <= b[5] && z >= b[3] && z <= b[6]) {
      return b[0];
    }
  }
  return null;
}

export function getZoneName(x, y, z) {
  return findIn(SUB_ZONES, x, y, z) || findIn(MAIN_ZONES, x, y, z) || "Unknown";
}

const COMPASS = ["N", "NW", "W", "SW", "S", "SE", "E", "NE"];

export function getCompass(heading) {
  let h = heading % 360;
  if (h < 0) h += 360;
  // GTA headings increase counter-clockwise from north.
  // If your compass reads mirrored, use (360 - h) here instead.
  return COMPASS[Math.round(h / 45) % 8];
}
