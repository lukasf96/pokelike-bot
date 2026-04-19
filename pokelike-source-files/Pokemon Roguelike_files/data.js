// data.js - Pokemon data, gym leaders, items, type chart

const TYPE_CHART = {
  //          Defending type →
  Normal:   { Normal:1,   Fire:1,   Water:1,   Electric:1,   Grass:1,   Ice:1,   Fighting:1,   Poison:1,   Ground:1, Flying:1,   Psychic:1,   Bug:1,   Rock:0.5, Ghost:0,   Dragon:1,   Dark:1,   Steel:0.5 },
  Fire:     { Normal:1,   Fire:0.5, Water:0.5, Electric:1,   Grass:2,   Ice:2,   Fighting:1,   Poison:1,   Ground:1, Flying:1,   Psychic:1,   Bug:2,   Rock:0.5, Ghost:1,   Dragon:0.5, Dark:1,   Steel:2   },
  Water:    { Normal:1,   Fire:2,   Water:0.5, Electric:1,   Grass:0.5, Ice:1,   Fighting:1,   Poison:1,   Ground:2, Flying:1,   Psychic:1,   Bug:1,   Rock:2,   Ghost:1,   Dragon:0.5, Dark:1,   Steel:1   },
  Electric: { Normal:1,   Fire:1,   Water:2,   Electric:0.5, Grass:0.5, Ice:1,   Fighting:1,   Poison:1,   Ground:0, Flying:2,   Psychic:1,   Bug:1,   Rock:1,   Ghost:1,   Dragon:0.5, Dark:1,   Steel:1   },
  Grass:    { Normal:1,   Fire:0.5, Water:2,   Electric:1,   Grass:0.5, Ice:1,   Fighting:1,   Poison:0.5, Ground:2, Flying:0.5, Psychic:1,   Bug:0.5, Rock:2,   Ghost:1,   Dragon:0.5, Dark:1,   Steel:0.5 },
  Ice:      { Normal:1,   Fire:0.5, Water:0.5, Electric:1,   Grass:2,   Ice:0.5, Fighting:1,   Poison:1,   Ground:2, Flying:2,   Psychic:1,   Bug:1,   Rock:1,   Ghost:1,   Dragon:2,   Dark:1,   Steel:0.5 },
  Fighting: { Normal:2,   Fire:1,   Water:1,   Electric:1,   Grass:1,   Ice:2,   Fighting:1,   Poison:0.5, Ground:1, Flying:0.5, Psychic:0.5, Bug:0.5, Rock:2,   Ghost:0,   Dragon:1,   Dark:2,   Steel:2   },
  Poison:   { Normal:1,   Fire:1,   Water:1,   Electric:1,   Grass:2,   Ice:1,   Fighting:1,   Poison:0.5, Ground:0.5, Flying:1, Psychic:1,   Bug:1,   Rock:0.5, Ghost:0.5, Dragon:1,   Dark:1,   Steel:0   },
  Ground:   { Normal:1,   Fire:2,   Water:1,   Electric:2,   Grass:0.5, Ice:1,   Fighting:1,   Poison:2,   Ground:1, Flying:0,   Psychic:1,   Bug:0.5, Rock:2,   Ghost:1,   Dragon:1,   Dark:1,   Steel:2   },
  Flying:   { Normal:1,   Fire:1,   Water:1,   Electric:0.5, Grass:2,   Ice:1,   Fighting:2,   Poison:1,   Ground:1, Flying:1,   Psychic:1,   Bug:2,   Rock:0.5, Ghost:1,   Dragon:1,   Dark:1,   Steel:0.5 },
  Psychic:  { Normal:1,   Fire:1,   Water:1,   Electric:1,   Grass:1,   Ice:1,   Fighting:2,   Poison:2,   Ground:1, Flying:1,   Psychic:0.5, Bug:1,   Rock:1,   Ghost:1,   Dragon:1,   Dark:0,   Steel:0.5 },
  Bug:      { Normal:1,   Fire:0.5, Water:1,   Electric:1,   Grass:2,   Ice:1,   Fighting:0.5, Poison:0.5, Ground:1, Flying:0.5, Psychic:2,   Bug:1,   Rock:1,   Ghost:0.5, Dragon:1,   Dark:2,   Steel:0.5 },
  Rock:     { Normal:1,   Fire:2,   Water:1,   Electric:1,   Grass:1,   Ice:2,   Fighting:0.5, Poison:1,   Ground:0.5, Flying:2, Psychic:1,   Bug:2,   Rock:1,   Ghost:1,   Dragon:1,   Dark:1,   Steel:0.5 },
  Ghost:    { Normal:0,   Fire:1,   Water:1,   Electric:1,   Grass:1,   Ice:1,   Fighting:0,   Poison:1,   Ground:1, Flying:1,   Psychic:2,   Bug:1,   Rock:1,   Ghost:2,   Dragon:1,   Dark:0.5, Steel:0.5 },
  Dragon:   { Normal:1,   Fire:1,   Water:1,   Electric:1,   Grass:1,   Ice:1,   Fighting:1,   Poison:1,   Ground:1, Flying:1,   Psychic:1,   Bug:1,   Rock:1,   Ghost:1,   Dragon:2,   Dark:1,   Steel:0.5 },
  Dark:     { Normal:1,   Fire:1,   Water:1,   Electric:1,   Grass:1,   Ice:1,   Fighting:0.5, Poison:1,   Ground:1, Flying:1,   Psychic:2,   Bug:1,   Rock:1,   Ghost:2,   Dragon:1,   Dark:0.5, Steel:0.5 },
  Steel:    { Normal:1,   Fire:0.5, Water:0.5, Electric:0.5, Grass:1,   Ice:2,   Fighting:1,   Poison:1,   Ground:1, Flying:1,   Psychic:1,   Bug:1,   Rock:2,   Ghost:1,   Dragon:1,   Dark:1,   Steel:0.5 },
};

function getTypeEffectiveness(attackType, defenderTypes) {
  let mult = 1;
  for (const dt of defenderTypes) {
    const cap = dt.charAt(0).toUpperCase() + dt.slice(1).toLowerCase();
    const atCap = attackType.charAt(0).toUpperCase() + attackType.slice(1).toLowerCase();
    if (TYPE_CHART[atCap] && TYPE_CHART[atCap][cap] !== undefined) {
      mult *= TYPE_CHART[atCap][cap];
    }
  }
  return mult;
}

// PokeAPI type ID map for type icon sprites
const TYPE_IDS = {
  Normal:1, Fighting:2, Flying:3, Poison:4, Ground:5, Rock:6, Bug:7, Ghost:8, Steel:9,
  Fire:10, Water:11, Grass:12, Electric:13, Psychic:14, Ice:15, Dragon:16, Dark:17,
};

