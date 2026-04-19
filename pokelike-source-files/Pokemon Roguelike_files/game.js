// game.js - Central game state and entry point

// Seeded PRNG (mulberry32) — use rng() instead of Math.random() for all game logic
let _rngSeed = 0;
function rng() {
  _rngSeed = (_rngSeed + 0x6D2B79F5) | 0;
  let t = Math.imul(_rngSeed ^ (_rngSeed >>> 15), 1 | _rngSeed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function seedRng(seed) { _rngSeed = seed >>> 0; }
function getRngSeed() { return _rngSeed >>> 0; }

let state = {
  currentMap: 0,
  currentNode: null,
  team: [],
  items: [],
  badges: 0,
  map: null,
  eliteIndex: 0,
  trainer: 'boy',
  starterSpeciesId: null,
  maxTeamSize: 1,
  nuzlockeMode: false,
};

// ---- Run persistence ----

function saveRun() {
  try {
    const saved = { ...state, currentNodeId: state.currentNode?.id || null, currentNode: null, rngSeed: getRngSeed() };
    localStorage.setItem('poke_current_run', JSON.stringify(saved));
  } catch {}
}

function loadRun() {
  try {
    const raw = localStorage.getItem('poke_current_run');
    if (!raw) return false;
    const saved = JSON.parse(raw);
    if (saved.rngSeed) seedRng(saved.rngSeed);
    state = saved;
    state.currentNode = saved.currentNodeId ? (state.map?.nodes?.[saved.currentNodeId] || null) : null;
    delete state.currentNodeId;
    delete state.rngSeed;
    return true;
  } catch { return false; }
}

function clearSavedRun() {
  localStorage.removeItem('poke_current_run');
}

// ---- Initialization ----

async function initGame() {
  applyDarkMode();
  showScreen('title-screen');
  if (typeof initFirebase === 'function') initFirebase();
  if (typeof syncToCloud === 'function') syncToCloud();
  document.getElementById('btn-new-run').onclick = () => startNewRun(false);
  document.getElementById('btn-hard-run').onclick = () => startNewRun(true);

  const continueBtn = document.getElementById('btn-continue-run');
  if (localStorage.getItem('poke_current_run')) {
    continueBtn.style.display = '';
    continueBtn.onclick = async () => {
      if (!loadRun()) return;
      if (state.currentNode && !state.currentNode.visited) {
        showMapScreen();
        await onNodeClick(state.currentNode);
      } else {
        showMapScreen();
      }
    };
  } else {
    continueBtn.style.display = 'none';
  }
}

async function startNewRun(nuzlockeMode = false) {
  const savedTrainer = localStorage.getItem('poke_trainer') || null;
  const seed = (Date.now() ^ (Math.random() * 0x100000000 | 0)) >>> 0;
  seedRng(seed);
  state = { currentMap: 0, currentNode: null, team: [], items: [], badges: 0, map: null, eliteIndex: 0, trainer: savedTrainer || 'boy', starterSpeciesId: null, maxTeamSize: 1, nuzlockeMode, usedPokecenter: false, pickedUpItem: false, runSeed: seed };
  if (savedTrainer) {
    await showStarterSelect();
  } else {
    await showTrainerSelect();
  }
}

async function showTrainerSelect() {
  showScreen('trainer-screen');
  const boyCard  = document.getElementById('trainer-boy');
  const girlCard = document.getElementById('trainer-girl');
  boyCard.querySelector('.trainer-icon-wrap').innerHTML  = TRAINER_SVG.boy;
  girlCard.querySelector('.trainer-icon-wrap').innerHTML = TRAINER_SVG.girl;

  await new Promise(resolve => {
    function pick(gender) {
      state.trainer = gender;
      localStorage.setItem('poke_trainer', gender);
      resolve();
    }
    boyCard.onclick   = () => pick('boy');
    boyCard.onkeydown = e => { if (e.key==='Enter'||e.key===' ') pick('boy'); };
    girlCard.onclick   = () => pick('girl');
    girlCard.onkeydown = e => { if (e.key==='Enter'||e.key===' ') pick('girl'); };
  });
  await showStarterSelect();
}

async function showStarterSelect() {
  showScreen('starter-screen');
  const container = document.getElementById('starter-choices');
  container.innerHTML = '<div class="loading">Loading starters...</div>';

  const starters = await Promise.all(STARTER_IDS.map(id => fetchPokemonById(id)));
  const startLevel = 5;

  container.innerHTML = '';
  for (const species of starters) {
    if (!species) continue;
    const isShiny = rng() < (hasShinyCharm() ? 0.02 : 0.01);
    const inst = createInstance(species, startLevel, isShiny, 0);
    const wrapper = document.createElement('div');
    wrapper.innerHTML = renderPokemonCard(inst, true, false);
    const card = wrapper.querySelector('.poke-card');
    card.style.cursor = 'pointer';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.addEventListener('click', () => selectStarter(inst));
    card.addEventListener('keydown', e => { if(e.key==='Enter'||e.key===' ') selectStarter(inst); });
    container.appendChild(card);
  }
}

function selectStarter(pokemon) {
  const normalUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemon.speciesId}.png`;
  markPokedexCaught(pokemon.speciesId, pokemon.name, pokemon.types, normalUrl);
  if (pokemon.isShiny) markShinyDexCaught(pokemon.speciesId, pokemon.name, pokemon.types, pokemon.spriteUrl);
  state.team = [pokemon];
  state.starterSpeciesId = pokemon.speciesId;
  state.maxTeamSize = 1;
  startMap(0);
}

// ---- Map Management ----

function startMap(mapIndex) {
  state.currentMap = mapIndex;
  state.map = generateMap(mapIndex, state.nuzlockeMode);

  // Full heal between arenas (skip the very first map)
  if (mapIndex > 0) {
    for (const p of state.team) {
      p.currentHp = p.maxHp;
    }
  }

  const startNode = state.map.nodes['n0_0'];
  state.currentNode = startNode;

  showMapScreen();
}

function showMapScreen() {
  showScreen('map-screen');
  const mapInfo = document.getElementById('map-info');
  if (mapInfo) {
    const isFinal = state.currentMap === 8;
    const leader = isFinal ? null : GYM_LEADERS[state.currentMap];
    mapInfo.innerHTML = isFinal
      ? `<span>Elite Four & Champion</span>`
      : `<span>Map ${state.currentMap+1}: vs <b>${leader.name}</b> (${leader.type})</span>`;
  }
  const BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/';
  const badgeHtml = Array.from({ length: 8 }, (_, i) => {
    const earned = i < state.badges;
    const label = GYM_LEADERS[i].badge;
    return earned
      ? `<img src="${BASE}${i + 1}.png" alt="${label}" title="${label}" class="badge-icon-img">`
      : `<span class="badge-icon-empty" title="${label}"></span>`;
  }).join('');
  const badgeEl = document.getElementById('badge-count');
  if (badgeEl) badgeEl.innerHTML = badgeHtml;
  const badgePanelEl = document.getElementById('badge-count-panel');
  if (badgePanelEl) badgePanelEl.innerHTML = badgeHtml;

  renderTeamBar(state.team);
  renderItemBadges(state.items);

  const mapContainer = document.getElementById('map-container');
  mapContainer.style.backgroundImage = `url('ui/map${state.currentMap + 1}.png')`;
  renderMap(state.map, mapContainer, onNodeClick);
  saveRun();

  if (!localStorage.getItem('poke_tutorial_seen')) {
    showTutorialOverlay();
  }
}

function showTutorialOverlay() {
  const overlay = document.createElement('div');
  overlay.id = 'tutorial-overlay';

  // Find positions of the settings button and team bar
  const settingsBtn = document.querySelector('#map-screen button[title="Settings"]');
  const teamBar = document.getElementById('team-bar');

  if (settingsBtn) {
    const r = settingsBtn.getBoundingClientRect();
    const callout = document.createElement('div');
    callout.className = 'tutorial-callout arrow-right';
    callout.textContent = 'Open settings and turn on Auto Skip!';
    callout.style.top = (r.top + r.height / 2 - 30) + 'px';
    callout.style.right = (window.innerWidth - r.left + 10) + 'px';
    overlay.appendChild(callout);
  }

  if (teamBar) {
    const r = teamBar.getBoundingClientRect();
    const callout = document.createElement('div');
    callout.className = 'tutorial-callout arrow-up';
    callout.textContent = 'Click a Pokémon to swap positions in your team';
    callout.style.top = (r.bottom + 14) + 'px';
    callout.style.left = (r.left + r.width / 2 - 90) + 'px';
    overlay.appendChild(callout);
  }

  const dismiss = document.createElement('div');
  dismiss.className = 'tutorial-dismiss';
  dismiss.textContent = 'Click anywhere to dismiss';
  overlay.appendChild(dismiss);

  overlay.addEventListener('click', () => {
    localStorage.setItem('poke_tutorial_seen', '1');
    overlay.remove();
  });

  document.body.appendChild(overlay);
}

function showItemFoundToast(icon, name) {
  const toast = document.createElement('div');
  toast.className = 'item-found-toast';
  toast.innerHTML = `<span class="item-toast-icon">${icon}</span>
    <div class="ach-toast-text">
      <div class="item-toast-label">Item Found!</div>
      <div class="item-toast-name">${name}</div>
    </div>`;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('visible'));
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}


async function onNodeClick(node) {
  state.currentNode = node;
  saveRun();
  let resolvedType = node.type;

  if (node.type === NODE_TYPES.QUESTION) {
    resolvedType = resolveQuestionMark();
  }

  switch (resolvedType) {
    case NODE_TYPES.BATTLE:
      await doBattleNode(node);
      break;
    case NODE_TYPES.CATCH:
      await doCatchNode(node);
      break;
    case NODE_TYPES.ITEM:
      doItemNode(node);
      break;
    case NODE_TYPES.BOSS:
      await doBossNode(node);
      break;
    case NODE_TYPES.POKECENTER:
      doPokeCenterNode(node);
      break;
    case NODE_TYPES.TRAINER:
      await doTrainerNode(node);
      break;
    case NODE_TYPES.LEGENDARY:
      await doLegendaryNode(node);
      break;
    case NODE_TYPES.MOVE_TUTOR:
      await doMoveTutorNode(node);
      break;
    case NODE_TYPES.TRADE:
      await doTradeNode(node);
      break;
    case 'shiny':
      await doShinyNode(node);
      break;
    case 'mega':
      doItemNode(node);
      break;
    default:
      await doBattleNode(node);
  }

}

function resolveQuestionMark() {
  const r = rng();
  if (r < 0.22) return NODE_TYPES.BATTLE;
  if (r < 0.42) return NODE_TYPES.TRAINER;
  if (r < 0.52) return state.nuzlockeMode ? NODE_TYPES.BATTLE : NODE_TYPES.CATCH;
  if (r < 0.65) return NODE_TYPES.ITEM;
  if (r < (hasShinyCharm() ? 0.79 : 0.72)) return 'shiny';
  return 'mega';
}

// ---- Node Handlers ----

// Returns a level scaled to the node's layer (layer 1 = map min, layer 6 = map max).
function getLevelForNode(node) {
  const [minL, maxL] = MAP_LEVEL_RANGES[state.currentMap];
  const t = Math.min(1, Math.max(0, (node.layer - 1) / 5)); // 0.0 at layer 1, 1.0 at layer 6
  const base = Math.round(minL + t * (maxL - minL));
  const spread = Math.max(1, Math.round((maxL - minL) / 8));
  return Math.min(maxL, Math.max(minL, base + Math.floor(rng() * spread)));
}

async function doBattleNode(node) {
  const level = state.currentMap >= 1 ? getLevelForNode(node) - 1 : getLevelForNode(node);
  let choices = await getCatchChoices(state.currentMap);

  // On the first layer of the first map, exclude enemies super effective against the starter
  if (state.currentMap === 0 && node.layer === 1 && state.team.length > 0) {
    const starterTypes = state.team[0].types || [];
    const isSafe = sp => !(sp.types || []).some(et =>
      starterTypes.some(st => (TYPE_CHART[et]?.[st] || 1) >= 2)
    );
    const safe = choices.filter(isSafe);
    if (safe.length > 0) {
      choices = safe;
    } else {
      // Fallback: Eevee (Normal type, never super effective)
      const eevee = await fetchPokemonById(133);
      if (eevee) choices = [eevee];
    }
  }

  const enemySpecies = choices[Math.floor(rng() * choices.length)];
  if (!enemySpecies) {
    advanceFromNode(state.map, node.id);
    showMapScreen();
    return;
  }
  const enemy = createInstance(enemySpecies, level, false, getMoveТierForMap(state.currentMap));
  const titleEl = document.getElementById('battle-title');
  const subEl = document.getElementById('battle-subtitle');
  if (titleEl) titleEl.textContent = `Wild ${enemy.name} appeared!`;
  if (subEl) subEl.textContent = `Level ${enemy.level}`;
  await runBattleScreen([enemy], false, () => {
    advanceFromNode(state.map, node.id);
    showMapScreen();
  }, () => {
    showGameOver();
  }, null, [], 1); // Wild battles always give 1 level
}

async function doBossNode(node) {
  if (state.currentMap === 8) {
    await doElite4();
    return;
  }
  const leader = GYM_LEADERS[state.currentMap];
  const enemyTeam = leader.team.map(p => ({
    ...createInstance(p, p.level, false, leader.moveTier ?? 1),
    heldItem: p.heldItem || null,
  }));

  showScreen('battle-screen');
  document.getElementById('battle-title').textContent = `Gym Battle vs ${leader.name}!`;
  document.getElementById('battle-subtitle').textContent = `${leader.badge} is on the line!`;
  await runBattleScreen(enemyTeam, true, () => {
    state.badges++;
    advanceFromNode(state.map, node.id);
    showBadgeScreen(leader);
    const ach = unlockAchievement(`gym_${state.currentMap}`);
    if (ach) showAchievementToast(ach);
  }, () => {
    showGameOver();
  }, leader.name);
}

async function doElite4() {
  const bosses = ELITE_4;
  for (let i = state.eliteIndex; i < bosses.length; i++) {
    state.eliteIndex = i;
    const boss = bosses[i];
    const enemyTeam = boss.team.map(p => createInstance(p, p.level, false, 2));

    showScreen('battle-screen');
    document.getElementById('battle-title').textContent = `${boss.title}: ${boss.name}!`;
    document.getElementById('battle-subtitle').textContent = i === 4 ? 'Final Battle!' : `Elite Four - Battle ${i+1}/4`;
    const won = await new Promise(resolve => {
      runBattleScreen(enemyTeam, true, () => resolve(true), () => resolve(false), boss.name);
    });

    if (!won) { showGameOver(); return; }
    if (i < bosses.length - 1) {
      await showEliteTransition(boss.name, i + 1);
    }
  }
  const eliteAch = unlockAchievement('elite_four');
  if (eliteAch) showAchievementToast(eliteAch);
  showWinScreen();
}

function showEliteTransition(defeatedName, nextIndex) {
  return new Promise(resolve => {
    const el = document.getElementById('transition-screen');
    if (!el) { resolve(); return; }
    document.getElementById('transition-msg').textContent = `${defeatedName} defeated!`;
    document.getElementById('transition-sub').textContent =
      nextIndex < 4 ? `Next: ${ELITE_4[nextIndex].name}...` : `The Champion awaits!`;
    showScreen('transition-screen');
    setTimeout(() => resolve(), 2000);
  });
}


async function doCatchNode(node) {
  showScreen('catch-screen');
  renderTeamBar(state.team, document.getElementById('catch-team-bar'));
  const choicesEl = document.getElementById('catch-choices');
  choicesEl.innerHTML = '<div class="loading">Finding Pokemon...</div>';

  let choices = await getCatchChoices(state.currentMap);
  const level = (state.currentMap === 0) ? Math.max(4, getLevelForNode(node)) : getLevelForNode(node);

  // Nuzlocke map 1: restrict to curated pool
  if (state.nuzlockeMode && state.currentMap === 0) {
    const nuzlockeMap1Ids = new Set([10,11,27,54,56,60,69,72,74,79,81,86,96,98,100,102,111,116,118,120,129,133]);
    const filtered = choices.filter(sp => nuzlockeMap1Ids.has(sp.id ?? sp.speciesId));
    if (filtered.length > 0) choices = filtered;
  }

  // Map 1, layer 1: guarantee at least one Grass AND one Water Pokemon (non-nuzlocke only)
  if (!state.nuzlockeMode && state.currentMap === 0 && node.layer === 1) {
    const grassIds = [43, 69, 102]; // Oddish, Bellsprout, Exeggcute
    const waterIds = [54, 60, 72, 79, 86, 98, 116, 118, 120, 129];
    if (!choices.some(p => p.types?.includes('Grass'))) {
      const id = grassIds[Math.floor(rng() * grassIds.length)];
      const r = await fetchPokemonById(id);
      if (r) choices[0] = r;
    }
    if (!choices.some(p => p.types?.includes('Water'))) {
      const id = waterIds[Math.floor(rng() * waterIds.length)];
      const r = await fetchPokemonById(id);
      if (r) {
        const slot = choices.findIndex(p => !p.types?.includes('Grass'));
        choices[slot === -1 ? 2 : slot] = r;
      }
    }
  }

  if (state.nuzlockeMode) {
    const teamIds = new Set(state.team.map(p => p.speciesId));
    const filtered = choices.filter(sp => !teamIds.has(sp.id));
    choices = (filtered.length > 0 ? filtered : choices).slice(0, 1);
  }
  const instances = choices.map(sp => createInstance(sp, level, rng() < (hasShinyCharm() ? 0.02 : 0.01), getMoveТierForMap(state.currentMap)));

  choicesEl.innerHTML = '';
  const dex = getPokedex();
  for (const inst of instances) {
    const caught = !!(dex[inst.speciesId]?.caught);
    const wrapper = document.createElement('div');
    wrapper.innerHTML = renderPokemonCard(inst, true, false, caught);
    const card = wrapper.querySelector('.poke-card');
    card.style.cursor = 'pointer';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.addEventListener('click', () => catchPokemon(inst, node));
    card.addEventListener('keydown', e => { if(e.key==='Enter'||e.key===' ') catchPokemon(inst, node); });
    choicesEl.appendChild(card);
  }

  document.getElementById('btn-skip-catch').onclick = () => {
    advanceFromNode(state.map, node.id);
    showMapScreen();
  };
}

function checkDexAchievements() {
  if (isPokedexComplete()) {
    const ach = unlockAchievement('pokedex_complete');
    if (ach) showAchievementToast(ach);
  }
  if (isShinyDexComplete()) {
    const ach = unlockAchievement('shinydex_complete');
    if (ach) showAchievementToast(ach);
  }
}

function catchPokemon(pokemon, node) {
  const normalUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemon.speciesId}.png`;
  markPokedexCaught(pokemon.speciesId, pokemon.name, pokemon.types, normalUrl);
  if (pokemon.isShiny) markShinyDexCaught(pokemon.speciesId, pokemon.name, pokemon.types, pokemon.spriteUrl);
  checkDexAchievements();
  if (state.team.length < 6) {
    state.team.push(pokemon);
    if (state.team.length > state.maxTeamSize) state.maxTeamSize = state.team.length;
    advanceFromNode(state.map, node.id);
    showMapScreen();
  } else {
    showSwapScreen(pokemon, node);
  }
}

function showSwapScreen(newPoke, node) {
  showScreen('swap-screen');
  document.getElementById('swap-incoming').innerHTML = `<div style="display:flex;justify-content:center;">${renderPokemonCard(newPoke, true, false)}</div>`;
  const el = document.getElementById('swap-choices');
  el.innerHTML = '';
  document.getElementById('swap-prompt').textContent = 'Choose a Pokémon to release:';
  for (let i = 0; i < state.team.length; i++) {
    const p = state.team[i];
    const wrapper = document.createElement('div');
    wrapper.innerHTML = renderPokemonCard(p, true, false);
    const card = wrapper.querySelector('.poke-card');
    card.style.cursor = 'pointer';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    const idx = i;
    card.addEventListener('click', () => {
      if (newPoke.isShiny) markShinyDexCaught(newPoke.speciesId, newPoke.name, newPoke.types, newPoke.spriteUrl);
      const released = state.team[idx];
      if (released.heldItem) state.items.push(released.heldItem);
      state.team.splice(idx, 1, newPoke);
      advanceFromNode(state.map, node.id);
      showMapScreen();
    });
    el.appendChild(card);
  }
  document.getElementById('btn-cancel-swap').onclick = () => {
    advanceFromNode(state.map, node.id);
    showMapScreen();
  };
}

function doItemNode(node) {
  showScreen('item-screen');
  renderTeamBar(state.team, document.getElementById('item-team-bar'));

  // Exclude held-type items already in bag or on a Pokemon (usable items can stack)
  const usedIds = new Set([
    ...state.items.filter(it => !it.usable).map(it => it.id),
    ...state.team.filter(p => p.heldItem).map(p => p.heldItem.id),
  ]);
  const heldAvailable = ITEM_POOL.filter(it =>
    !usedIds.has(it.id) && (it.minMap === undefined || state.currentMap >= it.minMap)
  );

  // Usable items: filter out ones that can't be applied to current team
  const canUseMaxRevive = state.team.some(p => p.currentHp <= 0);
  const canUseEvoStone  = state.team.some(p => {
    if (p.speciesId === 133) return true;
    const evo = GEN1_EVOLUTIONS[p.speciesId];
    return evo && evo.into !== p.speciesId;
  });
  const usableAvailable = USABLE_ITEM_POOL.filter(it => {
    if (it.id === 'max_revive') return canUseMaxRevive;
    if (it.id === 'moon_stone')  return canUseEvoStone;
    return true;
  });

  const available = [...heldAvailable, ...usableAvailable];
  const shuffled = [...available].sort(() => rng() - 0.5);
  const picks = shuffled.slice(0, 3);

  const el = document.getElementById('item-choices');
  el.innerHTML = '';
  for (const item of picks) {
    const div = document.createElement('div');
    div.className = 'item-card';
    div.innerHTML = `<div class="item-icon">${itemIconHtml(item, 36)}</div>
      <div class="item-name">${item.name}</div>
      <div class="item-desc">${item.desc}</div>
      ${item.usable ? '<div style="font-size:9px;color:#4af;margin-top:4px;">USABLE ITEM</div>' : ''}`;
    div.style.cursor = 'pointer';
    div.addEventListener('click', () => {
      state.pickedUpItem = true;
      if (item.usable) {
        state.items.push({ ...item });
        advanceFromNode(state.map, node.id);
        showMapScreen();
      } else {
        openItemEquipModal(item, {
          onComplete: () => { advanceFromNode(state.map, node.id); showMapScreen(); },
        });
      }
    });
    el.appendChild(div);
  }

  document.getElementById('btn-skip-item').onclick = () => {
    advanceFromNode(state.map, node.id);
    showMapScreen();
  };
}

function openItemEquipModal(item, { fromBagIdx = -1, fromPokemonIdx = -1, onComplete = null } = {}) {
  document.getElementById('item-equip-modal')?.remove();

  const done = onComplete || (() => {
    renderItemBadges(state.items);
    renderTeamBar(state.team);
  });

  const modal = document.createElement('div');
  modal.id = 'item-equip-modal';
  modal.className = 'item-equip-overlay';

  const rows = state.team.map((p, i) => {
    const isSelf = fromPokemonIdx === i;
    const hasHeld = !!p.heldItem;
    const btnLabel = isSelf ? 'Holding' : hasHeld ? 'Swap' : 'Equip';
    return `<div class="equip-pokemon-row">
      <img src="${p.spriteUrl}" class="equip-poke-sprite" onerror="this.style.display='none'">
      <div class="equip-poke-info">
        <div class="equip-poke-name">${p.nickname || p.name}</div>
        <div class="equip-poke-lv">Lv${p.level}</div>
      </div>
      <div class="equip-held-slot">
        ${hasHeld
          ? `<span class="equip-held-item" title="${p.heldItem.desc}">${itemIconHtml(p.heldItem, 18)} ${p.heldItem.name}</span>`
          : '<span class="equip-empty-slot">— empty —</span>'}
      </div>
      <div class="equip-btn-group">
        ${isSelf
          ? `<button class="equip-btn equip-btn-unequip" data-unequip="${i}">Unequip</button>`
          : `<button class="equip-btn${hasHeld ? ' equip-btn-swap' : ''}" data-idx="${i}">${btnLabel}</button>`}
        ${hasHeld && !isSelf ? `<button class="equip-btn equip-btn-unequip" data-unequip="${i}" title="Unequip ${p.heldItem.name}">×</button>` : ''}
      </div>
    </div>`;
  }).join('');

  modal.innerHTML = `
    <div class="item-equip-box">
      <div class="equip-item-header">
        <span class="equip-item-icon">${itemIconHtml(item, 32)}</span>
        <div>
          <div class="equip-item-name">${item.name}</div>
          <div class="equip-item-desc">${item.desc}</div>
        </div>
      </div>
      <div class="equip-pokemon-list">${rows}</div>
      <button id="btn-equip-to-bag" class="btn-secondary" style="width:100%;margin-top:8px;">
        ${fromPokemonIdx >= 0 ? '⬇ Unequip (return to bag)' : 'Keep in Bag'}
      </button>
      <button id="btn-equip-cancel" class="btn-secondary" style="width:100%;margin-top:4px;">Cancel</button>
    </div>`;

  document.body.appendChild(modal);

  // Unequip buttons — strip item off a Pokemon and bag it, without equipping current item
  modal.querySelectorAll('[data-unequip]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.unequip);
      const pokemon = state.team[idx];
      if (pokemon.heldItem) {
        state.items.push(pokemon.heldItem);
        pokemon.heldItem = null;
      }
      modal.remove();
      done();
    });
  });

  modal.querySelectorAll('button[data-idx]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      const pokemon = state.team[idx];
      const displaced = pokemon.heldItem;

      // Remove item from its source
      if (fromBagIdx >= 0) {
        state.items.splice(fromBagIdx, 1);
        if (displaced) state.items.push(displaced);
      } else if (fromPokemonIdx >= 0) {
        // True swap: give the displaced item back to the source Pokemon
        state.team[fromPokemonIdx].heldItem = displaced || null;
      } else {
        // Brand new item from a node — displaced item goes to bag
        if (displaced) state.items.push(displaced);
      }

      pokemon.heldItem = item;
      modal.remove();
      done();
    });
  });

  modal.querySelector('#btn-equip-to-bag').addEventListener('click', () => {
    if (fromPokemonIdx >= 0) {
      state.team[fromPokemonIdx].heldItem = null;
      state.items.push(item);
    } else if (fromBagIdx < 0) {
      // Brand new item — put in bag
      state.items.push(item);
    }
    // fromBagIdx >= 0 means it's already in bag — do nothing
    modal.remove();
    done();
  });

  modal.querySelector('#btn-equip-cancel').addEventListener('click', () => {
    modal.remove();
  });

}

