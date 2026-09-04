// ---------------------------------------------------------------------------
// vehicles.js - GTA San Andreas vehicle model IDs, 400-611
// ---------------------------------------------------------------------------

export const VEHICLE_NAMES = {
  400: "Landstalker", 401: "Bravura", 402: "Buffalo", 403: "Linerunner",
  404: "Perennial", 405: "Sentinel", 406: "Dumper", 407: "Firetruck",
  408: "Trashmaster", 409: "Stretch", 410: "Manana", 411: "Infernus",
  412: "Voodoo", 413: "Pony", 414: "Mule", 415: "Cheetah", 416: "Ambulance",
  417: "Leviathan", 418: "Moonbeam", 419: "Esperanto", 420: "Taxi",
  421: "Washington", 422: "Bobcat", 423: "Mr Whoopee", 424: "BF Injection",
  425: "Hunter", 426: "Premier", 427: "Enforcer", 428: "Securicar",
  429: "Banshee", 430: "Predator", 431: "Bus", 432: "Rhino", 433: "Barracks",
  434: "Hotknife", 435: "Article Trailer", 436: "Previon", 437: "Coach",
  438: "Cabbie", 439: "Stallion", 440: "Rumpo", 441: "RC Bandit",
  442: "Romero", 443: "Packer", 444: "Monster", 445: "Admiral", 446: "Squalo",
  447: "Seasparrow", 448: "Pizzaboy", 449: "Tram", 450: "Article Trailer 2",
  451: "Turismo", 452: "Speeder", 453: "Reefer", 454: "Tropic", 455: "Flatbed",
  456: "Yankee", 457: "Caddy", 458: "Solair", 459: "Berkley's RC Van",
  460: "Skimmer", 461: "PCJ-600", 462: "Faggio", 463: "Freeway",
  464: "RC Baron", 465: "RC Raider", 466: "Glendale", 467: "Oceanic",
  468: "Sanchez", 469: "Sparrow", 470: "Patriot", 471: "Quad",
  472: "Coastguard", 473: "Dinghy", 474: "Hermes", 475: "Sabre",
  476: "Rustler", 477: "ZR-350", 478: "Walton", 479: "Regina", 480: "Comet",
  481: "BMX", 482: "Burrito", 483: "Camper", 484: "Marquis", 485: "Baggage",
  486: "Dozer", 487: "Maverick", 488: "News Chopper", 489: "Rancher",
  490: "FBI Rancher", 491: "Virgo", 492: "Greenwood", 493: "Jetmax",
  494: "Hotring Racer", 495: "Sandking", 496: "Blista Compact",
  497: "Police Maverick", 498: "Boxville", 499: "Benson", 500: "Mesa",
  501: "RC Goblin", 502: "Hotring Racer A", 503: "Hotring Racer B",
  504: "Bloodring Banger", 505: "Rancher (Lure)", 506: "Super GT",
  507: "Elegant", 508: "Journey", 509: "Bike", 510: "Mountain Bike",
  511: "Beagle", 512: "Cropduster", 513: "Stuntplane", 514: "Tanker",
  515: "Roadtrain", 516: "Nebula", 517: "Majestic", 518: "Buccaneer",
  519: "Shamal", 520: "Hydra", 521: "FCR-900", 522: "NRG-500",
  523: "HPV1000", 524: "Cement Truck", 525: "Tow Truck", 526: "Fortune",
  527: "Cadrona", 528: "FBI Truck", 529: "Willard", 530: "Forklift",
  531: "Tractor", 532: "Combine Harvester", 533: "Feltzer", 534: "Remington",
  535: "Slamvan", 536: "Blade", 537: "Freight", 538: "Streak", 539: "Vortex",
  540: "Vincent", 541: "Bullet", 542: "Clover", 543: "Sadler",
  544: "Firetruck LA", 545: "Hustler", 546: "Intruder", 547: "Primo",
  548: "Cargobob", 549: "Tampa", 550: "Sunrise", 551: "Merit",
  552: "Utility Van", 553: "Nevada", 554: "Yosemite", 555: "Windsor",
  556: "Monster A", 557: "Monster B", 558: "Uranus", 559: "Jester",
  560: "Sultan", 561: "Stratum", 562: "Elegy", 563: "Raindance",
  564: "RC Tiger", 565: "Flash", 566: "Tahoma", 567: "Savanna",
  568: "Bandito", 569: "Freight Flat Trailer", 570: "Streak Carriage",
  571: "Kart", 572: "Mower", 573: "Duneride", 574: "Sweeper", 575: "Broadway",
  576: "Tornado", 577: "AT-400", 578: "DFT-30", 579: "Huntley",
  580: "Stafford", 581: "BF-400", 582: "News Van", 583: "Tug",
  584: "Petrol Trailer", 585: "Emperor", 586: "Wayfarer", 587: "Euros",
  588: "Hotdog", 589: "Club", 590: "Freight Box Trailer",
  591: "Article Trailer 3", 592: "Andromada", 593: "Dodo", 594: "RC Cam",
  595: "Launch", 596: "Police Car (LS)", 597: "Police Car (SF)",
  598: "Police Car (LV)", 599: "Police Ranger", 600: "Picador",
  601: "S.W.A.T. Van", 602: "Alpha", 603: "Phoenix", 604: "Glendale (Damaged)",
  605: "Sadler (Damaged)", 606: "Baggage Trailer A", 607: "Baggage Trailer B",
  608: "Tug Stairs Trailer", 609: "Boxville (Burger)", 610: "Farm Trailer",
  611: "Utility Trailer",
};

const BIKES = [448, 461, 462, 463, 468, 471, 481, 509, 510, 521, 522, 523, 581, 586];
const PLANES = [417, 425, 447, 460, 469, 476, 487, 488, 497, 511, 512, 513, 519, 520, 548, 563, 577, 592, 593];
const BOATS = [430, 446, 452, 453, 454, 472, 473, 484, 493, 595];
const TRAINS = [449, 537, 538, 569, 570, 590];

export function getVehicleName(model) {
  return VEHICLE_NAMES[model] || "Unknown (" + model + ")";
}

export function getVehicleClass(model) {
  if (BIKES.indexOf(model) !== -1) return "Bike";
  if (PLANES.indexOf(model) !== -1) return "Air";
  if (BOATS.indexOf(model) !== -1) return "Boat";
  if (TRAINS.indexOf(model) !== -1) return "Rail";
  return "Car";
}