// Move pools by type — each has physical/special arrays of [tier0, tier1, tier2]
// Tier 0: weak early moves (~35–60 power), Tier 1: standard moves (~65–100), Tier 2: powerful moves (~100–150)
const MOVE_POOL = {
  Normal:   { physical: [{name:'Tackle',           power:40,  desc:'Charges the foe with a full-body tackle.'},
                         {name:'Body Slam',         power:85,  desc:'Slams the foe with the full weight of the body.'},
                         {name:'Giga Impact',       power:150, desc:'Charges the foe using every bit of its power.'}],
              special:  [{name:'Swift',             power:60,  desc:'Star-shaped rays that never miss the target.'},
                         {name:'Hyper Voice',       power:90,  desc:'Emits a piercing cry to strike the foe.'},
                         {name:'Boomburst',         power:140, desc:'Attacks everything with a destructive sound wave.'}] },
  Fire:     { physical: [{name:'Ember',             power:60,  desc:'A small flame scorches the foe.'},
                         {name:'Fire Punch',        power:75,  desc:'An incandescent punch that sears the foe.'},
                         {name:'Flare Blitz',       power:120, desc:'A full-force charge cloaked in searing flames.'}],
              special:  [{name:'Incinerate',        power:60,  desc:'Scorches the foe with an intense burst of fire.'},
                         {name:'Flamethrower',      power:90,  desc:'A scorching stream of fire engulfs the foe.'},
                         {name:'Fire Blast',        power:110, desc:'A fiery blast that scorches everything in its path.'}] },
  Water:    { physical: [{name:'Water Gun',         power:50,  desc:'Squirts water to attack the foe.'},
                         {name:'Waterfall',         power:80,  desc:'Charges the foe with tremendous force.'},
                         {name:'Aqua Tail',         power:110, desc:'Attacks by swinging its tail as if it were a wave.'}],
              special:  [{name:'Bubble',            power:50,  desc:'Fires a barrage of bubbles at the foe.'},
                         {name:'Surf',              power:80,  desc:'A giant wave crashes over the foe.'},
                         {name:'Hydro Pump',        power:110, desc:'Blasts the foe with a high-powered blast of water.'}] },
  Electric: { physical: [{name:'Spark',             power:40,  desc:'An electrified tackle that crackles with voltage.'},
                         {name:'Thunder Punch',     power:75,  desc:'An electrified punch that crackles with voltage.'},
                         {name:'Bolt Strike',       power:130, desc:'The user strikes the foe with a massive jolt of electricity.'}],
              special:  [{name:'Thunder Shock',     power:40,  desc:'A jolt of electricity zaps the foe.'},
                         {name:'Thunderbolt',       power:90,  desc:'A strong bolt of lightning strikes the foe.'},
                         {name:'Thunder',           power:110, desc:'A wicked thunderbolt is dropped on the foe.'}] },
  Grass:    { physical: [{name:'Vine Whip',         power:40,  desc:'Strikes the foe with slender, whiplike vines.'},
                         {name:'Razor Leaf',        power:65,  desc:'Sharp-edged leaves slice the foe to ribbons.'},
                         {name:'Power Whip',        power:120, desc:'The user violently whirls its vines to strike the foe.'}],
              special:  [{name:'Magical Leaf',      power:40,  desc:'A strange, mystical leaf that always hits the foe.'},
                         {name:'Energy Ball',       power:90,  desc:'Draws power from nature and fires it at the foe.'},
                         {name:'Solar Beam',        power:120, desc:'A full-power blast of concentrated solar energy.'}] },
  Ice:      { physical: [{name:'Powder Snow',       power:40,  desc:'Blows a chilling gust of powdery snow at the foe.'},
                         {name:'Ice Punch',         power:75,  desc:'An ice-cold punch that may freeze the foe.'},
                         {name:'Icicle Crash',      power:110, desc:'Large icicles crash down on the foe.'}],
              special:  [{name:'Icy Wind',          power:40,  desc:'A chilling attack that also lowers the foe\'s Speed.'},
                         {name:'Ice Beam',          power:90,  desc:'A frigid ray of ice that may freeze the foe.'},
                         {name:'Blizzard',          power:110, desc:'Summons a howling blizzard to strike the foe.'}] },
  Fighting: { physical: [{name:'Karate Chop',       power:50,  desc:'A precise chopping strike to the foe.'},
                         {name:'Cross Chop',        power:100, desc:'Delivers a double chop with crossed forearms.'},
                         {name:'Close Combat',      power:120, desc:'An all-out brawl unleashing maximum power.'}],
              special:  [{name:'Force Palm',        power:60,  desc:'Fires a shock wave from the user\'s palm.'},
                         {name:'Aura Sphere',       power:80,  desc:'Focuses aura energy into a perfect, unavoidable sphere.'},
                         {name:'Focus Blast',       power:120, desc:'Hurls a concentrated blast of energy at the foe.'}] },
  Poison:   { physical: [{name:'Poison Sting',      power:40,  desc:'Stabs the foe with a venomous stinger.'},
                         {name:'Poison Jab',        power:80,  desc:'Stabs the foe with a toxic spike.'},
                         {name:'Gunk Shot',         power:120, desc:'Hurls garbage at the foe to inflict damage.'}],
              special:  [{name:'Acid',              power:40,  desc:'Sprays the foe with a toxic acid liquid.'},
                         {name:'Sludge Bomb',       power:90,  desc:'Hurls unsanitary sludge at the foe.'},
                         {name:'Acid Spray',        power:110, desc:'Spits fluid that corrodes and eats away at the foe.'}] },
  Ground:   { physical: [{name:'Mud Shot',           power:55,  desc:'Hurls a blob of mud at the foe.'},
                         {name:'Earthquake',        power:100, desc:'A massive quake shakes everything around.'},
                         {name:'Precipice Blades',  power:120, desc:'Controls the power of nature to attack with sharp blades.'}],
              special:  [{name:'Bulldoze',          power:60,  desc:'Stomps down on the ground and attacks everything nearby.'},
                         {name:'Earth Power',       power:90,  desc:'The earth erupts with force from directly below.'},
                         {name:'Land\'s Wrath',     power:110, desc:'Gathers the energy of the land and uses it to attack.'}] },
  Flying:   { physical: [{name:'Peck',              power:35,  desc:'Jabs the foe with a sharply pointed beak.'},
                         {name:'Aerial Ace',        power:60,  desc:'An extremely fast attack that never misses.'},
                         {name:'Sky Attack',        power:140, desc:'A swooping high-speed attack from above.'}],
              special:  [{name:'Gust',              power:40,  desc:'Strikes the foe with a gust of wind.'},
                         {name:'Air Slash',         power:75,  desc:'Slashes with a blade of pressurized air.'},
                         {name:'Hurricane',         power:110, desc:'Whips up a hurricane to slam the foe.'}] },
  Psychic:  { physical: [{name:'Confusion',         power:50,  desc:'A telekinetic attack that may cause confusion.'},
                         {name:'Zen Headbutt',      power:80,  desc:'Focuses willpower and charges headfirst.'},
                         {name:'Psycho Boost',      power:140, desc:'Attacks the foe at full power. Sharply lowers the user\'s Sp. Atk.'}],
              special:  [{name:'Psybeam',           power:65,  desc:'Fires a peculiar ray that may leave the foe confused.'},
                         {name:'Psychic',           power:90,  desc:'A powerful psychic force attacks the foe\'s mind.'},
                         {name:'Psystrike',         power:100, desc:'Materializes a peculiar psychic wave to attack the foe\'s physical bulk.'}] },
  Bug:      { physical: [{name:'Bug Bite',          power:60,  desc:'Bites the foe with powerful mandibles.'},
                         {name:'X-Scissor',         power:80,  desc:'Slashes the foe with crossed, scissor-like claws.'},
                         {name:'Megahorn',          power:120, desc:'Using its tough and impressive horn, the user rams the foe.'}],
              special:  [{name:'Struggle Bug',      power:50,  desc:'The user struggles against the foe with bug energy.'},
                         {name:'Bug Buzz',          power:90,  desc:'Vibrates wings to generate a damaging buzz.'},
                         {name:'Pollen Puff',       power:110, desc:'Attacks the foe with an explosive pollen bomb.'}] },
  Rock:     { physical: [{name:'Rock Throw',        power:50,  desc:'Picks up and throws a small rock at the foe.'},
                         {name:'Rock Slide',        power:75,  desc:'Large boulders are hurled at the foe.'},
                         {name:'Stone Edge',        power:100, desc:'Stabs the foe with a sharpened stone.'}],
              special:  [{name:'Smack Down',        power:50,  desc:'The user throws a stone to knock the foe down.'},
                         {name:'Power Gem',         power:80,  desc:'Attacks with rays of light generated by gems.'},
                         {name:'Rock Wrecker',      power:150, desc:'Hurls a large boulder at the foe with enormous force.'}] },
  Ghost:    { physical: [{name:'Astonish',          power:40,  desc:'Attacks by astonishing the foe to make it flinch.'},
                         {name:'Shadow Claw',       power:70,  desc:'Slashes with a wicked claw made of shadows.'},
                         {name:'Phantom Force',     power:90,  desc:'Vanishes, then strikes the foe on the next turn.'}],
              special:  [{name:'Lick',              power:40,  desc:'Licks the foe with a long tongue to inflict damage.'},
                         {name:'Shadow Ball',       power:80,  desc:'Hurls a blob of dark energy at the foe.'},
                         {name:'Shadow Force',      power:120, desc:'Disappears, then strikes everything on the next turn.'}] },
  Dragon:   { physical: [{name:'Twister',           power:40,  desc:'Whips up a powerful twister of draconic energy.'},
                         {name:'Dragon Claw',       power:80,  desc:'Slashes the foe with razor-sharp dragon claws.'},
                         {name:'Outrage',           power:120, desc:'Rampages and attacks the foe with intense dragon fury.'}],
              special:  [{name:'Dragon Breath',     power:60,  desc:'Exhales a scorching gust of dragon energy.'},
                         {name:'Dragon Pulse',      power:85,  desc:'Fires a shockwave of draconic energy.'},
                         {name:'Draco Meteor',      power:130, desc:'Comets are rained down on the foe. Sharply lowers the user\'s Sp. Atk.'}] },
  Dark:     { physical: [{name:'Bite',              power:60,  desc:'Bites the foe with viciously sharp fangs.'},
                         {name:'Crunch',            power:80,  desc:'Crunches with sharp fangs. May lower the foe\'s Defense.'},
                         {name:'Knock Off',         power:120, desc:'Knocks down the foe\'s held item to boost damage.'}],
              special:  [{name:'Snarl',             power:55,  desc:'Yells and snarls at the foe to lower its Sp. Atk.'},
                         {name:'Dark Pulse',        power:80,  desc:'Fires a horrible aura of dark energy at the foe.'},
                         {name:'Night Daze',        power:110, desc:'Lets loose a pitch-black shockwave of dark energy.'}] },
  Steel:    { physical: [{name:'Metal Claw',        power:50,  desc:'Attacks with steel-hard claws. May raise the user\'s Attack.'},
                         {name:'Iron Tail',         power:100, desc:'Slams the foe with a hard-as-steel tail.'},
                         {name:'Heavy Slam',        power:130, desc:'Slams into the foe with its heavy body.'}],
              special:  [{name:'Steel Wing',        power:60,  desc:'Strikes the foe with hard, steel-edged wings.'},
                         {name:'Flash Cannon',      power:90,  desc:'Fires a flash of steel-type energy at the foe.'},
                         {name:'Doom Desire',       power:140, desc:'Stores power for two turns, then fires a concentrated bundle of light.'}] },
};