function openUsableItemModal(item, bagIdx) {
  document.getElementById('usable-item-modal')?.remove();

  const canTarget = p => {
    if (item.id === 'max_revive') return p.currentHp <= 0;
    if (item.id === 'moon_stone') {
      if (p.speciesId === 133) return true;
      const evo = GEN1_EVOLUTIONS[p.speciesId];
      return !!(evo && evo.into !== p.speciesId);
    }
    return true;
  };

  const rows = state.team.map((p, i) => {
    const enabled = canTarget(p);
    const statusText = p.currentHp <= 0 ? 'Fainted' : `${p.currentHp}/${p.maxHp} HP`;
    return `<div class="equip-pokemon-row" data-idx="${i}"
        style="${enabled ? 'cursor:pointer;' : 'opacity:0.4;cursor:default;pointer-events:none;'}">
      <img src="${p.spriteUrl}" class="equip-poke-sprite" onerror="this.style.display='none'">
      <div class="equip-poke-info">
        <div class="equip-poke-name">${p.nickname || p.name}</div>
        <div class="equip-poke-lv">Lv${p.level} — ${statusText}</div>
      </div>
    </div>`;
  }).join('');

  const modal = document.createElement('div');
  modal.id = 'usable-item-modal';
  modal.className = 'item-equip-overlay';
  modal.innerHTML = `
    <div class="item-equip-box">
      <div class="equip-item-header">
        <span class="equip-item-icon">${itemIconHtml(item, 32)}</span>
        <div>
          <div class="equip-item-name">${item.name}</div>
          <div class="equip-item-desc">${item.desc}</div>
        </div>
      </div>
      <div class="equip-pokemon-list">${rows}</div>
      <button id="btn-cancel-use" class="btn-secondary" style="width:100%;margin-top:8px;">Cancel</button>
    </div>`;
  document.body.appendChild(modal);

  modal.querySelector('#btn-cancel-use').addEventListener('click', () => modal.remove());

  modal.querySelectorAll('[data-idx]').forEach(row => {
    if (row.style.pointerEvents === 'none') return;
    row.addEventListener('click', async () => {
      const idx = parseInt(row.dataset.idx);
      const pokemon = state.team[idx];
      modal.remove();
      state.items.splice(bagIdx, 1);

      if (item.id === 'max_revive') {
        pokemon.currentHp = pokemon.maxHp;
        showMapNotification(`${pokemon.nickname || pokemon.name} was revived!`);
        renderItemBadges(state.items);
        renderTeamBar(state.team);

      } else if (item.id === 'rare_candy') {
        for (let i = 0; i < 3; i++) {
          if (pokemon.level < 100) pokemon.level++;
        }
        showMapNotification(`${pokemon.nickname || pokemon.name} grew to Lv ${pokemon.level}!`);
        renderItemBadges(state.items);
        renderTeamBar(state.team);
        await checkAndEvolveTeam();

      } else if (item.id === 'moon_stone') {
        renderItemBadges(state.items);
        await applyEvolution(pokemon);

      }
    });
  });
}

