// =========================================================
// BLACKLINE // OPS — Large 3-Lane Combat Arena Blueprints
// =========================================================

export const MAPS = {
  killhouse: {
    id: "killhouse",
    name: "CARGO YARD // PORT OPS",
    halfW: 52,
    halfD: 52,
    theme: {
      skyTop: 0x0d1b2a,
      skyHorizon: 0x3b4d63,
      fogColor: 0x263445,
      fogDensity: 0.008,
      sunColor: 0xffdfb8,
      sunIntensity: 2.35,
      sunPos: [36, 52, 28],
      hemiSky: 0x8fb8de,
      hemiGround: 0x262930,
      hemiIntensity: 0.92,
      groundMat: "asphalt"
    },
    solids: [
      // Perimeter concrete walls (104m x 104m)
      { x: 0, z: -52.5, yBase: 0, w: 106, h: 7.0, d: 1, mat: "concreteWall" },
      { x: 0, z: 52.5, yBase: 0, w: 106, h: 7.0, d: 1, mat: "concreteWall" },
      { x: -52.5, z: 0, yBase: 0, w: 1, h: 7.0, d: 106, mat: "concreteWall" },
      { x: 52.5, z: 0, yBase: 0, w: 1, h: 7.0, d: 106, mat: "concreteWall" },

      // Central overhead steel bridge & hazard cover rails (top walkable at y = 3.0)
      { x: 0, z: 0, yBase: 2.65, w: 20, h: 0.35, d: 4.4, mat: "metalDeck" },
      { x: 0, z: -2.0, yBase: 3.0, w: 14, h: 0.9, d: 0.35, mat: "hazardMetal" },
      { x: 0, z: 2.0, yBase: 3.0, w: 14, h: 0.9, d: 0.35, mat: "hazardMetal" },

      // 4 Inner container clusters around center bridge
      { x: -11, z: -11, yBase: 0, w: 9, h: 3.2, d: 3.4, mat: "containerBlue" },
      { x: 11, z: -11, yBase: 0, w: 9, h: 3.2, d: 3.4, mat: "containerRed" },
      { x: -11, z: 11, yBase: 0, w: 9, h: 3.2, d: 3.4, mat: "containerOlive" },
      { x: 11, z: 11, yBase: 0, w: 9, h: 3.2, d: 3.4, mat: "containerBlue" },

      // 2nd-tier stacked containers
      { x: -11, z: -11, yBase: 3.2, w: 9, h: 3.2, d: 3.4, mat: "containerRed" },
      { x: 11, z: 11, yBase: 3.2, w: 9, h: 3.2, d: 3.4, mat: "containerOlive" },

      // Mid tactical wooden cover crates
      { x: -4, z: -5.5, yBase: 0, w: 2.4, h: 1.35, d: 1.6, mat: "woodCrate" },
      { x: 4, z: 5.5, yBase: 0, w: 2.4, h: 1.35, d: 1.6, mat: "woodCrate" },
      { x: 0, z: -16, yBase: 0, w: 3.2, h: 1.4, d: 1.8, mat: "woodCrate" },
      { x: 0, z: 16, yBase: 0, w: 3.2, h: 1.4, d: 1.8, mat: "woodCrate" },

      // West Warehouse Complex (breachable bays + interior mezzanine balcony)
      { x: -44, z: -10, yBase: 0, w: 1.0, h: 5.5, d: 12, mat: "concreteWall" },
      { x: -44, z: 10, yBase: 0, w: 1.0, h: 5.5, d: 12, mat: "concreteWall" },
      { x: -26, z: -10, yBase: 0, w: 1.0, h: 5.5, d: 10, mat: "concreteWall" },
      { x: -26, z: 10, yBase: 0, w: 1.0, h: 5.5, d: 10, mat: "concreteWall" },
      { x: -39, z: -16, yBase: 0, w: 9, h: 5.5, d: 1.0, mat: "concreteWall" },
      { x: -39, z: 16, yBase: 0, w: 9, h: 5.5, d: 1.0, mat: "concreteWall" },
      { x: -40.5, z: 0, yBase: 2.65, w: 6.0, h: 0.35, d: 18.0, mat: "metalDeck" },
      { x: -37.7, z: 0, yBase: 3.0, w: 0.35, h: 0.95, d: 14.0, mat: "hazardMetal" },
      { x: -32, z: -6, yBase: 0, w: 2.6, h: 1.5, d: 2.6, mat: "woodCrate" },
      { x: -32, z: 6, yBase: 0, w: 2.6, h: 1.5, d: 2.6, mat: "woodCrate" },

      // East Convoy & Fuel Depot
      { x: 35, z: -11, yBase: 0, w: 3.4, h: 3.2, d: 11, mat: "containerCharcoal" },
      { x: 35, z: 11, yBase: 0, w: 3.4, h: 3.2, d: 11, mat: "containerRed" },
      { x: 35, z: 11, yBase: 3.2, w: 3.4, h: 3.0, d: 11, mat: "containerCharcoal" },
      { x: 45, z: 0, yBase: 0, w: 3.0, h: 2.4, d: 8.0, mat: "containerOlive" },
      { x: 28, z: 0, yBase: 0, w: 2.2, h: 1.45, d: 4.0, mat: "hazardMetal" },
      { x: 42, z: -22, yBase: 0, w: 6.5, h: 3.0, d: 3.2, mat: "containerBlue" },
      { x: 42, z: 22, yBase: 0, w: 6.5, h: 3.0, d: 3.2, mat: "containerOlive" },

      // North & South Elevated Catwalks
      { x: 0, z: -33, yBase: 2.65, w: 18, h: 0.35, d: 5.0, mat: "metalDeck" },
      { x: 0, z: -35.3, yBase: 3.0, w: 16, h: 1.0, d: 0.4, mat: "hazardMetal" },
      { x: 0, z: -30.7, yBase: 3.0, w: 12, h: 0.9, d: 0.35, mat: "hazardMetal" },

      { x: 0, z: 33, yBase: 2.65, w: 18, h: 0.35, d: 5.0, mat: "metalDeck" },
      { x: 0, z: 35.3, yBase: 3.0, w: 16, h: 1.0, d: 0.4, mat: "hazardMetal" },
      { x: 0, z: 30.7, yBase: 3.0, w: 12, h: 0.9, d: 0.35, mat: "hazardMetal" },

      // Spawn-approach baffles & corner bunker walls
      { x: -22, z: -28, yBase: 0, w: 8, h: 3.0, d: 3.4, mat: "containerOlive" },
      { x: 22, z: -28, yBase: 0, w: 8, h: 3.0, d: 3.4, mat: "containerCharcoal" },
      { x: -22, z: 28, yBase: 0, w: 8, h: 3.0, d: 3.4, mat: "containerRed" },
      { x: 22, z: 28, yBase: 0, w: 8, h: 3.0, d: 3.4, mat: "containerBlue" },
      { x: -36, z: -36, yBase: 0, w: 3.2, h: 1.5, d: 5.5, mat: "bunkerWall" },
      { x: 36, z: 36, yBase: 0, w: 3.2, h: 1.5, d: 5.5, mat: "bunkerWall" },
      { x: 36, z: -36, yBase: 0, w: 3.2, h: 1.5, d: 5.5, mat: "bunkerWall" },
      { x: -36, z: 36, yBase: 0, w: 3.2, h: 1.5, d: 5.5, mat: "bunkerWall" }
    ],
    ramps: [
      { x: -13.5, z: 0, w: 7.0, d: 3.2, yStart: 0, yEnd: 3.0, axis: "x", dir: 1, mat: "metalDeck" },
      { x: 13.5, z: 0, w: 7.0, d: 3.2, yStart: 0, yEnd: 3.0, axis: "x", dir: -1, mat: "metalDeck" },
      { x: -40.5, z: -12.0, w: 3.2, d: 6.0, yStart: 0, yEnd: 3.0, axis: "z", dir: 1, mat: "metalDeck" },
      { x: -12.5, z: -33, w: 7.0, d: 3.0, yStart: 0, yEnd: 3.0, axis: "x", dir: 1, mat: "metalDeck" },
      { x: 12.5, z: -33, w: 7.0, d: 3.0, yStart: 0, yEnd: 3.0, axis: "x", dir: -1, mat: "metalDeck" },
      { x: -12.5, z: 33, w: 7.0, d: 3.0, yStart: 0, yEnd: 3.0, axis: "x", dir: 1, mat: "metalDeck" },
      { x: 12.5, z: 33, w: 7.0, d: 3.0, yStart: 0, yEnd: 3.0, axis: "x", dir: -1, mat: "metalDeck" }
    ],
    spawns: {
      blue: [
        { x: -44, y: 0, z: -45, yaw: -2.35 },
        { x: -22, y: 0, z: -46, yaw: -2.8 },
        { x: 0, y: 0, z: -46, yaw: 3.14 },
        { x: 22, y: 0, z: -46, yaw: 2.8 },
        { x: 44, y: 0, z: -45, yaw: 2.35 }
      ],
      red: [
        { x: -44, y: 0, z: 45, yaw: -0.78 },
        { x: -22, y: 0, z: 46, yaw: -0.3 },
        { x: 0, y: 0, z: 46, yaw: 0 },
        { x: 22, y: 0, z: 46, yaw: 0.3 },
        { x: 44, y: 0, z: 45, yaw: 0.78 }
      ],
      ffa: [
        { x: -45, y: 0, z: -45, yaw: -2.35 },
        { x: 45, y: 0, z: -45, yaw: 2.35 },
        { x: -45, y: 0, z: 45, yaw: -0.78 },
        { x: 45, y: 0, z: 45, yaw: 0.78 },
        { x: -48, y: 0, z: 0, yaw: -1.57 },
        { x: 49, y: 0, z: 0, yaw: 1.57 },
        { x: 0, y: 0, z: -46, yaw: 3.14 },
        { x: 0, y: 0, z: 46, yaw: 0 }
      ]
    },
    hardpoints: [
      { name: "CENTRAL BRIDGE", x: 0, y: 0, z: 0, radius: 6.2 },
      { name: "WEST WAREHOUSE", x: -34, y: 0, z: 0, radius: 6.0 },
      { name: "EAST CONVOY YARD", x: 34, y: 0, z: 0, radius: 6.0 },
      { name: "NORTH OVERPASS", x: 0, y: 0, z: -24, radius: 5.5 }
    ],
    supplyCrates: [
      { x: -29, y: 0, z: 0 },
      { x: 24, y: 0, z: 0 },
      { x: 0, y: 0, z: -24 },
      { x: 0, y: 0, z: 24 }
    ],
    lights: [
      { x: 0, y: 11, z: 0, color: 0xffd28a, intensity: 34, distance: 42 },
      { x: -35, y: 6.5, z: 0, color: 0xfef08a, intensity: 22, distance: 26 },
      { x: 35, y: 9.5, z: 0, color: 0xfdba74, intensity: 24, distance: 32 },
      { x: -24, y: 9, z: -32, color: 0x7dd3fc, intensity: 18, distance: 32 },
      { x: 24, y: 9, z: 32, color: 0xfca5a5, intensity: 18, distance: 32 }
    ]
  },

  blacksite: {
    id: "blacksite",
    name: "BLACKSITE COMPOUND // SECTOR 7",
    halfW: 70,
    halfD: 70,
    theme: {
      skyTop: 0x162436,
      skyHorizon: 0xd99b66,
      fogColor: 0x876f5c,
      fogDensity: 0.0058,
      sunColor: 0xffe0b2,
      sunIntensity: 2.65,
      sunPos: [52, 64, -38],
      hemiSky: 0xd8c3a5,
      hemiGround: 0x3b352e,
      hemiIntensity: 0.88,
      groundMat: "concreteDesert"
    },
    solids: [
      // Perimeter compound walls (140m x 140m)
      { x: 0, z: -70.5, yBase: 0, w: 142, h: 8.0, d: 1, mat: "concreteWall" },
      { x: 0, z: 70.5, yBase: 0, w: 142, h: 8.0, d: 1, mat: "concreteWall" },
      { x: -70.5, z: 0, yBase: 0, w: 1, h: 8.0, d: 142, mat: "concreteWall" },
      { x: 70.5, z: 0, yBase: 0, w: 1, h: 8.0, d: 142, mat: "concreteWall" },

      // Central 2-Story Command HQ (28m x 20m, open ground doorways + accessible roof deck y=3.6)
      { x: -8.8, z: -9.5, yBase: 0, w: 10.4, h: 3.2, d: 1.0, mat: "bunkerWall" },
      { x: 8.8, z: -9.5, yBase: 0, w: 10.4, h: 3.2, d: 1.0, mat: "bunkerWall" },
      { x: -8.8, z: 9.5, yBase: 0, w: 10.4, h: 3.2, d: 1.0, mat: "bunkerWall" },
      { x: 8.8, z: 9.5, yBase: 0, w: 10.4, h: 3.2, d: 1.0, mat: "bunkerWall" },
      { x: -13.5, z: -5.8, yBase: 0, w: 1.0, h: 3.2, d: 6.4, mat: "bunkerWall" },
      { x: -13.5, z: 5.8, yBase: 0, w: 1.0, h: 3.2, d: 6.4, mat: "bunkerWall" },
      { x: 13.5, z: -5.8, yBase: 0, w: 1.0, h: 3.2, d: 6.4, mat: "bunkerWall" },
      { x: 13.5, z: 5.8, yBase: 0, w: 1.0, h: 3.2, d: 6.4, mat: "bunkerWall" },
      { x: -5, z: 0, yBase: 0, w: 2.2, h: 3.2, d: 2.2, mat: "concreteWall" },
      { x: 5, z: 0, yBase: 0, w: 2.2, h: 3.2, d: 2.2, mat: "concreteWall" },
      { x: 0, z: -3.5, yBase: 0, w: 2.8, h: 1.35, d: 1.4, mat: "woodCrate" },

      // HQ Roof Deck & Parapet cover
      { x: 0, z: 0, yBase: 3.2, w: 28.0, h: 0.4, d: 20.0, mat: "metalDeck" },
      { x: 0, z: -9.7, yBase: 3.6, w: 26.0, h: 1.05, d: 0.45, mat: "bunkerWall" },
      { x: 0, z: 9.7, yBase: 3.6, w: 26.0, h: 1.05, d: 0.45, mat: "bunkerWall" },
      { x: -13.75, z: 4.2, yBase: 3.6, w: 0.45, h: 1.05, d: 10.6, mat: "bunkerWall" },
      { x: 13.75, z: -4.2, yBase: 3.6, w: 0.45, h: 1.05, d: 10.6, mat: "bunkerWall" },
      { x: 0, z: 0, yBase: 3.6, w: 4.0, h: 1.4, d: 2.0, mat: "hazardMetal" },

      // West Munitions Bunker Tunnel
      { x: -48, z: -8.0, yBase: 0, w: 16, h: 3.6, d: 1.0, mat: "bunkerWall" },
      { x: -48, z: 8.0, yBase: 0, w: 16, h: 3.6, d: 1.0, mat: "bunkerWall" },
      { x: -48, z: 0, yBase: 3.4, w: 16, h: 0.45, d: 17, mat: "concreteWall" },
      { x: -48, z: -3.5, yBase: 0, w: 3.0, h: 1.4, d: 2.0, mat: "woodCrate" },
      { x: -48, z: 3.5, yBase: 0, w: 3.0, h: 1.4, d: 2.0, mat: "woodCrate" },

      // NW & SW Twin Sniper Overwatch Towers (top walkable at y=3.6)
      { x: -46, z: -28, yBase: 0, w: 7.0, h: 3.2, d: 7.0, mat: "bunkerWall" },
      { x: -46, z: -28, yBase: 3.2, w: 7.6, h: 0.4, d: 7.6, mat: "metalDeck" },
      { x: -42.4, z: -28, yBase: 3.6, w: 0.4, h: 1.0, d: 7.0, mat: "hazardMetal" },

      { x: -46, z: 28, yBase: 0, w: 7.0, h: 3.2, d: 7.0, mat: "bunkerWall" },
      { x: -46, z: 28, yBase: 3.2, w: 7.6, h: 0.4, d: 7.6, mat: "metalDeck" },
      { x: -42.4, z: 28, yBase: 3.6, w: 0.4, h: 1.0, d: 7.0, mat: "hazardMetal" },

      // West-Mid Lane Cover
      { x: -29, z: -16, yBase: 0, w: 3.4, h: 3.0, d: 10.0, mat: "containerBlue" },
      { x: -29, z: 16, yBase: 0, w: 3.4, h: 3.0, d: 10.0, mat: "containerOlive" },
      { x: -34, z: 0, yBase: 0, w: 2.2, h: 1.5, d: 5.5, mat: "bunkerWall" },

      // East Helipad & Fuel / Comms Compound (Helipad center at x=46, z=0)
      { x: 46, z: -18, yBase: 0, w: 5.0, h: 4.4, d: 5.0, mat: "containerCharcoal" },
      { x: 46, z: 18, yBase: 0, w: 5.0, h: 4.4, d: 5.0, mat: "containerOlive" },
      { x: 59, z: 0, yBase: 0, w: 3.6, h: 3.4, d: 14.0, mat: "containerRed" },
      { x: 59, z: 0, yBase: 3.4, w: 3.6, h: 3.0, d: 9.0, mat: "containerCharcoal" },
      { x: 31, z: -10, yBase: 0, w: 1.6, h: 1.6, d: 7.5, mat: "bunkerWall" },
      { x: 31, z: 10, yBase: 0, w: 1.6, h: 1.6, d: 7.5, mat: "bunkerWall" },
      { x: 44, z: -34, yBase: 0, w: 9.0, h: 3.2, d: 3.6, mat: "containerBlue" },
      { x: 44, z: 34, yBase: 0, w: 9.0, h: 3.2, d: 3.6, mat: "containerRed" },

      // North & South Bastions + Spawn Approach Bunkers
      { x: 0, z: -36, yBase: 0, w: 11.0, h: 3.0, d: 3.4, mat: "containerOlive" },
      { x: 0, z: 36, yBase: 0, w: 11.0, h: 3.0, d: 3.4, mat: "containerBlue" },
      { x: -18, z: -30, yBase: 0, w: 8.0, h: 1.55, d: 1.6, mat: "bunkerWall" },
      { x: 18, z: -30, yBase: 0, w: 8.0, h: 1.55, d: 1.6, mat: "bunkerWall" },
      { x: -18, z: 30, yBase: 0, w: 8.0, h: 1.55, d: 1.6, mat: "bunkerWall" },
      { x: 18, z: 30, yBase: 0, w: 8.0, h: 1.55, d: 1.6, mat: "bunkerWall" },
      { x: -22, z: -50, yBase: 0, w: 9.0, h: 3.2, d: 3.4, mat: "containerCharcoal" },
      { x: 22, z: -50, yBase: 0, w: 9.0, h: 3.2, d: 3.4, mat: "containerRed" },
      { x: -22, z: 50, yBase: 0, w: 9.0, h: 3.2, d: 3.4, mat: "containerOlive" },
      { x: 22, z: 50, yBase: 0, w: 9.0, h: 3.2, d: 3.4, mat: "containerBlue" }
    ],
    ramps: [
      { x: -17.5, z: -4.5, w: 7.0, d: 3.2, yStart: 0, yEnd: 3.6, axis: "x", dir: 1, mat: "metalDeck" },
      { x: 17.5, z: 4.5, w: 7.0, d: 3.2, yStart: 0, yEnd: 3.6, axis: "x", dir: -1, mat: "metalDeck" },
      { x: -46.0, z: -20.5, w: 3.2, d: 7.4, yStart: 0, yEnd: 3.6, axis: "z", dir: -1, mat: "metalDeck" },
      { x: -46.0, z: 20.5, w: 3.2, d: 7.4, yStart: 0, yEnd: 3.6, axis: "z", dir: 1, mat: "metalDeck" }
    ],
    spawns: {
      blue: [
        { x: -56, y: 0, z: -60, yaw: -2.4 },
        { x: -28, y: 0, z: -62, yaw: -2.8 },
        { x: 0, y: 0, z: -62, yaw: 3.14 },
        { x: 28, y: 0, z: -62, yaw: 2.8 },
        { x: 56, y: 0, z: -60, yaw: 2.4 }
      ],
      red: [
        { x: -56, y: 0, z: 60, yaw: -0.7 },
        { x: -28, y: 0, z: 62, yaw: -0.3 },
        { x: 0, y: 0, z: 62, yaw: 0 },
        { x: 28, y: 0, z: 62, yaw: 0.3 },
        { x: 56, y: 0, z: 60, yaw: 0.7 }
      ],
      ffa: [
        { x: -58, y: 0, z: -58, yaw: -2.35 },
        { x: 58, y: 0, z: -58, yaw: 2.35 },
        { x: -58, y: 0, z: 58, yaw: -0.78 },
        { x: 58, y: 0, z: 58, yaw: 0.78 },
        { x: -63, y: 0, z: 0, yaw: -1.57 },
        { x: 65, y: 0, z: 0, yaw: 1.57 },
        { x: 0, y: 0, z: -62, yaw: 3.14 },
        { x: 0, y: 0, z: 62, yaw: 0 }
      ]
    },
    hardpoints: [
      { name: "COMMAND HQ", x: 0, y: 0, z: 0, radius: 6.5 },
      { name: "EAST HELIPAD", x: 46, y: 0, z: 0, radius: 6.2 },
      { name: "WEST MUNITIONS DEPOT", x: -48, y: 0, z: 0, radius: 6.2 },
      { name: "NORTH BASTION", x: 0, y: 0, z: -24, radius: 5.8 }
    ],
    supplyCrates: [
      { x: 0, y: 0, z: 4.5 },
      { x: 46, y: 0, z: 8.0 },
      { x: -48, y: 0, z: 0 },
      { x: 0, y: 0, z: -28 }
    ],
    lights: [
      { x: 0, y: 2.9, z: 0, color: 0xfef08a, intensity: 20, distance: 24 },
      { x: 46, y: 11, z: 0, color: 0xffedd5, intensity: 30, distance: 38 },
      { x: -48, y: 3.1, z: 0, color: 0xfde047, intensity: 18, distance: 22 }
    ]
  }
};