function getMoveТierForMap(mapIndex) {
  return mapIndex <= 2 ? 0 : 1;
}

function getBestMove(types, baseStats, speciesId, moveTier = 1) {
  if (speciesId === 129) return { name: 'Splash',   power: 0, type: 'Normal', isSpecial: false, noDamage: true };
  if (speciesId === 63)  return { name: 'Teleport', power: 0, type: 'Normal', isSpecial: false, noDamage: true };
  const isSpecial = (baseStats?.special || 0) >= (baseStats?.atk || 0);
  const tier = Math.max(0, Math.min(2, moveTier ?? 1));
  if ([74, 75, 76, 95].includes(speciesId)) {
    const move = MOVE_POOL['Rock'][isSpecial ? 'special' : 'physical'][tier];
    return { ...move, type: 'Rock', isSpecial };
  }
  for (const t of types) {
    // Skip Normal if the Pokémon also has a more specific type (e.g. Normal/Flying → use Flying)
    if (t.toLowerCase() === 'normal' && types.length > 1) continue;
    const cap = t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
    if (MOVE_POOL[cap]) {
      const move = isSpecial ? MOVE_POOL[cap].special[tier] : MOVE_POOL[cap].physical[tier];
      return { ...move, type: cap, isSpecial };
    }
  }
  return { name: 'Tackle', power: 40, type: 'Normal', isSpecial: false };
}

// Gym leader teams (hardcoded)
const GYM_LEADERS = [
  {
    name: 'Brock', badge: 'Boulder Badge', type: 'Rock', moveTier: 0,
    team: [
      { speciesId: 74, name: 'Geodude', types: ['Rock','Ground'], baseStats: { hp:40,atk:80,def:100,speed:20,special:30 }, level: 12 },
      { speciesId: 95, name: 'Onix',    types: ['Rock','Ground'], baseStats: { hp:35,atk:45,def:160,speed:70,special:30 }, level: 14 },
    ]
  },
  {
    name: 'Misty', badge: 'Cascade Badge', type: 'Water', moveTier: 0,
    team: [
      { speciesId: 120, name: 'Staryu',  types: ['Water'], baseStats: { hp:30,atk:45,def:55,speed:85,special:70 }, level: 18 },
      { speciesId: 121, name: 'Starmie', types: ['Water','Psychic'], baseStats: { hp:60,atk:75,def:85,speed:115,special:100 }, level: 20 },
    ]
  },
  {
    name: 'Lt. Surge', badge: 'Thunder Badge', type: 'Electric', moveTier: 1,
    team: [
      { speciesId: 25,  name: 'Pikachu',  types: ['Electric'], baseStats: { hp:35,atk:55,def:40,speed:90,special:50 },  level: 20, heldItem: { id: 'eviolite', name: 'Eviolite', icon: '💎' } },
      { speciesId: 100, name: 'Voltorb',  types: ['Electric'], baseStats: { hp:40,atk:30,def:50,speed:100,special:55 }, level: 23, heldItem: { id: 'magnet',   name: 'Magnet',   icon: '🧲' } },
      { speciesId: 26,  name: 'Raichu',   types: ['Electric'], baseStats: { hp:60,atk:90,def:55,speed:110,special:90 }, level: 26, heldItem: { id: 'life_orb', name: 'Life Orb', icon: '🔮' } },
    ]
  },
  {
    name: 'Erika', badge: 'Rainbow Badge', type: 'Grass', moveTier: 1,
    team: [
      { speciesId: 114, name: 'Tangela',     types: ['Grass'], baseStats: { hp:65,atk:55,def:115,speed:60,special:100 }, level: 26, heldItem: { id: 'leftovers',     name: 'Leftovers',    icon: '🍃' } },
      { speciesId: 71,  name: 'Victreebel',  types: ['Grass','Poison'], baseStats: { hp:80,atk:105,def:65,speed:70,special:100 }, level: 31, heldItem: { id: 'poison_barb',   name: 'Poison Barb',  icon: '☠️' } },
      { speciesId: 45,  name: 'Vileplume',   types: ['Grass','Poison'], baseStats: { hp:75,atk:80,def:85,speed:50,special:110 }, level: 32, heldItem: { id: 'miracle_seed',  name: 'Miracle Seed', icon: '🌱' } },
    ]
  },
  {
    name: 'Koga', badge: 'Soul Badge', type: 'Poison', moveTier: 1,
    team: [
      { speciesId: 109, name: 'Koffing',  types: ['Poison'], baseStats: { hp:40,atk:65,def:95,speed:35,special:60 },  level: 38, heldItem: { id: 'rocky_helmet', name: 'Rocky Helmet', icon: '⛑️' } },
      { speciesId: 109, name: 'Koffing',  types: ['Poison'], baseStats: { hp:40,atk:65,def:95,speed:35,special:60 },  level: 38, heldItem: { id: 'rocky_helmet', name: 'Rocky Helmet', icon: '⛑️' } },
      { speciesId: 89,  name: 'Muk',      types: ['Poison'], baseStats: { hp:105,atk:105,def:75,speed:50,special:65 }, level: 40, heldItem: { id: 'poison_barb',  name: 'Poison Barb',  icon: '☠️' } },
      { speciesId: 110, name: 'Weezing',  types: ['Poison'], baseStats: { hp:65,atk:90,def:120,speed:60,special:85 },  level: 44, heldItem: { id: 'leftovers',    name: 'Leftovers',    icon: '🍃' } },
    ]
  },
  {
    name: 'Sabrina', badge: 'Marsh Badge', type: 'Psychic', moveTier: 1,
    team: [
      { speciesId: 122, name: 'Mr. Mime', types: ['Psychic'], baseStats: { hp:40,atk:45,def:65,speed:90,special:100 }, level: 40, heldItem: { id: 'twisted_spoon', name: 'Twisted Spoon', icon: '🥄' } },
      { speciesId: 49,  name: 'Venomoth', types: ['Bug','Poison'], baseStats: { hp:70,atk:65,def:60,speed:90,special:90 }, level: 41, heldItem: { id: 'silver_powder', name: 'Silver Powder', icon: '🐛' } },
      { speciesId: 64,  name: 'Kadabra',  types: ['Psychic'], baseStats: { hp:40,atk:35,def:30,speed:105,special:120 }, level: 42, heldItem: { id: 'eviolite', name: 'Eviolite', icon: '💎' } },
      { speciesId: 65,  name: 'Alakazam', types: ['Psychic'], baseStats: { hp:55,atk:50,def:45,speed:120,special:135 }, level: 44, heldItem: { id: 'scope_lens', name: 'Scope Lens', icon: '🔭' } },
    ]
  },
  {
    name: 'Blaine', badge: 'Volcano Badge', type: 'Fire', moveTier: 2,
    team: [
      { speciesId: 77,  name: 'Ponyta',   types: ['Fire'], baseStats: { hp:50,atk:85,def:55,speed:90,special:65 }, level: 47, heldItem: { id: 'charcoal', name: 'Charcoal', icon: '🔥' } },
      { speciesId: 58,  name: 'Growlithe',types: ['Fire'], baseStats: { hp:55,atk:70,def:45,speed:60,special:50 }, level: 47, heldItem: { id: 'eviolite', name: 'Eviolite', icon: '💎' } },
      { speciesId: 78,  name: 'Rapidash', types: ['Fire'], baseStats: { hp:65,atk:100,def:70,speed:105,special:80 }, level: 48, heldItem: { id: 'charcoal', name: 'Charcoal', icon: '🔥' } },
      { speciesId: 59,  name: 'Arcanine', types: ['Fire'], baseStats: { hp:90,atk:110,def:80,speed:95,special:100 }, level: 53, heldItem: { id: 'life_orb', name: 'Life Orb', icon: '🔮' } },
    ]
  },
  {
    name: 'Giovanni', badge: 'Earth Badge', type: 'Ground', moveTier: 2,
    team: [
      { speciesId: 51,  name: 'Dugtrio',  types: ['Ground'], baseStats: { hp:35,atk:100,def:50,speed:120,special:50 }, level: 55, heldItem: { id: 'soft_sand', name: 'Soft Sand', icon: '🏖️' } },
      { speciesId: 31,  name: 'Nidoqueen',types: ['Poison','Ground'], baseStats: { hp:90,atk:82,def:87,speed:76,special:75 }, level: 53, heldItem: { id: 'poison_barb', name: 'Poison Barb', icon: '☠️' } },
      { speciesId: 34,  name: 'Nidoking', types: ['Poison','Ground'], baseStats: { hp:81,atk:92,def:77,speed:85,special:75 }, level: 54, heldItem: { id: 'soft_sand', name: 'Soft Sand', icon: '🏖️' } },
      { speciesId: 111, name: 'Rhyhorn',  types: ['Ground','Rock'], baseStats: { hp:80,atk:85,def:95,speed:25,special:30 }, level: 56, heldItem: { id: 'hard_stone', name: 'Hard Stone', icon: '🪨' } },
      { speciesId: 112, name: 'Rhydon',   types: ['Ground','Rock'], baseStats: { hp:105,atk:130,def:120,speed:40,special:45 }, level: 60, heldItem: { id: 'rocky_helmet', name: 'Rocky Helmet', icon: '⛑️' } },
    ]
  },
];