async function applyEvolution(pokemon) {
  let evo;
  if (pokemon.speciesId === 133) {
    evo = await showEeveeChoice(pokemon);
  } else {
    evo = GEN1_EVOLUTIONS[pokemon.speciesId];
    if (!evo) return;
  }

  await playEvoAnimation(pokemon, evo);

  const oldHpRatio = pokemon.currentHp / pokemon.maxHp;
  const newSpecies = await fetchPokemonById(evo.into);

  pokemon.speciesId = evo.into;
  pokemon.name      = evo.name;
  pokemon.spriteUrl = pokemon.isShiny
    ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${evo.into}.png`
    : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${evo.into}.png`;

  if (newSpecies) {
    pokemon.types     = newSpecies.types;
    pokemon.baseStats = newSpecies.baseStats;
    const newMax      = calcHp(newSpecies.baseStats.hp, pokemon.level);
    pokemon.maxHp     = newMax;
    pokemon.currentHp = Math.max(1, Math.floor(oldHpRatio * newMax));
  }

  const normalUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemon.speciesId}.png`;
  markPokedexCaught(pokemon.speciesId, pokemon.name, pokemon.types, normalUrl);
  if (pokemon.isShiny) markShinyDexCaught(pokemon.speciesId, pokemon.name, pokemon.types, pokemon.spriteUrl);
  checkDexAchievements();
  renderItemBadges(state.items);
  renderTeamBar(state.team);
}

function doPokeCenterNode(node) {
  state.usedPokecenter = true;
  for (const p of state.team) p.currentHp = p.maxHp;
  advanceFromNode(state.map, node.id);
  showMapScreen();
  showMapNotification('🏥 Your team was fully healed!');
}

// ---- Trainer Battle Node ----

// Species pools for each trainer archetype (Gen 1 IDs).
// null = use the map's random BST pool instead.
const TRAINER_BATTLE_CONFIG = {
  bugCatcher:  { name: 'Bug Catcher',   sprite: 'bugcatcher',
                 pool: [10,11,12,13,14,15,46,47,48,49,123,127] },
  hiker:       { name: 'Hiker',         sprite: 'hiker',
                 pool: [27,28,50,51,66,67,68,74,75,76,95,111,112] },
  fisher:      { name: 'Fisherman',     sprite: 'fisherman',
                 pool: [54,55,60,61,62,72,73,86,87,90,91,98,99,116,117,118,119,129,130] },
  Scientist:   { name: 'Scientist',     sprite: 'scientist',
                 pool: [81,82,88,89,92,93,94,100,101,137] },
  teamRocket:  { name: 'Rocket Grunt',  sprite: 'teamrocket',
                 pool: [19,20,23,24,41,42,52,53,88,89,109,110] },
  policeman:   { name: 'Officer',       sprite: 'policeman',
                 pool: [58,59] },
  fireSpitter: { name: 'Fire Trainer',  sprite: 'burglar',
                 pool: [4,5,6,37,38,58,59,77,78,126,136] },
  aceTrainer:  { name: 'Ace Trainer',   sprite: 'acetrainer', pool: null },
  oldGuy:      { name: 'Old Man',       sprite: 'gentleman',    pool: null },
};

async function doTrainerNode(node) {
  const key = node.trainerSprite || 'aceTrainer';
  const config = TRAINER_BATTLE_CONFIG[key] || TRAINER_BATTLE_CONFIG.aceTrainer;
  const teamSize = state.currentMap === 0 ? 1 : state.currentMap <= 2 ? 2 : 3;
  const level = getLevelForNode(node);
  const moveTier = getMoveТierForMap(state.currentMap);

  let speciesList;
  if (config.pool) {
    // Dedupe pool, filter out evolved forms the battle level can't reach, then shuffle
    const eligible = [...new Set(config.pool)]
      .filter(id => minLevelForSpecies(id) <= level);
    const pool = eligible.length ? eligible : [...new Set(config.pool)]; // fallback: use full pool
    const shuffled = pool.sort(() => rng() - 0.5);
    const ids = Array.from({ length: teamSize }, (_, i) => shuffled[i % shuffled.length]);
    const fetched = await Promise.all(ids.map(id => fetchPokemonById(id)));
    speciesList = fetched.filter(Boolean);
  } else {
    const choices = await getCatchChoices(state.currentMap);
    speciesList = choices.slice(0, teamSize);
  }

  if (!speciesList.length) { advanceFromNode(state.map, node.id); showMapScreen(); return; }
  const enemyTeam = speciesList.map(sp => createInstance(sp, level, false, moveTier));

  const titleEl = document.getElementById('battle-title');
  const subEl   = document.getElementById('battle-subtitle');
  if (titleEl) titleEl.textContent = `${config.name} wants to battle!`;
  if (subEl)   subEl.textContent   = `${enemyTeam.length} Pokémon — Lv ~${level}`;

  await runBattleScreen(enemyTeam, false, () => {
    advanceFromNode(state.map, node.id);
    showMapScreen();
  }, () => {
    showGameOver();
  }, config.sprite, [], 2, true); // always show player portrait for trainer battles
}

// ---- Legendary Node ----

async function doLegendaryNode(node) {
  const teamLegendIds = state.team.map(p => p.speciesId);
  const available = LEGENDARY_IDS.filter(id => !teamLegendIds.includes(id));
  if (available.length === 0) { advanceFromNode(state.map, node.id); showMapScreen(); return; }
  const legendId = available[Math.floor(rng() * available.length)];
  const species = await fetchPokemonById(legendId);
  if (!species) { advanceFromNode(state.map, node.id); showMapScreen(); return; }

  const level = MAP_LEVEL_RANGES[state.currentMap][1]; // top of map range
  const legendary = createInstance(species, level, rng() < (hasShinyCharm() ? 0.02 : 0.01), 2);

  const titleEl = document.getElementById('battle-title');
  const subEl = document.getElementById('battle-subtitle');
  if (titleEl) titleEl.textContent = `A legendary ${legendary.name} appeared!`;
  if (subEl) subEl.textContent = `Lv ${legendary.level} — Defeat it to add it to your team!`;

  await runBattleScreen([legendary], false, async () => {
    // Win — offer to add legendary to team
    const normalUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${legendary.speciesId}.png`;
    markPokedexCaught(legendary.speciesId, legendary.name, legendary.types, normalUrl);
    if (legendary.isShiny) markShinyDexCaught(legendary.speciesId, legendary.name, legendary.types, legendary.spriteUrl);
    checkDexAchievements();
    if (state.team.length < 6) {
      state.team.push(legendary);
      if (state.team.length > state.maxTeamSize) state.maxTeamSize = state.team.length;
      advanceFromNode(state.map, node.id);
      showMapNotification(`${legendary.name} joined your team!`);
      showMapScreen();
    } else {
      showSwapScreen(legendary, node);
    }
  }, () => {
    showGameOver();
  }, null, [], 0); // Legendary battles give 0 extra levels (already challenging enough)
}

