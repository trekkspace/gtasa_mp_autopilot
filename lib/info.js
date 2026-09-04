// ---------------------------------------------------------------------------
// info.js - reads game state and turns it into display lines
// ---------------------------------------------------------------------------

import { CONFIG, MS_TO_KMH, MS_TO_MPH } from "../config.js";
import { safe, round } from "./utils.js";
import { getVehicleName, getVehicleClass } from "../data/vehicles.js";
import { getZoneName, getCompass } from "../data/zones.js";

function formatSpeed(metresPerSecond) {
  if (CONFIG.units === "mph") return round(metresPerSecond * MS_TO_MPH, 0) + " mph";
  return round(metresPerSecond * MS_TO_KMH, 0) + " km/h";
}

export function collectLines(player) {
  const lines = [];
  const char = player.getChar();

  const pos = safe(() => char.getCoordinates(), { x: 0, y: 0, z: 0 });
  const heading = safe(() => char.getHeading(), 0);
  const inCar = safe(() => char.isInAnyCar(), false);

  // --- state ---
  if (inCar) {
    const car = safe(() => char.storeCarIsInNoSave(), null);
    if (car) {
      const model = safe(() => car.getModel(), 0);
      lines.push("State: In vehicle");
      lines.push("Vehicle: " + getVehicleName(model) + "  [" + getVehicleClass(model) + "]");
      lines.push("Model ID: " + model);
      lines.push("Speed: " + formatSpeed(safe(() => car.getSpeed(), 0)));
      lines.push("Veh HP: " + round(safe(() => car.getHealth(), 0), 0));
    } else {
      lines.push("State: In vehicle (no handle)");
    }
  } else {
    const detail = [];
    if (safe(() => char.isSwimming(), false)) detail.push("swimming");
    if (safe(() => char.isDucking(), false)) detail.push("crouched");
    lines.push("State: On foot" + (detail.length ? " (" + detail.join(", ") + ")" : ""));
  }

  // --- location ---
  lines.push("Area: " + getZoneName(pos.x, pos.y, pos.z));
  lines.push("X: " + round(pos.x, 1) + "  Y: " + round(pos.y, 1) + "  Z: " + round(pos.z, 1));
  lines.push("Facing: " + getCompass(heading) + "  (" + round(heading, 0) + " deg)");

  const interior = safe(() => Game.GetAreaVisible(), 0);
  if (interior !== 0) lines.push("Interior: " + interior);

  // --- player ---
  const hp = safe(() => char.getHealth(), null);
  if (hp !== null) {
    const armour = safe(() => char.getArmour(), null);
    lines.push("Health: " + round(hp, 0) + (armour !== null ? "   Armour: " + round(armour, 0) : ""));
  }

  const wanted = safe(() => player.storeWantedLevel(), null);
  if (wanted !== null) lines.push("Wanted: " + wanted);

  return lines;
}