const ELITE_4 = [
  {
    name: 'Lorelei', title: 'Elite Four', type: 'Ice',
    team: [
      { speciesId: 87,  name: 'Dewgong',   types: ['Water','Ice'], baseStats: { hp:90,atk:70,def:80,speed:70,special:95 }, level: 54, heldItem: { id: 'mystic_water', name: 'Mystic Water', icon: '💧' } },
      { speciesId: 91,  name: 'Cloyster',  types: ['Water','Ice'], baseStats: { hp:50,atk:95,def:180,speed:70,special:85 }, level: 53, heldItem: { id: 'rocky_helmet', name: 'Rocky Helmet', icon: '⛑️' } },
      { speciesId: 80,  name: 'Slowbro',   types: ['Water','Psychic'], baseStats: { hp:95,atk:75,def:110,speed:30,special:100 }, level: 54, heldItem: { id: 'leftovers', name: 'Leftovers', icon: '🍃' } },
      { speciesId: 124, name: 'Jynx',      types: ['Ice','Psychic'], baseStats: { hp:65,atk:50,def:35,speed:95,special:95 }, level: 56, heldItem: { id: 'wise_glasses', name: 'Wise Glasses', icon: '🔬' } },
      { speciesId: 131, name: 'Lapras',    types: ['Water','Ice'], baseStats: { hp:130,atk:85,def:80,speed:60,special:95 }, level: 56, heldItem: { id: 'shell_bell', name: 'Shell Bell', icon: '🐚' } },
    ]
  },
  {
    name: 'Bruno', title: 'Elite Four', type: 'Fighting',
    team: [
      { speciesId: 95,  name: 'Onix',      types: ['Rock','Ground'], baseStats: { hp:35,atk:45,def:160,speed:70,special:30 }, level: 53, heldItem: { id: 'rocky_helmet', name: 'Rocky Helmet', icon: '⛑️' } },
      { speciesId: 107, name: 'Hitmonchan',types: ['Fighting'], baseStats: { hp:50,atk:105,def:79,speed:76,special:35 }, level: 55, heldItem: { id: 'black_belt', name: 'Black Belt', icon: '🥋' } },
      { speciesId: 106, name: 'Hitmonlee', types: ['Fighting'], baseStats: { hp:50,atk:120,def:53,speed:87,special:35 }, level: 55, heldItem: { id: 'muscle_band', name: 'Muscle Band', icon: '💪' } },
      { speciesId: 95,  name: 'Onix',      types: ['Rock','Ground'], baseStats: { hp:35,atk:45,def:160,speed:70,special:30 }, level: 54, heldItem: { id: 'hard_stone', name: 'Hard Stone', icon: '🪨' } },
      { speciesId: 68,  name: 'Machamp',   types: ['Fighting'], baseStats: { hp:90,atk:130,def:80,speed:55,special:65 }, level: 58, heldItem: { id: 'choice_band', name: 'Choice Band', icon: '🎀' } },
    ]
  },
  {
    name: 'Agatha', title: 'Elite Four', type: 'Ghost',
    team: [
      { speciesId: 94,  name: 'Gengar',    types: ['Ghost','Poison'], baseStats: { hp:60,atk:65,def:60,speed:110,special:130 }, level: 54, heldItem: { id: 'spell_tag', name: 'Spell Tag', icon: '👻' } },
      { speciesId: 42,  name: 'Golbat',    types: ['Poison','Flying'], baseStats: { hp:75,atk:80,def:70,speed:90,special:75 }, level: 54, heldItem: { id: 'poison_barb', name: 'Poison Barb', icon: '☠️' } },
      { speciesId: 93,  name: 'Haunter',   types: ['Ghost','Poison'], baseStats: { hp:45,atk:50,def:45,speed:95,special:115 }, level: 56, heldItem: { id: 'life_orb', name: 'Life Orb', icon: '🔮' } },
      { speciesId: 42,  name: 'Golbat',    types: ['Poison','Flying'], baseStats: { hp:75,atk:80,def:70,speed:90,special:75 }, level: 56, heldItem: { id: 'sharp_beak', name: 'Sharp Beak', icon: '🦅' } },
      { speciesId: 94,  name: 'Gengar',    types: ['Ghost','Poison'], baseStats: { hp:60,atk:65,def:60,speed:110,special:130 }, level: 58, heldItem: { id: 'scope_lens', name: 'Scope Lens', icon: '🔭' } },
    ]
  },
  {
    name: 'Lance', title: 'Elite Four', type: 'Dragon',
    team: [
      { speciesId: 130, name: 'Gyarados',  types: ['Water','Flying'], baseStats: { hp:95,atk:125,def:79,speed:81,special:100 }, level: 56, heldItem: { id: 'mystic_water', name: 'Mystic Water', icon: '💧' } },
      { speciesId: 149, name: 'Dragonite', types: ['Dragon','Flying'], baseStats: { hp:91,atk:134,def:95,speed:80,special:100 }, level: 56, heldItem: { id: 'dragon_fang', name: 'Dragon Fang', icon: '🐉' } },
      { speciesId: 148, name: 'Dragonair', types: ['Dragon'], baseStats: { hp:61,atk:84,def:65,speed:70,special:70 }, level: 58, heldItem: { id: 'eviolite', name: 'Eviolite', icon: '💎' } },
      { speciesId: 148, name: 'Dragonair', types: ['Dragon'], baseStats: { hp:61,atk:84,def:65,speed:70,special:70 }, level: 60, heldItem: { id: 'dragon_fang', name: 'Dragon Fang', icon: '🐉' } },
      { speciesId: 149, name: 'Dragonite', types: ['Dragon','Flying'], baseStats: { hp:91,atk:134,def:95,speed:80,special:100 }, level: 62, heldItem: { id: 'choice_band', name: 'Choice Band', icon: '🎀' } },
    ]
  },
  {
    name: 'Gary', title: 'Champion', type: 'Mixed',
    team: [
      { speciesId: 18,  name: 'Pidgeot',   types: ['Normal','Flying'], baseStats: { hp:83,atk:80,def:75,speed:101,special:70 }, level: 61, heldItem: { id: 'sharp_beak', name: 'Sharp Beak', icon: '🦅' } },
      { speciesId: 65,  name: 'Alakazam',  types: ['Psychic'], baseStats: { hp:55,atk:50,def:45,speed:120,special:135 }, level: 59, heldItem: { id: 'twisted_spoon', name: 'Twisted Spoon', icon: '🥄' } },
      { speciesId: 112, name: 'Rhydon',    types: ['Ground','Rock'], baseStats: { hp:105,atk:130,def:120,speed:40,special:45 }, level: 61, heldItem: { id: 'soft_sand', name: 'Soft Sand', icon: '🏖️' } },
      { speciesId: 103, name: 'Exeggutor', types: ['Grass','Psychic'], baseStats: { hp:95,atk:95,def:85,speed:55,special:125 }, level: 61, heldItem: { id: 'miracle_seed', name: 'Miracle Seed', icon: '🌱' } },
      { speciesId: 6,   name: 'Charizard', types: ['Fire','Flying'], baseStats: { hp:78,atk:84,def:78,speed:100,special:109 }, level: 65, heldItem: { id: 'charcoal', name: 'Charcoal', icon: '🔥' } },
    ]
  },
];