// ---- Move Tutor Node ----

function doMoveTutorNode(node) {
  document.getElementById('item-equip-modal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'item-equip-modal';
  modal.className = 'item-equip-overlay';

  const rows = state.team.map((p, i) => {
    const tier = p.moveTier ?? 1;
    const maxed = tier >= 2;
    const currentMove = getBestMove(p.types || ['Normal'], p.baseStats, p.speciesId, tier);
    const nextMove = !maxed ? getBestMove(p.types || ['Normal'], p.baseStats, p.speciesId, tier + 1) : null;
    const tierLabel = ['Tier 1', 'Tier 2', 'Mastered'][tier];
    return `<div class="equip-pokemon-row" style="${maxed ? 'opacity:0.45;' : ''}">
      <img src="${p.spriteUrl}" class="equip-poke-sprite" onerror="this.style.display='none'">
      <div class="equip-poke-info">
        <div class="equip-poke-name">${p.nickname || p.name}</div>
        <div class="equip-poke-lv">Lv${p.level} &bull; ${currentMove.name} (${tierLabel})</div>
      </div>
      <div class="equip-btn-group">
        ${maxed
          ? `<span style="font-size:10px;color:#888;">Already mastered!</span>`
          : `<button class="equip-btn" data-tutor="${i}">→ ${nextMove.name}</button>`}
      </div>
    </div>`;
  }).join('');

  modal.innerHTML = `
    <div class="item-equip-box">
      <div class="equip-item-header">
        <span class="equip-item-icon" style="font-size:28px;">♪</span>
        <div>
          <div class="equip-item-name">Move Tutor</div>
          <div class="equip-item-desc">Teach one Pokémon a more powerful move.</div>
        </div>
      </div>
      <div class="equip-pokemon-list">${rows}</div>
      <button id="btn-skip-tutor" class="btn-secondary" style="width:100%;margin-top:8px;">Skip</button>
    </div>`;

  document.body.appendChild(modal);

  const finish = () => {
    modal.remove();
    advanceFromNode(state.map, node.id);
    showMapScreen();
  };

  modal.querySelectorAll('button[data-tutor]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.tutor);
      const pokemon = state.team[idx];
      pokemon.moveTier = Math.min(2, (pokemon.moveTier ?? 1) + 1);
      const newMove = getBestMove(pokemon.types || ['Normal'], pokemon.baseStats, pokemon.speciesId, pokemon.moveTier);
      modal.remove();
      advanceFromNode(state.map, node.id);
      showMapScreen();
      showMapNotification(`${pokemon.nickname || pokemon.name} learned ${newMove.name}!`);
    });
  });

  modal.querySelector('#btn-skip-tutor').addEventListener('click', finish);
}

