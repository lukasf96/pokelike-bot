/**
 * Mirrors pokelike-source-files/data.js MOVE_POOL + getBestMove tier logic.
 */

export interface MoveEntry {
  name: string;
  power: number;
}

export interface MoveTierPool {
  physical: [MoveEntry, MoveEntry, MoveEntry];
  special: [MoveEntry, MoveEntry, MoveEntry];
}

export type MovePoolKey =
  | "Normal"
  | "Fire"
  | "Water"
  | "Electric"
  | "Grass"
  | "Ice"
  | "Fighting"
  | "Poison"
  | "Ground"
  | "Flying"
  | "Psychic"
  | "Bug"
  | "Rock"
  | "Ghost"
  | "Dragon"
  | "Dark"
  | "Steel";

export const MOVE_POOL: Record<MovePoolKey, MoveTierPool> = {
  Normal: {
    physical: [
      { name: "Tackle", power: 40 },
      { name: "Body Slam", power: 85 },
      { name: "Giga Impact", power: 150 },
    ],
    special: [
      { name: "Swift", power: 60 },
      { name: "Hyper Voice", power: 90 },
      { name: "Boomburst", power: 140 },
    ],
  },
  Fire: {
    physical: [
      { name: "Ember", power: 60 },
      { name: "Fire Punch", power: 75 },
      { name: "Flare Blitz", power: 120 },
    ],
    special: [
      { name: "Incinerate", power: 60 },
      { name: "Flamethrower", power: 90 },
      { name: "Fire Blast", power: 110 },
    ],
  },
  Water: {
    physical: [
      { name: "Water Gun", power: 50 },
      { name: "Waterfall", power: 80 },
      { name: "Aqua Tail", power: 110 },
    ],
    special: [
      { name: "Bubble", power: 50 },
      { name: "Surf", power: 80 },
      { name: "Hydro Pump", power: 110 },
    ],
  },
  Electric: {
    physical: [
      { name: "Spark", power: 40 },
      { name: "Thunder Punch", power: 75 },
      { name: "Bolt Strike", power: 130 },
    ],
    special: [
      { name: "Thunder Shock", power: 40 },
      { name: "Thunderbolt", power: 90 },
      { name: "Thunder", power: 110 },
    ],
  },
  Grass: {
    physical: [
      { name: "Vine Whip", power: 40 },
      { name: "Razor Leaf", power: 65 },
      { name: "Power Whip", power: 120 },
    ],
    special: [
      { name: "Magical Leaf", power: 40 },
      { name: "Energy Ball", power: 90 },
      { name: "Solar Beam", power: 120 },
    ],
  },
  Ice: {
    physical: [
      { name: "Powder Snow", power: 40 },
      { name: "Ice Punch", power: 75 },
      { name: "Icicle Crash", power: 110 },
    ],
    special: [
      { name: "Icy Wind", power: 40 },
      { name: "Ice Beam", power: 90 },
      { name: "Blizzard", power: 110 },
    ],
  },
  Fighting: {
    physical: [
      { name: "Karate Chop", power: 50 },
      { name: "Cross Chop", power: 100 },
      { name: "Close Combat", power: 120 },
    ],
    special: [
      { name: "Force Palm", power: 60 },
      { name: "Aura Sphere", power: 80 },
      { name: "Focus Blast", power: 120 },
    ],
  },
  Poison: {
    physical: [
      { name: "Poison Sting", power: 40 },
      { name: "Poison Jab", power: 80 },
      { name: "Gunk Shot", power: 120 },
    ],
    special: [
      { name: "Acid", power: 40 },
      { name: "Sludge Bomb", power: 90 },
      { name: "Acid Spray", power: 110 },
    ],
  },
  Ground: {
    physical: [
      { name: "Mud Shot", power: 55 },
      { name: "Earthquake", power: 100 },
      { name: "Precipice Blades", power: 120 },
    ],
    special: [
      { name: "Bulldoze", power: 60 },
      { name: "Earth Power", power: 90 },
      { name: "Land's Wrath", power: 110 },
    ],
  },
  Flying: {
    physical: [
      { name: "Peck", power: 35 },
      { name: "Aerial Ace", power: 60 },
      { name: "Sky Attack", power: 140 },
    ],
    special: [
      { name: "Gust", power: 40 },
      { name: "Air Slash", power: 75 },
      { name: "Hurricane", power: 110 },
    ],
  },
  Psychic: {
    physical: [
      { name: "Confusion", power: 50 },
      { name: "Zen Headbutt", power: 80 },
      { name: "Psycho Boost", power: 140 },
    ],
    special: [
      { name: "Psybeam", power: 65 },
      { name: "Psychic", power: 90 },
      { name: "Psystrike", power: 100 },
    ],
  },
  Bug: {
    physical: [
      { name: "Bug Bite", power: 60 },
      { name: "X-Scissor", power: 80 },
      { name: "Megahorn", power: 120 },
    ],
    special: [
      { name: "Struggle Bug", power: 50 },
      { name: "Bug Buzz", power: 90 },
      { name: "Pollen Puff", power: 110 },
    ],
  },
  Rock: {
    physical: [
      { name: "Rock Throw", power: 50 },
      { name: "Rock Slide", power: 75 },
      { name: "Stone Edge", power: 100 },
    ],
    special: [
      { name: "Smack Down", power: 50 },
      { name: "Power Gem", power: 80 },
      { name: "Rock Wrecker", power: 150 },
    ],
  },
  Ghost: {
    physical: [
      { name: "Astonish", power: 40 },
      { name: "Shadow Claw", power: 70 },
      { name: "Phantom Force", power: 90 },
    ],
    special: [
      { name: "Lick", power: 40 },
      { name: "Shadow Ball", power: 80 },
      { name: "Shadow Force", power: 120 },
    ],
  },
  Dragon: {
    physical: [
      { name: "Twister", power: 40 },
      { name: "Dragon Claw", power: 80 },
      { name: "Outrage", power: 120 },
    ],
    special: [
      { name: "Dragon Breath", power: 60 },
      { name: "Dragon Pulse", power: 85 },
      { name: "Draco Meteor", power: 130 },
    ],
  },
  Dark: {
    physical: [
      { name: "Bite", power: 60 },
      { name: "Crunch", power: 80 },
      { name: "Knock Off", power: 120 },
    ],
    special: [
      { name: "Snarl", power: 55 },
      { name: "Dark Pulse", power: 80 },
      { name: "Night Daze", power: 110 },
    ],
  },
  Steel: {
    physical: [
      { name: "Metal Claw", power: 50 },
      { name: "Iron Tail", power: 100 },
      { name: "Heavy Slam", power: 130 },
    ],
    special: [
      { name: "Steel Wing", power: 60 },
      { name: "Flash Cannon", power: 90 },
      { name: "Doom Desire", power: 140 },
    ],
  },
};