// Item pool
const ITEM_POOL = [
  { id: 'lucky_egg',          name: 'Lucky Egg',          desc: 'Holder gains +1 extra level after every battle',                   icon: '🥚', minMap: 4 },
  { id: 'life_orb',           name: 'Life Orb',           desc: '+30% damage; holder loses 10% max HP per hit',                       icon: '🔮' },
  { id: 'choice_band',        name: 'Choice Band',        desc: '+40% physical damage, -20% DEF',                                     icon: '🎀' },
  { id: 'choice_specs',       name: 'Choice Specs',       desc: '+40% special damage, -20% Sp.Def',                                   icon: '👓' },
  { id: 'muscle_band',         name: 'Muscle Band',        desc: '+50% ATK & DEF if 4+ Pokémon on your team are physical attackers', icon: '💪' },
  { id: 'wise_glasses',       name: 'Wise Glasses',       desc: '+50% Sp.Atk & Sp.Def if 4+ Pokémon on your team are special attackers', icon: '🔍' },
  { id: 'metronome',          name: 'Metronome',          desc: '+50% damage if 4+ Pokémon on your team share a type with the attacker', icon: '🎵' },
  { id: 'scope_lens',         name: 'Scope Lens',         desc: '20% crit chance (+50% damage on crit)',                              icon: '🔭' },
  { id: 'rocky_helmet',       name: 'Rocky Helmet',       desc: 'Attacker takes 12% of their max HP on each hit',                     icon: '⛑️' },
  { id: 'shell_bell',         name: 'Shell Bell',         desc: 'Heal 25% of damage dealt',                                           icon: '🐚' },
  { id: 'eviolite',           name: 'Eviolite',           desc: '+50% DEF & Sp.Def if holder is not fully evolved',                   icon: '💎' },
  { id: 'sharp_beak',         name: 'Sharp Beak',         desc: '+50% Flying move damage',                                            icon: '🦅' },
  { id: 'charcoal',           name: 'Charcoal',           desc: '+50% Fire move damage',                                              icon: '🔥' },
  { id: 'mystic_water',       name: 'Mystic Water',       desc: '+50% Water move damage',                                             icon: '💧' },
  { id: 'magnet',             name: 'Magnet',             desc: '+50% Electric move damage',                                          icon: '🧲', minMap: 4 },
  { id: 'miracle_seed',       name: 'Miracle Seed',       desc: '+50% Grass move damage',                                             icon: '🌱' },
  { id: 'twisted_spoon',      name: 'Twisted Spoon',      desc: '+50% Psychic move damage',                                           icon: '🥄', minMap: 4 },
  { id: 'black_belt',         name: 'Black Belt',         desc: '+50% Fighting move damage',                                          icon: '🥋' },
  { id: 'soft_sand',          name: 'Soft Sand',          desc: '+50% Ground move damage',                                            icon: '🏖️', minMap: 4 },
  { id: 'silver_powder',      name: 'Silver Powder',      desc: '+50% Bug move damage',                                               icon: '🐛' },
  { id: 'hard_stone',         name: 'Hard Stone',         desc: '+50% Rock move damage',                                              icon: '🪨', minMap: 4 },
  { id: 'dragon_fang',        name: 'Dragon Fang',        desc: '+50% Dragon move damage',                                            icon: '🐉', minMap: 6 },
  { id: 'poison_barb',        name: 'Poison Barb',        desc: '+50% Poison move damage',                                            icon: '☠️', minMap: 4 },
  { id: 'spell_tag',          name: 'Spell Tag',          desc: '+50% Ghost move damage',                                             icon: '👻', minMap: 4 },
  { id: 'silk_scarf',         name: 'Silk Scarf',         desc: '+50% Normal move damage',                                            icon: '🤍' },
  // Stat items
  { id: 'assault_vest',       name: 'Assault Vest',       desc: '+50% Sp.Def',                                                        icon: '🦺' },
  { id: 'choice_scarf',       name: 'Choice Scarf',       desc: '+50% Speed',                                                         icon: '🧣' },
  // Battle effect items
  { id: 'leftovers',          name: 'Leftovers',          desc: 'Restore 1/16 max HP each round',                                     icon: '🍃' },
  { id: 'expert_belt',        name: 'Expert Belt',        desc: '+30% damage on super effective hits',                                 icon: '🥊' },
  { id: 'focus_band',         name: 'Focus Band',         desc: '20% chance to survive a KO with 1 HP',                               icon: '🩹' },
  { id: 'focus_sash',         name: 'Focus Sash',         desc: 'If at full HP, guaranteed to survive any hit with 1 HP',             icon: '🎗️' },
  { id: 'wide_lens',          name: 'Wide Lens',          desc: '+20% damage on all moves',                                            icon: '🔎' },
  { id: 'air_balloon',        name: 'Air Balloon',        desc: 'Immune to Ground-type moves',                                         icon: '🎈' },
];

const USABLE_ITEM_POOL = [
  { id: 'max_revive',  name: 'Max Revive',       desc: 'Fully revives a fainted Pokémon',              icon: '💊', usable: true },
  { id: 'rare_candy',  name: 'Rare Candy',        desc: 'Gives a Pokémon +3 levels',                   icon: '🍬', usable: true },
  { id: 'moon_stone',  name: 'Moon Stone',        desc: 'Force evolves a Pokémon regardless of level',  icon: '🌙', usable: true },
];