// ---- Trade Node ----

async function doTradeNode(node) {
  showScreen('trade-screen');
  document.getElementById('trade-desc').textContent = "Trade one of your Pokémon for a random Pokémon 3 levels higher.";

  const listEl = document.getElementById('trade-team-list');
  listEl.innerHTML = '';

  for (let i = 0; i < state.team.length; i++) {
    const mine = state.team[i];
    const typeBadges = (mine.types || []).map(t =>
      `<span class="type-badge type-${t.toLowerCase()}">${t}</span>`
    ).join('');

    const li = document.createElement('li');
    li.className = 'trade-member-row';
    li.innerHTML = `
      <img class="trade-member-sprite" src="${mine.spriteUrl || ''}" alt="${mine.name}" loading="lazy">
      <div class="trade-member-info">
        <div class="trade-member-name">${mine.nickname || mine.name}</div>
        <div class="trade-member-level">Lv ${mine.level}</div>
        <div class="trade-member-types">${typeBadges}</div>
      </div>
      <div class="trade-member-arrow">→</div>
    `;

    const idx = i;
    const doTrade = async () => {
      const pool = await getCatchChoices(state.currentMap);
      const species = pool[Math.floor(rng() * pool.length)];
      if (!species) { advanceFromNode(state.map, node.id); showMapScreen(); return; }
      const offerLevel = Math.min(100, mine.level + 3);
      const offer = createInstance(species, offerLevel, rng() < (hasShinyCharm() ? 0.02 : 0.01), Math.max(getMoveТierForMap(state.currentMap), mine.moveTier ?? 0));
      const released = state.team[idx];
      if (released.heldItem) state.items.push(released.heldItem);
      state.team.splice(idx, 1, offer);
      const normalUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${offer.speciesId}.png`;
      markPokedexCaught(offer.speciesId, offer.name, offer.types, normalUrl);
      if (offer.isShiny) markShinyDexCaught(offer.speciesId, offer.name, offer.types, offer.spriteUrl);
      checkDexAchievements();
      advanceFromNode(state.map, node.id);

      // Show full-screen reveal
      showScreen('shiny-screen');
      document.getElementById('shiny-content').innerHTML = `
        <div class="shiny-title">You received ${offer.name}!</div>
        <div style="color:var(--text-dim);font-size:10px;margin-bottom:8px;">
          ${released.nickname || released.name} was sent to the trainer.</div>
        ${renderPokemonCard(offer, false, false, false)}
        <button id="btn-trade-continue" class="btn-primary" style="margin-top:12px;">Continue</button>
      `;
      document.getElementById('btn-trade-continue').onclick = () => showMapScreen();
    };

    li.addEventListener('click', doTrade);
    listEl.appendChild(li);
  }

  document.getElementById('btn-skip-trade').onclick = () => {
    advanceFromNode(state.map, node.id);
    showMapScreen();
  };
}

async function doShinyNode(node) {
  const choices = await getCatchChoices(state.currentMap);
  const level = getLevelForNode(node);
  const species = choices[0];
  if (!species) { advanceFromNode(state.map, node.id); showMapScreen(); return; }

  const shiny = createInstance(species, level, true, getMoveТierForMap(state.currentMap));

  const shinyCaught = !!(getShinyDex()[shiny.speciesId]);
  showScreen('shiny-screen');
  document.getElementById('shiny-content').innerHTML = `
    <div class="shiny-title">✨ A Shiny Pokemon appeared!</div>
    ${renderPokemonCard(shiny, false, false, shinyCaught)}
    <button id="btn-take-shiny" class="btn-primary">Take ${shiny.name}!</button>
    <button id="btn-skip-shiny" class="btn-secondary" style="margin-top:6px;">Skip</button>
  `;
  document.getElementById('btn-take-shiny').onclick = () => {
    if (state.team.length < 6) {
      const normalUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${shiny.speciesId}.png`;
      markPokedexCaught(shiny.speciesId, shiny.name, shiny.types, normalUrl);
      markShinyDexCaught(shiny.speciesId, shiny.name, shiny.types, shiny.spriteUrl);
      checkDexAchievements();
      state.team.push(shiny);
      if (state.team.length > state.maxTeamSize) state.maxTeamSize = state.team.length;
      advanceFromNode(state.map, node.id);
      showMapScreen();
    } else {
      showSwapScreen(shiny, node);
    }
  };
  document.getElementById('btn-skip-shiny').onclick = () => {
    advanceFromNode(state.map, node.id);
    showMapScreen();
  };
}