const TYPE_ITEM_MAP = {
  Flying: 'sharp_beak', Fire: 'charcoal', Water: 'mystic_water', Electric: 'magnet',
  Grass: 'miracle_seed', Psychic: 'twisted_spoon', Fighting: 'black_belt',
  Ground: 'soft_sand', Bug: 'silver_powder', Rock: 'hard_stone', Dragon: 'dragon_fang',
  Poison: 'poison_barb', Ghost: 'spell_tag', Normal: 'silk_scarf',
};

// Bust stale pokemon species cache entries missing the 'special' stat
(function bustStaleCache() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith('pkrl_poke_')) continue;
      const val = getCached(key);
      if (val && val.baseStats && (val.baseStats.special === undefined || val.baseStats.spdef === undefined)) {
        localStorage.removeItem(key);
      }
    }
  } catch {}
})();

// Settings (persisted across runs)
function getSettings() {
  const defaults = { autoSkipBattles: false, autoSkipAllBattles: false, autoSkipEvolve: false, darkMode: false };
  return Object.assign({}, defaults, getCached('poke_settings') || {});
}
function saveSettings(s) { setCached('poke_settings', s); }

// BST ranges per map
const MAP_BST_RANGES = [
  { min: 200, max: 310 },   // Map 1
  { min: 280, max: 360 },   // Map 2
  { min: 340, max: 420 },   // Map 3
  { min: 340, max: 420 },   // Map 4
  { min: 400, max: 480 },   // Map 5
  { min: 400, max: 480 },   // Map 6
  { min: 460, max: 530 },   // Map 7
  { min: 460, max: 530 },   // Map 8
  { min: 530, max: 999 },   // Final
];

const MAP_LEVEL_RANGES = [
  [1, 5], [8, 15], [14, 21], [21, 29],
  [29, 37], [37, 43], [43, 47], [47, 52], [53, 64]
];

// PokeAPI cache helpers
const CACHE_KEY_SPECIES = 'pkrl_species_list';

function getCached(key) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : null;
  } catch { return null; }
}