// ---- Battle Screen ----

function runBattleScreen(enemyTeam, isBoss, onWin, onLose, enemyName = null, enemyItems = [], baseGainOverride = null, showPlayerPortrait = null) {
  return new Promise(async resolve => {
    showScreen('battle-screen');
    const showPlayer = showPlayerPortrait !== null ? showPlayerPortrait : !!(isBoss || enemyName);
    renderTrainerIcons(state.trainer, enemyName || null, showPlayer);

    const pTeamCopy = state.team.map(p => ({ ...p }));
    // enemyTeam HP init (runBattle will deep-copy, but we need initial state for animation)
    const eTeamInit = enemyTeam.map(p => ({
      ...p,
      currentHp: p.currentHp !== undefined ? p.currentHp : calcHp(p.baseStats.hp, p.level),
      maxHp: p.maxHp !== undefined ? p.maxHp : calcHp(p.baseStats.hp, p.level),
    }));

    renderBattleField(pTeamCopy, eTeamInit);

    // Pre-compute the full battle result
    const { playerWon, detailedLog, pTeam: resultP, eTeam: resultE, playerParticipants } = runBattle(
      pTeamCopy, enemyTeam, state.items, enemyItems, null
    );

    // Read auto-skip settings
    const settings = getSettings();
    const autoSkip = settings.autoSkipAllBattles || (!isBoss && settings.autoSkipBattles);

    // Set up Skip button
    const skipBtn = document.getElementById('btn-auto-battle');
    skipBtn.disabled = false;
    skipBtn.textContent = 'Skip';
    battleSpeedMultiplier = autoSkip ? SKIP_SPEED : 1;
    skipBtn.style.display = autoSkip ? 'none' : 'block';
    let manuallySkipped = false;
    if (!autoSkip) {
      skipBtn.onclick = () => { battleSpeedMultiplier = SKIP_SPEED; skipBtn.disabled = true; manuallySkipped = true; };
    }

    const continueEl = document.getElementById('btn-continue-battle');
    continueEl.style.display = 'none';
    continueEl.textContent = 'Continue';
    continueEl.disabled = false;

    // Auto-start visual animation
    await animateBattleVisually(detailedLog, pTeamCopy, eTeamInit);

    // Show final HP state after animation
    renderBattleField(resultP, resultE);

    if (playerWon) {
      // Sync battle-result HP onto state team, then apply level gains
      for (let i = 0; i < state.team.length; i++) {
        if (resultP[i]) state.team[i].currentHp = resultP[i].currentHp;
      }
      const maxEnemyLevel = Math.max(...resultE.map(p => p.level));
      const levelUps = applyLevelGain(state.team, state.nuzlockeMode ? [] : state.items, playerParticipants, maxEnemyLevel, state.nuzlockeMode, baseGainOverride);
      const skipAll = autoSkip || manuallySkipped;
      battleSpeedMultiplier = skipAll ? SKIP_SPEED : 1;
      skipBtn.textContent = 'Skip';
      skipBtn.style.display = skipAll ? 'none' : 'block';
      if (!skipAll) {
        skipBtn.disabled = false;
        skipBtn.onclick = () => { battleSpeedMultiplier = SKIP_SPEED; skipBtn.disabled = true; manuallySkipped = true; };
      }

      const continueBtn = document.getElementById('btn-continue-battle');
      if (!skipAll) {
        continueBtn.style.display = 'block';
        continueBtn.onclick = () => { battleSpeedMultiplier = 1000; manuallySkipped = true; continueBtn.disabled = true; };
      }

      await animateLevelUp(levelUps);
      skipBtn.style.display = 'none';
      await checkAndEvolveTeam();

      // Nuzlocke: remove fainted Pokemon permanently, return their items to bag
      if (state.nuzlockeMode) {
        const fainted = state.team.filter(p => p.currentHp <= 0);
        for (const p of fainted) {
          if (p.heldItem) state.items.push(p.heldItem);
        }
        state.team = state.team.filter(p => p.currentHp > 0);
        if (fainted.length > 0) { renderTeamBar(state.team); renderItemBadges(state.items); }
        if (state.team.length === 0) {
          showGameOver();
          resolve(false);
          return;
        }
      }

      if (skipAll || manuallySkipped) {
        if (onWin) onWin();
        resolve(true);
      } else {
        continueBtn.disabled = false;
        continueBtn.onclick = () => { if (onWin) onWin(); resolve(true); };
      }
    } else {
      skipBtn.style.display = 'none';
      document.getElementById('btn-continue-battle').style.display = 'block';
      document.getElementById('btn-continue-battle').textContent = 'Continue...';
      document.getElementById('btn-continue-battle').onclick = () => {
        if (onLose) onLose();
        resolve(false);
      };
    }
  });
}