function setCached(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

async function fetchSpeciesList() {
  const cached = getCached(CACHE_KEY_SPECIES);
  if (cached) return cached;
  try {
    const r = await fetch('https://pokeapi.co/api/v2/pokemon?limit=2000');
    const d = await r.json();
    const list = d.results.map((p, i) => ({ name: p.name, id: i + 1 }));
    setCached(CACHE_KEY_SPECIES, list);
    return list;
  } catch (e) {
    console.warn('PokeAPI unavailable, using fallback data');
    return null;
  }
}

async function fetchPokemonById(id) {
  const key = `pkrl_poke_${id}`;
  const cached = getCached(key);
  if (cached && cached.baseStats?.special !== undefined && cached.baseStats?.spdef !== undefined) return cached;
  try {
    const r = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
    const d = await r.json();
    const stats = {};
    for (const s of d.stats) {
      stats[s.stat.name.replace('special-attack','special').replace('special-defense','special').replace('-','_')] = s.base_stat;
    }
    const baseStats = {
      hp: d.stats.find(s=>s.stat.name==='hp')?.base_stat || 45,
      atk: d.stats.find(s=>s.stat.name==='attack')?.base_stat || 50,
      def: d.stats.find(s=>s.stat.name==='defense')?.base_stat || 50,
      speed: d.stats.find(s=>s.stat.name==='speed')?.base_stat || 50,
      special: d.stats.find(s=>s.stat.name==='special-attack')?.base_stat || 50,
      spdef:   d.stats.find(s=>s.stat.name==='special-defense')?.base_stat || 50,
    };
    const bst = Object.values(baseStats).reduce((a,b)=>a+b,0);
    const types = d.types.map(t => t.type.name.charAt(0).toUpperCase() + t.type.name.slice(1));
    const poke = {
      id: d.id,
      name: d.name.charAt(0).toUpperCase() + d.name.slice(1),
      types,
      baseStats,
      bst,
      spriteUrl: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${d.id}.png`,
      shinySpriteUrl: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${d.id}.png`,
    };
    setCached(key, poke);
    return poke;
  } catch (e) {
    console.warn(`Failed to fetch pokemon ${id}`, e);
    return null;
  }
}

let _speciesPool = null;
let _poolByMap = {};

async function getSpeciesPool() {
  if (_speciesPool) return _speciesPool;
  _speciesPool = await fetchSpeciesList();
  return _speciesPool;
}

// Gen 1 legendary Pokemon — removed from all wild/catch pools, available only via Legendary node
const LEGENDARY_IDS = [144, 145, 146, 150, 151];

// All catchable Gen 1 IDs by BST bucket (module-level so other code can reference them)
// Legendaries are excluded from all buckets — they appear only via the Legendary node
const GEN1_BST_APPROX = {
  low:      [10,11,13,14,16,17,19,20,21,23,27,29,32,41,46,48,52,54,56,60,
             69,72,74,79,81,84,86,96,98,100,102,108,111,116,118,120,129,133],
  midLow:   [25,30,33,35,37,39,43,50,58,61,63,66,73,77,83,92,95,96,104,109,
             113,114,116,120,122,126,127,128,138,140],
  mid:      [26,36,42,49,51,64,67,70,75,82,85,93,97,101,103,105,107,110,119,
             121,124,125,130,137,139,141],
  midHigh:  [40,44,55,62,76,80,87,88,89,90,91,99,106,115,117,123,131,
             132,137,142,143],
  high:     [3,6,9,12,15,18,22,24,28,31,34,38,45,47,53,57,59,
             65,68,71,76,78,80,89,94,112,121,130,142,143,149],
  veryHigh: [6,9,65,68,94,112,130,131,143,147,148,149],
};

const ALL_CATCHABLE_IDS = new Set(Array.from({ length: 151 }, (_, i) => i + 1));

function isPokedexComplete() {
  const dex = getPokedex();
  const caughtIds = new Set(Object.values(dex).filter(e => e.caught).map(e => e.id));
  for (const id of ALL_CATCHABLE_IDS) {
    if (!caughtIds.has(id)) return false;
  }
  return true;
}

function hasShinyCharm() { return isPokedexComplete(); }


// Get 3 random pokemon ids from the right BST bucket for a given mapIndex
async function getCatchChoices(mapIndex) {
  const range = MAP_BST_RANGES[Math.min(mapIndex, MAP_BST_RANGES.length - 1)];
  const pool = await getSpeciesPool();

  let bucket;
  if (range.min >= 530) bucket = GEN1_BST_APPROX.veryHigh;
  else if (range.min >= 460) bucket = GEN1_BST_APPROX.high;
  else if (range.min >= 400) bucket = GEN1_BST_APPROX.midHigh;
  else if (range.min >= 340) bucket = GEN1_BST_APPROX.mid;
  else if (range.min >= 280) bucket = GEN1_BST_APPROX.midLow;
  else bucket = GEN1_BST_APPROX.low;

  // Shuffle and pick 3 (filter legendaries as safety net)
  const filtered = bucket.filter(id => !LEGENDARY_IDS.includes(id));
  const shuffled = [...filtered].sort(() => (typeof rng === 'function' ? rng() : Math.random()) - 0.5);
  const ids = shuffled.slice(0, 3);

  const results = await Promise.all(ids.map(id => fetchPokemonById(id)));
  return results.filter(Boolean);
}

function calcHp(baseHp, level) {
  return Math.floor(baseHp * level / 50) + level + 10;
}

function createInstance(species, level, isShiny = false, moveTier = 1) {
  const lvl = level || 5;
  const maxHp = calcHp(species.baseStats.hp, lvl);
  const id = species.id ?? species.speciesId;
  const spriteUrl = isShiny
    ? (species.shinySpriteUrl || `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${id}.png`)
    : (species.spriteUrl      || `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`);
  return {
    speciesId: id,
    name: species.name,
    nickname: null,
    level: lvl,
    currentHp: maxHp,
    maxHp,
    isShiny,
    types: species.types,
    baseStats: species.baseStats,
    spriteUrl,
    megaStone: null,
    heldItem: null,
    moveTier: Math.max(0, Math.min(2, moveTier ?? 1)),
  };
}

// Starters
const STARTER_IDS = [1, 4, 7];


// Trainer sprites from Pokemon Showdown CDN
const TRAINER_SVG = {
  boy:  `<img src="https://play.pokemonshowdown.com/sprites/trainers/red.png"  alt="Red"  class="trainer-sprite-img" onerror="this.style.opacity='.3'">`,
  girl: `<img src="https://play.pokemonshowdown.com/sprites/trainers/dawn.png" alt="Dawn" class="trainer-sprite-img" onerror="this.style.opacity='.3'">`,
  npc:  `<img src="https://play.pokemonshowdown.com/sprites/trainers/youngster.png" alt="Trainer" class="trainer-sprite-img" onerror="this.style.opacity='.3'">`,
};

// Name overrides for Pokemon Showdown trainer sprite filenames
const SHOWDOWN_NAME_MAP = { 'gary': 'blue', 'lt. surge': 'ltsurge', 'lorelei': 'lorelei-gen3', 'agatha': 'agatha-gen3' };

function getTrainerImgHtml(trainerName) {
  // Local sprite path (e.g. "sprites/hiker.png") — use directly
  if (trainerName.includes('/')) {
    return `<img src="${trainerName}" alt="Trainer" class="trainer-sprite-img"
      onerror="this.style.opacity='.3';this.onerror=null">`;
  }
  const key = trainerName.toLowerCase();
  const slug = SHOWDOWN_NAME_MAP[key] || key.replace(/[.']/g, '').replace(/\s+/g, '-');
  return `<img src="https://play.pokemonshowdown.com/sprites/trainers/${slug}.png"
    alt="${trainerName}" class="trainer-sprite-img"
    onerror="this.src='https://play.pokemonshowdown.com/sprites/trainers/youngster.png';this.onerror=null">`;
}

// All Gen 1 evolutions — stone/trade converted to sensible levels
const GEN1_EVOLUTIONS = {
  // Starters
  1:  { into: 2,   level: 16, name: 'Ivysaur' },
  2:  { into: 3,   level: 32, name: 'Venusaur' },
  4:  { into: 5,   level: 16, name: 'Charmeleon' },
  5:  { into: 6,   level: 36, name: 'Charizard' },
  7:  { into: 8,   level: 16, name: 'Wartortle' },
  8:  { into: 9,   level: 36, name: 'Blastoise' },
  // Bugs
  10: { into: 11,  level: 7,  name: 'Metapod' },
  11: { into: 12,  level: 10, name: 'Butterfree' },
  13: { into: 14,  level: 7,  name: 'Kakuna' },
  14: { into: 15,  level: 10, name: 'Beedrill' },
  // Birds / normals
  16: { into: 17,  level: 18, name: 'Pidgeotto' },
  17: { into: 18,  level: 36, name: 'Pidgeot' },
  19: { into: 20,  level: 20, name: 'Raticate' },
  21: { into: 22,  level: 20, name: 'Fearow' },
  // Snakes / ground
  23: { into: 24,  level: 22, name: 'Arbok' },
  27: { into: 28,  level: 22, name: 'Sandslash' },
  // Nidos
  29: { into: 30,  level: 16, name: 'Nidorina' },
  30: { into: 31,  level: 36, name: 'Nidoqueen' },  // stone → lv 36
  32: { into: 33,  level: 16, name: 'Nidorino' },
  33: { into: 34,  level: 36, name: 'Nidoking' },   // stone → lv 36
  // Fairies / grass
  35: { into: 36,  level: 36, name: 'Clefable' },   // moon stone → lv 36
  37: { into: 38,  level: 32, name: 'Ninetales' },  // fire stone → lv 32
  39: { into: 40,  level: 36, name: 'Wigglytuff' }, // moon stone → lv 36
  // Zubat
  41: { into: 42,  level: 22, name: 'Golbat' },
  // Grass
  43: { into: 44,  level: 21, name: 'Gloom' },
  44: { into: 45,  level: 36, name: 'Vileplume' },  // leaf stone → lv 36
  // Parasect / Venomoth
  46: { into: 47,  level: 24, name: 'Parasect' },
  48: { into: 49,  level: 31, name: 'Venomoth' },
  // Diglett / Meowth / Psyduck / Mankey
  50: { into: 51,  level: 26, name: 'Dugtrio' },
  52: { into: 53,  level: 28, name: 'Persian' },
  54: { into: 55,  level: 33, name: 'Golduck' },
  56: { into: 57,  level: 28, name: 'Primeape' },
  // Growlithe
  58: { into: 59,  level: 34, name: 'Arcanine' },   // fire stone → lv 34
  // Poliwag
  60: { into: 61,  level: 25, name: 'Poliwhirl' },
  61: { into: 62,  level: 40, name: 'Poliwrath' },  // water stone → lv 40
  // Abra / Machop / Bellsprout
  63: { into: 64,  level: 16, name: 'Kadabra' },
  64: { into: 65,  level: 36, name: 'Alakazam' },   // trade → lv 36
  66: { into: 67,  level: 28, name: 'Machoke' },
  67: { into: 68,  level: 40, name: 'Machamp' },    // trade → lv 40
  69: { into: 70,  level: 21, name: 'Weepinbell' },
  70: { into: 71,  level: 36, name: 'Victreebel' }, // leaf stone → lv 36
  // Tentacool / Geodude / Ponyta
  72: { into: 73,  level: 30, name: 'Tentacruel' },
  74: { into: 75,  level: 25, name: 'Graveler' },
  75: { into: 76,  level: 40, name: 'Golem' },      // trade → lv 40
  77: { into: 78,  level: 40, name: 'Rapidash' },
  // Slowpoke / Magnemite / Doduo / Seel / Grimer
  79: { into: 80,  level: 37, name: 'Slowbro' },    // water stone in some versions → lv 37
  81: { into: 82,  level: 30, name: 'Magneton' },
  84: { into: 85,  level: 31, name: 'Dodrio' },
  86: { into: 87,  level: 34, name: 'Dewgong' },
  88: { into: 89,  level: 38, name: 'Muk' },
  // Shellder / Gastly / Onix / Drowzee / Krabby / Voltorb
  90: { into: 91,  level: 36, name: 'Cloyster' },   // water stone → lv 36
  92: { into: 93,  level: 25, name: 'Haunter' },
  93: { into: 94,  level: 38, name: 'Gengar' },     // trade → lv 38
  95: { into: 208, level: 40, name: 'Steelix' },    // trade → lv 40 (Steelix #208)
  96: { into: 97,  level: 26, name: 'Hypno' },
  98: { into: 99,  level: 28, name: 'Kingler' },
  100:{ into: 101, level: 30, name: 'Electrode' },
  // Exeggcute / Cubone / Lickitung / Koffing / Rhyhorn
  102:{ into: 103, level: 36, name: 'Exeggutor' },  // leaf stone → lv 36
  104:{ into: 105, level: 28, name: 'Marowak' },
  109:{ into: 110, level: 35, name: 'Weezing' },
  111:{ into: 112, level: 42, name: 'Rhydon' },
  // Horsea / Goldeen / Staryu / Scyther / Electabuzz / Magmar / Pinsir
  116:{ into: 117, level: 32, name: 'Seadra' },
  118:{ into: 119, level: 33, name: 'Seaking' },
  120:{ into: 121, level: 36, name: 'Starmie' },    // water stone → lv 36
  123:{ into: 212, level: 40, name: 'Scizor' },     // trade → lv 40 (Scizor #212)
  // Eevee — branching, handled separately
  // Omanyte / Kabuto / Aerodactyl (fossils — no evolution here)
  138:{ into: 139, level: 40, name: 'Omastar' },
  140:{ into: 141, level: 40, name: 'Kabutops' },
  // Dratini
  129:{ into: 130, level: 20, name: 'Gyarados' },
  147:{ into: 148, level: 30, name: 'Dragonair' },
  148:{ into: 149, level: 55, name: 'Dragonite' },
};

// Returns the minimum realistic level for a species based on its evolution chain.
// e.g. Charizard (id 6) evolved from Charmeleon at lv 36, so its min is 36.
function minLevelForSpecies(speciesId) {
  for (const evo of Object.values(GEN1_EVOLUTIONS)) {
    if (evo.into === speciesId) return evo.level;
  }
  return 1;
}

// Returns true if the species can still evolve (i.e. is not fully evolved)
function canEvolve(speciesId) {
  return speciesId in GEN1_EVOLUTIONS || speciesId === 133; // 133 = Eevee
}

// Eevee branching evolution options (shown as a choice at level 36)
const EEVEE_EVOLUTIONS = [
  { into: 136, level: 36, name: 'Flareon',  types: ['Fire'] },
  { into: 134, level: 36, name: 'Vaporeon', types: ['Water'] },
  { into: 135, level: 36, name: 'Jolteon',  types: ['Electric'] },
];

// ---- Achievements ----

const ACHIEVEMENTS = [
  { id: 'gym_0', name: 'Boulder Basher',    desc: 'Clear Map 1 and defeat Brock',                                           icon: '🪨' },
  { id: 'gym_1', name: 'Cascade Crusher',   desc: 'Clear Map 2 and defeat Misty',                                           icon: '💧' },
  { id: 'gym_2', name: 'Thunder Tamer',     desc: 'Clear Map 3 and defeat Lt. Surge',                                       icon: '⚡' },
  { id: 'gym_3', name: 'Rainbow Ranger',    desc: 'Clear Map 4 and defeat Erika',                                           icon: '🌿' },
  { id: 'gym_4', name: 'Soul Crusher',      desc: 'Clear Map 5 and defeat Koga',                                            icon: '💜' },
  { id: 'gym_5', name: 'Mind Breaker',      desc: 'Clear Map 6 and defeat Sabrina',                                         icon: '🔮' },
  { id: 'gym_6', name: 'Volcano Victor',    desc: 'Clear Map 7 and defeat Blaine',                                          icon: '🌋' },
  { id: 'gym_7', name: 'Earth Shaker',      desc: 'Clear Map 8 and defeat Giovanni',                                        icon: '🌍' },
  { id: 'elite_four', name: 'Pokemon Master',    desc: 'Defeat all 4 Elite Four members and the Champion to beat the game', icon: '👑' },
  { id: 'elite_10',   name: 'Champion League',   desc: 'Beat the game 10 times total',                                      icon: '🏆' },
  { id: 'elite_100',  name: 'Immortal Champion', desc: 'Beat the game 100 times total',                                     icon: '💎' },
  { id: 'starter_1', name: 'Grass Champion',  desc: 'Choose Bulbasaur as your starter and beat the game',                   icon: '🌱' },
  { id: 'starter_4', name: 'Fire Champion',   desc: 'Choose Charmander as your starter and beat the game',                  icon: '🔥' },
  { id: 'starter_7', name: 'Water Champion',  desc: 'Choose Squirtle as your starter and beat the game',                    icon: '🌊' },
  { id: 'solo_run',    name: 'One is Enough',        desc: 'Beat the game while keeping only 1 Pokémon on your team',       icon: '⭐' },
  { id: 'pokedex_complete',  name: 'Gotta Catch \'Em All', desc: 'Encounter all 151 Gen 1 Pokémon across any number of runs', icon: '📖' },
  { id: 'shinydex_complete', name: 'Shiny Hunter',   desc: 'Encounter a shiny version of all 151 Gen 1 Pokémon',            icon: '✨' },
  { id: 'nuzlocke_win',      name: 'True Master',    desc: 'Enable Nuzlocke Mode in Settings, then beat the game — if any Pokémon faints, it\'s gone for good', icon: '☠️' },
  { id: 'three_birds',       name: 'Bird Keeper',    desc: 'Beat the game with Articuno, Zapdos, and Moltres all on your team', icon: '🦅' },
  { id: 'no_pokecenter',     name: 'No Rest for the Wicked', desc: 'Beat the game without stopping at a Pokémon Center',   icon: '🏃' },
  { id: 'no_items',          name: 'Minimalist',     desc: 'Beat the game without picking up a single item',                icon: '🎒' },
  { id: 'type_quartet',      name: 'Type Supremacy', desc: 'Beat the game with at least 4 of your 6 Pokémon sharing the same type', icon: '🔣' },
  { id: 'all_shiny_win',     name: 'Shiny Squad',    desc: 'Beat the game with every Pokémon on your team being shiny (minimum 3)',             icon: '💫' },
  { id: 'back_to_back',      name: 'On a Roll',      desc: 'Beat the game twice in a row without losing a run in between',  icon: '🔁' },
];

function getUnlockedAchievements() {
  try { return new Set(JSON.parse(localStorage.getItem('poke_achievements') || '[]')); }
  catch { return new Set(); }
}

function unlockAchievement(id) {
  const unlocked = getUnlockedAchievements();
  if (unlocked.has(id)) return null;
  unlocked.add(id);
  localStorage.setItem('poke_achievements', JSON.stringify([...unlocked]));
  return ACHIEVEMENTS.find(a => a.id === id) || null;
}

// ---- Pokedex ----

function getPokedex() {
  try { return JSON.parse(localStorage.getItem('poke_dex') || '{}'); }
  catch { return {}; }
}

function markPokedexSeen(id, name, types, spriteUrl) {
  if (!id) return;
  const dex = getPokedex();
  if (!dex[id]) {
    dex[id] = { id, name, types, spriteUrl, caught: false };
    localStorage.setItem('poke_dex', JSON.stringify(dex));
  }
}

function markPokedexCaught(id, name, types, spriteUrl) {
  if (!id) return;
  const dex = getPokedex();
  dex[id] = { ...(dex[id] || {}), id, caught: true,
    name:      name      || dex[id]?.name,
    types:     types     || dex[id]?.types,
    spriteUrl: spriteUrl || dex[id]?.spriteUrl,
  };
  localStorage.setItem('poke_dex', JSON.stringify(dex));
}

function getShinyDex() {
  try { return JSON.parse(localStorage.getItem('poke_shiny_dex') || '{}'); }
  catch { return {}; }
}

function hasNuzlockeModeWin() {
  return getUnlockedAchievements().has('nuzlocke_win');
}

function getEliteWins() {
  return parseInt(localStorage.getItem('poke_elite_wins') || '0', 10);
}

function incrementEliteWins() {
  const wins = getEliteWins() + 1;
  localStorage.setItem('poke_elite_wins', String(wins));
  return wins;
}

// Returns an <img> for the item's official sprite, falling back to its emoji if the sprite 404s
function itemIconHtml(item, size = 24) {
  const slug = item.id.replace(/_/g, '-');
  const url = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${slug}.png`;
  const esc = item.icon.replace(/'/g, "\\'");
  return `<img src="${url}" alt="${item.name}" title="${item.name}" class="item-sprite-icon" `
       + `style="width:${size}px;height:${size}px;image-rendering:pixelated;vertical-align:middle;" `
       + `onerror="this.replaceWith(document.createTextNode('${esc}'))">`;
}

function isShinyDexComplete() {
  const dex = getShinyDex();
  const caughtIds = new Set(Object.values(dex).map(e => e.id));
  for (const id of ALL_CATCHABLE_IDS) {
    if (!caughtIds.has(id)) return false;
  }
  return true;
}

function markShinyDexCaught(id, name, types, shinySpriteUrl) {
  if (!id) return;
  const dex = getShinyDex();
  dex[id] = { id, name, types, shinySpriteUrl };
  localStorage.setItem('poke_shiny_dex', JSON.stringify(dex));
}

// ---- Hall of Fame ----

function getHallOfFame() {
  try { return JSON.parse(localStorage.getItem('poke_hall_of_fame') || '[]'); }
  catch { return []; }
}

function saveHallOfFameEntry(team, runNumber, hardMode) {
  const entries = getHallOfFame();
  entries.push({
    runNumber,
    hardMode: !!hardMode,
    date: new Date().toLocaleDateString(),
    team: team.map(p => ({
      speciesId: p.speciesId,
      name: p.name,
      nickname: p.nickname || null,
      level: p.level,
      types: p.types,
      spriteUrl: p.spriteUrl,
      isShiny: !!p.isShiny,
    })),
  });
  localStorage.setItem('poke_hall_of_fame', JSON.stringify(entries));
}