// ---- End Screens ----

function showBadgeScreen(leader) {
  showScreen('badge-screen');
  document.getElementById('badge-msg').textContent = `You earned the ${leader.badge}!`;
  document.getElementById('badge-leader').textContent = '';
  document.getElementById('badge-count-display').textContent = `Badges: ${state.badges}/8`;
  const badgeImg = document.getElementById('badge-icon-img');
  if (badgeImg) badgeImg.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/${state.badges}.png`;

  document.getElementById('btn-next-map').onclick = () => {
    if (state.currentMap >= 7) {
      state.eliteIndex = 0;
      startMap(8);
    } else {
      startMap(state.currentMap + 1);
    }
  };
}

function showGameOver() {
  localStorage.setItem('poke_last_run_won', 'false');
  clearSavedRun();
  if (typeof syncToCloud === 'function') syncToCloud();
  initGame();
}

function showWinScreen() {
  showScreen('win-screen');
  document.getElementById('win-team').innerHTML = state.team.map(p =>
    renderPokemonCard(p, false, false)).join('');
  document.getElementById('btn-play-again').onclick = startNewRun;

  // Track elite four wins
  const wins = incrementEliteWins();
  saveHallOfFameEntry(state.team, wins, state.nuzlockeMode);
  const winsEl = document.getElementById('win-run-count');
  if (winsEl) winsEl.textContent = `Championship #${wins}`;
  if (wins === 10) {
    const ach = unlockAchievement('elite_10');
    if (ach) setTimeout(() => showAchievementToast(ach), 3000);
  }
  if (wins === 100) {
    const ach = unlockAchievement('elite_100');
    if (ach) setTimeout(() => showAchievementToast(ach), 3000);
  }

  // Starter line achievement
  const sid = state.starterSpeciesId;
  const starterAchId = [1,2,3].includes(sid) ? 'starter_1'
    : [4,5,6].includes(sid) ? 'starter_4'
    : [7,8,9].includes(sid) ? 'starter_7' : null;
  if (starterAchId) {
    const ach = unlockAchievement(starterAchId);
    if (ach) setTimeout(() => showAchievementToast(ach), 600);
  }

  // Solo run achievement
  if (state.maxTeamSize === 1) {
    const ach = unlockAchievement('solo_run');
    if (ach) setTimeout(() => showAchievementToast(ach), 1400);
  }

  // Hard mode win achievement
  if (state.nuzlockeMode) {
    const ach = unlockAchievement('nuzlocke_win');
    if (ach) setTimeout(() => showAchievementToast(ach), 2200);
  }

  // All 3 legendary birds on team
  const birdIds = [144, 145, 146];
  if (birdIds.every(id => state.team.some(p => p.speciesId === id))) {
    const ach = unlockAchievement('three_birds');
    if (ach) setTimeout(() => showAchievementToast(ach), 800);
  }

  // No Pokémon Center used
  if (!state.usedPokecenter) {
    const ach = unlockAchievement('no_pokecenter');
    if (ach) setTimeout(() => showAchievementToast(ach), 1000);
  }

  // No items picked up
  if (!state.pickedUpItem) {
    const ach = unlockAchievement('no_items');
    if (ach) setTimeout(() => showAchievementToast(ach), 1200);
  }

  // 4 of 6 Pokémon share a type
  if (state.team.length === 6) {
    const typeCounts = {};
    for (const p of state.team) {
      for (const t of p.types) {
        typeCounts[t] = (typeCounts[t] || 0) + 1;
      }
    }
    if (Object.values(typeCounts).some(c => c >= 4)) {
      const ach = unlockAchievement('type_quartet');
      if (ach) setTimeout(() => showAchievementToast(ach), 1600);
    }
  }

  // Full team of shinies
  if (state.team.length >= 3 && state.team.every(p => p.isShiny)) {
    const ach = unlockAchievement('all_shiny_win');
    if (ach) setTimeout(() => showAchievementToast(ach), 2000);
  }

  // Back-to-back wins
  const lastWon = localStorage.getItem('poke_last_run_won') === 'true';
  localStorage.setItem('poke_last_run_won', 'true');
  if (lastWon) {
    const ach = unlockAchievement('back_to_back');
    if (ach) setTimeout(() => showAchievementToast(ach), 2400);
  }

  clearSavedRun();
  if (typeof syncToCloud === 'function') syncToCloud();
}

// ---- Boot ----
window.addEventListener('DOMContentLoaded', initGame);
