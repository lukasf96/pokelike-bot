// ui.js - Screen transitions and UI helpers

// Speed multiplier for battle animation (1 = normal, SKIP_SPEED = fast/skip)
const SKIP_SPEED = 3;
let battleSpeedMultiplier = 1;

let _hoverEnabled = true;
document.addEventListener('mousemove', () => { _hoverEnabled = true; }, { capture: true, passive: true });

const _itemTooltip = (() => {
  let el = null;
  const get = () => el || (el = document.getElementById('item-tooltip'));
  return {
    show(text, x, y) { const t = get(); if (!t) return; t.textContent = text; t.style.left = x + 'px'; t.style.top = y + 'px'; t.classList.add('visible'); },
    hide() { const t = get(); if (t) t.classList.remove('visible'); },
  };
})();

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const s = document.getElementById(id);
  if (s) s.classList.add('active');
  const tt = document.getElementById('map-node-tooltip');
  if (tt) tt.classList.remove('visible');
  _itemTooltip.hide();
  _hoverEnabled = false;
}

function hpBarColor(pct) {
  if (pct > 0.5) return '#00FF4A';
  if (pct > 0.1) return '#EAFF00';
  return '#FF0000';
}

function renderHpBar(current, max) {
  const pct = Math.max(0, current / max);
  const color = hpBarColor(pct);
  return `<div class="hp-bar-bg"><div class="hp-bar-fill" style="width:${Math.floor(pct*100)}%;background:${color}"><div class="hp-bar-shadow"></div></div></div>
          <span class="hp-text">${Math.max(0,current)}/${max}</span>`;
}

function renderPokemonCard(pokemon, onClick, selected, dexCaught = false) {
  const pct = pokemon.currentHp / pokemon.maxHp;
  const typeHtml = (pokemon.types || ['???']).map(t =>
    `<span class="type-badge type-${t.toLowerCase()}">${t}</span>`
  ).join('');
  const move = getMoveForPokemon(pokemon);
  const catClass = move.isSpecial ? 'move-cat-special' : 'move-cat-physical';
  const catLabel = move.isSpecial ? 'Special' : 'Physical';
  const moveTypeClass = move.type ? `type-${move.type.toLowerCase()}` : '';
  return `<div class="poke-card${selected?' selected':''}" ${onClick?`role="button" tabindex="0"`:''}">
    <div class="poke-sprite-wrap">
      <img src="${pokemon.spriteUrl || ''}" alt="${pokemon.name}" class="poke-sprite${pokemon.isShiny?' shiny':''}"
           onerror="this.src='';this.style.display='none'">
      ${pokemon.isShiny ? '<span class="shiny-badge">★ Shiny</span>' : ''}
      ${dexCaught ? '<img class="dex-caught-badge" src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png" alt="Caught" title="Already in Pokédex">' : ''}
    </div>
    <div class="poke-name">${pokemon.nickname || pokemon.name}</div>
    <div class="poke-level">Lv. ${pokemon.level}</div>
    <div class="poke-types">${typeHtml}</div>
    <div class="poke-stats">
      HP: ${pokemon.baseStats.hp} | ATK: ${pokemon.baseStats.atk} | DEF: ${pokemon.baseStats.def}<br>
      SPD: ${pokemon.baseStats.speed} | SP.ATK: ${pokemon.baseStats.special ?? '—'} | SP.DEF: ${pokemon.baseStats.spdef ?? pokemon.baseStats.special ?? '—'}
    </div>
    <div class="poke-hp">${renderHpBar(pokemon.currentHp, pokemon.maxHp)}</div>
    <div class="poke-move">
      <div class="move-name">${move.name}</div>
      <div class="move-header">
        <span class="move-cat-badge ${catClass}">${catLabel}</span>
        <span class="type-badge ${moveTypeClass}">${move.type}</span>
        ${!move.noDamage ? `<span class="move-power-badge">${move.power} PWR</span>` : ''}
      </div>
    </div>
  </div>`;
}

// ---- Team hover card popup ----
function showTeamHoverCard(pokemon, anchorEl) {
  const popup = document.getElementById('team-hover-card');
  if (!popup) return;
  popup.innerHTML = renderPokemonCard(pokemon, false, false);
  popup.style.display = 'block';

  const rect = anchorEl.getBoundingClientRect();
  const popupW = popup.offsetWidth || 200;
  const popupH = popup.offsetHeight || 300;

  // Prefer below, fall back to above
  let top = rect.bottom + 6;
  if (top + popupH > window.innerHeight - 8) top = rect.top - popupH - 6;

  // Clamp horizontally
  let left = rect.left;
  if (left + popupW > window.innerWidth - 8) left = window.innerWidth - popupW - 8;
  if (left < 8) left = 8;

  popup.style.left = left + 'px';
  popup.style.top  = top + 'px';
}

function hideTeamHoverCard() {
  const popup = document.getElementById('team-hover-card');
  if (popup) popup.style.display = 'none';
}

function getMoveForPokemon(pokemon) {
  return getBestMove(pokemon.types || ['Normal'], pokemon.baseStats, pokemon.speciesId, pokemon.moveTier ?? 1);
}

let _dragIdx = null;
let _teamHoverCardDismissListener = null;

function renderTeamBar(team, el) {
  const isMain = !el;
  if (!el) el = document.getElementById('team-bar');
  if (!el) return;
  el.innerHTML = '';

  // On mobile, mouseenter/mouseleave never fire for "leave", so tapping outside
  // the team bar should dismiss the hover card.
  if (isMain && !_teamHoverCardDismissListener) {
    _teamHoverCardDismissListener = (e) => {
      const popup  = document.getElementById('team-hover-card');
      const teamBar = document.getElementById('team-bar');
      if (!popup || popup.style.display === 'none') return;
      if (!popup.contains(e.target) && !teamBar?.contains(e.target)) {
        hideTeamHoverCard();
      }
    };
    document.addEventListener('touchstart', _teamHoverCardDismissListener, { passive: true });
    document.addEventListener('click',      _teamHoverCardDismissListener);
  }

  team.forEach((p, i) => {
    const pct = p.currentHp / p.maxHp;
    const color = hpBarColor(pct);
    const slot = document.createElement('div');
    slot.className = 'team-slot';
    slot.style.cursor = isMain ? 'grab' : 'default';
    slot.innerHTML = `
      <img src="${p.spriteUrl||''}" alt="${p.name}" class="team-sprite" onerror="this.src='';this.style.display='none'">
      <div class="team-slot-name">${p.nickname||p.name}</div>
      <div class="team-slot-lv">Lv${p.level}</div>
      <div class="hp-bar-bg sm"><div class="hp-bar-fill" style="width:${Math.floor(pct*100)}%;background:${color}"></div></div>
      ${p.heldItem ? `<div class="team-slot-item">${itemIconHtml(p.heldItem, 16)}</div>` : ''}`;
    slot.addEventListener('mouseenter', () => { if (_hoverEnabled) showTeamHoverCard(p, slot); });
    slot.addEventListener('mousemove',  () => { if (_hoverEnabled) showTeamHoverCard(p, slot); });
    slot.addEventListener('mouseleave', () => hideTeamHoverCard());
    if (isMain && p.heldItem) {
      const itemEl = slot.querySelector('.team-slot-item');
      itemEl?.addEventListener('mousemove', e => { if (_hoverEnabled) _itemTooltip.show(`${p.heldItem.name}: ${p.heldItem.desc}`, e.clientX, e.clientY); });
      itemEl?.addEventListener('mouseleave', () => _itemTooltip.hide());
      itemEl?.addEventListener('click', e => {
        e.stopPropagation();
        hideTeamHoverCard();
        openItemEquipModal(p.heldItem, {
          fromPokemonIdx: i,
          onComplete: () => { renderItemBadges(state.items); renderTeamBar(state.team); },
        });
      });
    }
    if (isMain) {
      slot.style.touchAction = 'none';
      slot.addEventListener('pointerdown', (e) => {
        if (e.button !== undefined && e.button !== 0) return;
        if (e.target.closest('.team-slot-item')) return;
        e.preventDefault();
        slot.setPointerCapture(e.pointerId);
        _dragIdx = i;

        const rect = slot.getBoundingClientRect();
        const offsetX = e.clientX - rect.left;
        const offsetY = e.clientY - rect.top;

        const ghost = slot.cloneNode(true);
        ghost.style.cssText = `position:fixed;pointer-events:none;z-index:9999;width:${rect.width}px;opacity:0.85;left:${e.clientX - offsetX}px;top:${e.clientY - offsetY}px;transform:scale(1.05);transition:none;`;
        document.body.appendChild(ghost);
        slot.style.opacity = '0.3';

        const onMove = (ev) => {
          ghost.style.left = (ev.clientX - offsetX) + 'px';
          ghost.style.top  = (ev.clientY - offsetY) + 'px';
          document.querySelectorAll('.team-slot-dragover').forEach(s => s.classList.remove('team-slot-dragover'));
          const target = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.team-slot');
          if (target && target !== slot) target.classList.add('team-slot-dragover');
        };

        const cleanup = () => {
          ghost.remove();
          slot.style.opacity = '';
          document.querySelectorAll('.team-slot-dragover').forEach(s => s.classList.remove('team-slot-dragover'));
          _dragIdx = null;
          slot.removeEventListener('pointermove', onMove);
          slot.removeEventListener('pointerup', onUp);
          slot.removeEventListener('pointercancel', cleanup);
        };

        const onUp = (ev) => {
          const target = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.team-slot');
          if (target && target !== slot) {
            const slots = [...el.querySelectorAll('.team-slot')];
            const targetIdx = slots.indexOf(target);
            if (_dragIdx !== null && targetIdx !== -1 && targetIdx !== _dragIdx) {
              [team[_dragIdx], team[targetIdx]] = [team[targetIdx], team[_dragIdx]];
              cleanup();
              renderTeamBar(team);
              return;
            }
          }
          cleanup();
        };

        slot.addEventListener('pointermove', onMove);
        slot.addEventListener('pointerup', onUp);
        slot.addEventListener('pointercancel', cleanup);
      });
    }
    el.appendChild(slot);
  });
}

function renderItemBadges(items) {
  const el = document.getElementById('item-bar');
  if (!el) return;
  el.innerHTML = '';
  if (items.length === 0) {
    el.innerHTML = '<span style="color:var(--text-dim);font-size:10px;">Bag empty</span>';
    return;
  }
  items.forEach((it, idx) => {
    const span = document.createElement('span');
    span.className = 'item-badge';
    span.innerHTML = `${itemIconHtml(it, 18)} ${it.name}`;
    span.style.cursor = 'pointer';
    span.addEventListener('mousemove', e => { if (_hoverEnabled) _itemTooltip.show(it.desc, e.clientX, e.clientY); });
    span.addEventListener('mouseleave', () => _itemTooltip.hide());

    span.addEventListener('click', () => {
      if (it.usable) {
        openUsableItemModal(it, idx);
      } else {
        openItemEquipModal(it, {
          fromBagIdx: idx,
          onComplete: () => { renderItemBadges(state.items); renderTeamBar(state.team); },
        });
      }
    });

    el.appendChild(span);
  });
}


// Render battlefield — first alive pokemon on each side starts as active
function renderBattleField(pTeam, eTeam) {
  const pEl = document.getElementById('player-side');
  const eEl = document.getElementById('enemy-side');
  const pActiveIdx = pTeam.findIndex(p => p.currentHp > 0);
  const eActiveIdx = eTeam.findIndex(p => p.currentHp > 0);

  if (pEl) {
    pEl.innerHTML = pTeam.map((p, i) => {
      const fainted = p.currentHp <= 0;
      const active  = i === pActiveIdx;
      return `<div class="battle-pokemon ${fainted?'fainted':''} ${active?'active-pokemon':''}" data-idx="${i}">
        <div class="battle-poke-name">${p.nickname||p.name} Lv${p.level}</div>
        <div class="poke-hp">${renderHpBar(p.currentHp, p.maxHp)}</div>
        <img src="ui/battleBase.png" class="battle-base" alt="">
        <img src="${p.spriteUrl||''}" alt="${p.name}" class="battle-sprite" onerror="this.src=''">
      </div>`;
    }).join('');
  }
  if (eEl) {
    eEl.innerHTML = eTeam.map((p, i) => {
      const fainted = p.currentHp <= 0;
      const active  = i === eActiveIdx;
      return `<div class="battle-pokemon ${fainted?'fainted':''} ${active?'active-pokemon':''}" data-idx="${i}">
        <div class="battle-poke-name">${p.name} Lv${p.level}</div>
        <div class="poke-hp">${renderHpBar(p.currentHp, p.maxHp)}</div>
        <img src="ui/battleBase.png" class="battle-base" alt="">
        <img src="${p.spriteUrl||''}" alt="${p.name}" class="battle-sprite" onerror="this.src=''">
      </div>`;
    }).join('');
  }
}

// Animate HP bar from fromHp to toHp smoothly
function animateHpBar(containerEl, fromHp, toHp, maxHp, duration = 250) {
  return new Promise(resolve => {
    const fillEl = containerEl.querySelector('.hp-bar-fill');
    const textEl = containerEl.querySelector('.hp-text');
    if (!fillEl) { resolve(); return; }

    const fromPct = Math.max(0, fromHp / maxHp);
    const toPct = Math.max(0, toHp / maxHp);
    const scaledDuration = duration / battleSpeedMultiplier;
    const start = performance.now();

    function frame(now) {
      const elapsed = now - start;
      const t = Math.min(elapsed / scaledDuration, 1);
      const curPct = fromPct + (toPct - fromPct) * t;
      const curHp = Math.round(fromHp + (toHp - fromHp) * t);

      fillEl.style.width = `${Math.floor(curPct * 100)}%`;
      fillEl.style.background = hpBarColor(curPct);
      if (textEl) textEl.textContent = `${Math.max(0, curHp)}/${maxHp}`;

      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        resolve();
      }
    }

    requestAnimationFrame(frame);
  });
}

// ─── Attack particle animations ──────────────────────────────────────────────

// ---- Move Animations ----

const TYPE_COLORS_RGB = {
  normal:'200,200,200', fire:'255,120,30', water:'60,140,255',
  electric:'255,220,0', grass:'50,200,50', ice:'150,220,255',
  fighting:'220,60,30', poison:'160,60,220', ground:'180,140,60',
  flying:'130,180,255', psychic:'255,80,180', bug:'100,200,50',
  rock:'160,130,80', ghost:'100,60,180', dragon:'60,80,220',
};

function animCanvas(attackerEl, targetEl) {
  const canvas = document.getElementById('battle-anim-canvas');
  if (!canvas) return null;
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.display = 'block';
  const ctx = canvas.getContext('2d');
  const aR = attackerEl.getBoundingClientRect();
  const tR = targetEl.getBoundingClientRect();
  const from = { x: aR.left + aR.width/2,  y: aR.top  + aR.height/2 };
  const to   = { x: tR.left + tR.width/2,  y: tR.top  + tR.height/2 };
  return { canvas, ctx, from, to };
}

function runCanvas(canvas, ctx, duration, drawFn) {
  return new Promise(resolve => {
    const scaledDuration = duration / battleSpeedMultiplier;
    const start = performance.now();
    function frame(now) {
      const t = Math.min((now - start) / scaledDuration, 1);
      try {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.shadowColor = 'rgba(255,255,255,0.9)';
        ctx.shadowBlur = 6;
        drawFn(ctx, t);
      } catch(e) {
        canvas.style.display = 'none';
        resolve();
        return;
      }
      if (t < 1) requestAnimationFrame(frame);
      else { ctx.clearRect(0, 0, canvas.width, canvas.height); canvas.style.display = 'none'; resolve(); }
    }
    requestAnimationFrame(frame);
  });
}

function runParticleCanvas(canvas, ctx, particles, duration) {
  return new Promise(resolve => {
    const scaledDuration = duration / battleSpeedMultiplier;
    const start = performance.now();
    function frame(now) {
      const elapsed = now - start;
      const scaledElapsed = elapsed * battleSpeedMultiplier;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.shadowColor = 'rgba(255,255,255,0.9)';
      ctx.shadowBlur = 6;
      let anyAlive = false;
      for (const p of particles) { p.tick(scaledElapsed); if (p.alive) { p.draw(ctx); anyAlive = true; } }
      if (elapsed < scaledDuration || anyAlive) requestAnimationFrame(frame);
      else { ctx.clearRect(0, 0, canvas.width, canvas.height); canvas.style.display = 'none'; resolve(); }
    }
    requestAnimationFrame(frame);
  });
}

// --- Physical move animations ---

function animBodySlam(canvas, ctx, from, to) {
  return runCanvas(canvas, ctx, 400, (ctx, t) => {
    // Rush streak
    if (t < 0.4) {
      const st = t / 0.4;
      const ex = lerp(from.x, to.x, st), ey = lerp(from.y, to.y, st);
      const g = ctx.createLinearGradient(from.x, from.y, ex, ey);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,0.7)');
      ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(ex, ey);
      ctx.strokeStyle = g; ctx.lineWidth = 8; ctx.stroke();
    } else {
      // Squish oval impact
      const it = (t - 0.4) / 0.6;
      const a = 1 - it;
      ctx.save(); ctx.translate(to.x, to.y);
      ctx.scale(1 + it * 0.8, 1 - it * 0.5);
      ctx.beginPath(); ctx.arc(0, 0, 30 * (1 - it * 0.3), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(220,220,220,${a * 0.5})`; ctx.fill();
      ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = 3; ctx.stroke();
      ctx.restore();
      // Stars
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2; const r = it * 40;
        ctx.beginPath(); ctx.arc(to.x + Math.cos(ang)*r, to.y + Math.sin(ang)*r, 3*(1-it), 0, Math.PI*2);
        ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.fill();
      }
    }
  });
}

function animFirePunch(canvas, ctx, from, to) {
  return runCanvas(canvas, ctx, 380, (ctx, t) => {
    if (t < 0.35) {
      const st = t / 0.35;
      const ex = lerp(from.x, to.x, st), ey = lerp(from.y, to.y, st);
      // Fiery fist trail
      for (let i = 0; i < 5; i++) {
        const bt = Math.max(0, st - i*0.06);
        const bx = lerp(from.x, to.x, bt), by = lerp(from.y, to.y, bt);
        const a = (1 - i/5) * st;
        ctx.beginPath(); ctx.arc(bx, by, 8 - i, 0, Math.PI*2);
        ctx.fillStyle = `rgba(255,${120-i*20},0,${a})`; ctx.fill();
      }
    } else {
      const it = (t - 0.35) / 0.65;
      const a = 1 - it;
      // Fire burst
      for (let i = 0; i < 8; i++) {
        const ang = (i/8)*Math.PI*2; const r = it * 55;
        const px = to.x + Math.cos(ang)*r, py = to.y + Math.sin(ang)*r;
        const g = ctx.createRadialGradient(px, py, 0, px, py, 12*(1-it*0.5));
        g.addColorStop(0, `rgba(255,240,100,${a})`);
        g.addColorStop(0.5, `rgba(255,120,0,${a*0.8})`);
        g.addColorStop(1, `rgba(200,30,0,0)`);
        ctx.beginPath(); ctx.arc(px, py, 12*(1-it*0.5), 0, Math.PI*2);
        ctx.fillStyle = g; ctx.fill();
      }
      ctx.beginPath(); ctx.arc(to.x, to.y, 25*(1-it*0.7), 0, Math.PI*2);
      ctx.fillStyle = `rgba(255,200,50,${a*0.6})`; ctx.fill();
    }
  });
}

function animWaterfall(canvas, ctx, from, to) {
  return runCanvas(canvas, ctx, 500, (ctx, t) => {
    if (t < 0.5) {
      // Water column falling from above onto target
      const st = t / 0.5;
      const startY = to.y - 100;
      const curY = lerp(startY, to.y, st);
      const w = 20 + st * 10;
      const g = ctx.createLinearGradient(to.x, startY, to.x, curY);
      g.addColorStop(0, 'rgba(200,230,255,0.9)');
      g.addColorStop(0.6, 'rgba(100,180,255,0.7)');
      g.addColorStop(1, 'rgba(60,140,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(to.x - w/2, startY, w, curY - startY);
      // Foam at the falling tip
      ctx.beginPath(); ctx.ellipse(to.x, curY, w/2+5, 8, 0, 0, Math.PI*2);
      ctx.fillStyle = `rgba(220,240,255,${st*0.9})`; ctx.fill();
    } else {
      const it = (t - 0.5) / 0.5;
      const a = 1 - it;
      // Splash at target
      for (let i = 0; i < 8; i++) {
        const ang = (i/8)*Math.PI*2 - Math.PI/2; const r = it * 45;
        ctx.beginPath(); ctx.moveTo(to.x, to.y);
        ctx.lineTo(to.x + Math.cos(ang)*r, to.y + Math.sin(ang)*r*0.7);
        ctx.strokeStyle = `rgba(100,180,255,${a})`; ctx.lineWidth = 3; ctx.stroke();
      }
      ctx.beginPath(); ctx.ellipse(to.x, to.y, it*35, it*15, 0, 0, Math.PI*2);
      ctx.strokeStyle = `rgba(60,140,255,${a})`; ctx.lineWidth = 2; ctx.stroke();
    }
  });
}

function animThunderPunch(canvas, ctx, from, to) {
  return runCanvas(canvas, ctx, 350, (ctx, t) => {
    if (t < 0.35) {
      const st = t / 0.35;
      const ex = lerp(from.x, to.x, st), ey = lerp(from.y, to.y, st);
      // Electric trail
      const segs = 8; const pts = [{x:from.x,y:from.y}];
      for (let i=1; i<segs; i++) {
        const bt = i/segs * st;
        pts.push({x:lerp(from.x,to.x,bt)+rnd(-8,8), y:lerp(from.y,to.y,bt)+rnd(-8,8)});
      }
      pts.push({x:ex,y:ey});
      ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
      for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.strokeStyle = `rgba(255,240,50,${st*0.9})`; ctx.lineWidth = 3;
      ctx.shadowColor='rgba(255,255,0,0.8)'; ctx.shadowBlur=10; ctx.stroke(); ctx.shadowBlur=0;
    } else {
      const it = (t-0.35)/0.65; const a = 1-it;
      // Star burst
      for (let i=0; i<8; i++) {
        const ang = i/8*Math.PI*2; const r = it*50;
        ctx.beginPath(); ctx.moveTo(to.x,to.y); ctx.lineTo(to.x+Math.cos(ang)*r, to.y+Math.sin(ang)*r);
        ctx.strokeStyle=`rgba(255,255,100,${a})`; ctx.lineWidth=2+a*2; ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(to.x,to.y,20*(1-it),0,Math.PI*2);
      ctx.fillStyle=`rgba(255,255,200,${a*0.7})`; ctx.fill();
    }
  });
}

function animRazorLeaf(canvas, ctx, from, to) {
  // 3 leaves flying to target in spread
  const leaves = [-15, 0, 15].map(offset => ({
    ox: offset, oy: rnd(-5,5),
    alive: true, age: 0,
    tick(ms) { this.age = ms; this.alive = ms < 500; },
    draw(ctx) {
      const t = Math.min(this.age/500, 1);
      const px = lerp(from.x, to.x+this.ox, t);
      const py = lerp(from.y, to.y+this.oy, t) - Math.sin(t*Math.PI)*20;
      const ang = Math.atan2(to.y+this.oy-from.y, to.x+this.ox-from.x) + Math.sin(t*Math.PI*4)*0.3;
      const a = t < 0.8 ? 1 : 1-(t-0.8)/0.2;
      ctx.save(); ctx.translate(px,py); ctx.rotate(ang);
      ctx.beginPath();
      ctx.ellipse(0,0,10,4,0,0,Math.PI*2);
      ctx.fillStyle=`rgba(80,200,40,${a})`; ctx.fill();
      ctx.beginPath(); ctx.moveTo(-10,0); ctx.lineTo(10,0);
      ctx.strokeStyle=`rgba(40,120,20,${a})`; ctx.lineWidth=1; ctx.stroke();
      ctx.restore();
    }
  }));
  return runParticleCanvas(canvas, ctx, leaves, 520);
}

function animIcePunch(canvas, ctx, from, to) {
  return runCanvas(canvas, ctx, 380, (ctx, t) => {
    if (t < 0.35) {
      const st = t/0.35;
      const ex=lerp(from.x,to.x,st), ey=lerp(from.y,to.y,st);
      const g=ctx.createLinearGradient(from.x,from.y,ex,ey);
      g.addColorStop(0,'rgba(150,220,255,0)'); g.addColorStop(1,'rgba(200,240,255,0.8)');
      ctx.beginPath(); ctx.moveTo(from.x,from.y); ctx.lineTo(ex,ey);
      ctx.strokeStyle=g; ctx.lineWidth=6; ctx.stroke();
    } else {
      const it=(t-0.35)/0.65; const a=1-it;
      // Ice crystal shards
      for (let i=0; i<8; i++) {
        const ang=i/8*Math.PI*2; const r=it*45;
        const px=to.x+Math.cos(ang)*r, py=to.y+Math.sin(ang)*r;
        ctx.save(); ctx.translate(px,py); ctx.rotate(ang);
        ctx.beginPath(); ctx.moveTo(0,-6*(1-it*0.5)); ctx.lineTo(4,0); ctx.lineTo(0,6*(1-it*0.5)); ctx.lineTo(-4,0); ctx.closePath();
        ctx.fillStyle=`rgba(180,230,255,${a})`; ctx.fill();
        ctx.restore();
      }
      ctx.beginPath(); ctx.arc(to.x,to.y,20*(1-it*0.5),0,Math.PI*2);
      ctx.strokeStyle=`rgba(200,240,255,${a})`; ctx.lineWidth=2; ctx.stroke();
    }
  });
}

function animCloseCombat(canvas, ctx, from, to) {
  // 3 rapid hits
  return runCanvas(canvas, ctx, 450, (ctx, t) => {
    const hit = Math.min(Math.floor(t * 3), 2); // clamp to 0,1,2
    const ht = (t * 3) % 1;
    const a = ht < 0.5 ? ht*2 : 2-ht*2;
    const offsets = [{x:-12,y:-8},{x:12,y:0},{x:0,y:10}];
    const o = offsets[hit] || offsets[2];
    ctx.beginPath(); ctx.arc(to.x+o.x, to.y+o.y, 18*a, 0, Math.PI*2);
    ctx.fillStyle=`rgba(220,60,30,${a*0.6})`; ctx.fill();
    // Impact lines
    for (let i=0; i<4; i++) {
      const ang=i/4*Math.PI*2; const r=a*25;
      ctx.beginPath(); ctx.moveTo(to.x+o.x, to.y+o.y);
      ctx.lineTo(to.x+o.x+Math.cos(ang)*r, to.y+o.y+Math.sin(ang)*r);
      ctx.strokeStyle=`rgba(255,200,100,${a})`; ctx.lineWidth=2; ctx.stroke();
    }
  });
}

function animPoisonJab(canvas, ctx, from, to) {
  return runCanvas(canvas, ctx, 380, (ctx, t) => {
    if (t < 0.4) {
      const st=t/0.4;
      const ex=lerp(from.x,to.x,st), ey=lerp(from.y,to.y,st);
      const g=ctx.createLinearGradient(from.x,from.y,ex,ey);
      g.addColorStop(0,'rgba(160,60,220,0)'); g.addColorStop(1,'rgba(200,100,255,0.8)');
      ctx.beginPath(); ctx.moveTo(from.x,from.y); ctx.lineTo(ex,ey);
      ctx.strokeStyle=g; ctx.lineWidth=5; ctx.stroke();
    } else {
      const it=(t-0.4)/0.6; const a=1-it;
      // Spike
      const sLen=40*(1-it*0.7);
      ctx.beginPath(); ctx.moveTo(to.x, to.y-sLen); ctx.lineTo(to.x+8,to.y+10); ctx.lineTo(to.x-8,to.y+10); ctx.closePath();
      ctx.fillStyle=`rgba(160,60,220,${a*0.8})`; ctx.fill();
      ctx.strokeStyle=`rgba(220,100,255,${a})`; ctx.lineWidth=1.5; ctx.stroke();
      // Poison drips
      for(let i=0;i<4;i++){
        ctx.beginPath(); ctx.arc(to.x+rnd(-15,15),to.y+it*20+i*8,3*(1-it),0,Math.PI*2);
        ctx.fillStyle=`rgba(160,60,220,${a*0.7})`; ctx.fill();
      }
    }
  });
}

function animEarthquake(canvas, ctx, from, to) {
  // Ground shockwave rings spreading from attacker through target
  return runCanvas(canvas, ctx, 700, (ctx, t) => {
    const rgb='180,140,60';
    // Three rings spreading out
    for(let r=0;r<3;r++) {
      const rt = Math.max(0, t - r*0.15);
      if(rt<=0) continue;
      const radius = rt * 120;
      const a = Math.max(0, 1-rt)*0.7;
      ctx.beginPath(); ctx.ellipse(from.x, from.y+20, radius, radius*0.3, 0, 0, Math.PI*2);
      ctx.strokeStyle=`rgba(${rgb},${a})`; ctx.lineWidth=3-r; ctx.stroke();
    }
    // Ground crack at target
    if(t>0.3) {
      const ct=(t-0.3)/0.7; const a=Math.min(ct*2,1)*(1-ct*0.5);
      ctx.beginPath(); ctx.moveTo(to.x-30*ct,to.y+15); ctx.lineTo(to.x,to.y);ctx.lineTo(to.x+25*ct,to.y+12);
      ctx.strokeStyle=`rgba(120,90,30,${a})`; ctx.lineWidth=3; ctx.stroke();
      // Debris
      for(let i=0;i<5;i++){
        const ang=-Math.PI/2+rnd(-0.8,0.8); const r=ct*30+i*5;
        ctx.beginPath(); ctx.arc(to.x+Math.cos(ang)*r, to.y+Math.sin(ang)*r-ct*15, 3, 0, Math.PI*2);
        ctx.fillStyle=`rgba(160,120,50,${a})`; ctx.fill();
      }
    }
  });
}

function animAerialAce(canvas, ctx, from, to) {
  return runCanvas(canvas, ctx, 300, (ctx, t) => {
    if(t<0.5) {
      // Lightning fast streak
      const st=t/0.5;
      ctx.beginPath(); ctx.moveTo(from.x,from.y);
      ctx.lineTo(lerp(from.x,to.x,st), lerp(from.y,to.y,st));
      ctx.strokeStyle=`rgba(255,255,255,${st*0.9})`; ctx.lineWidth=4; ctx.stroke();
    } else {
      // Three parallel slashes at target
      const it=(t-0.5)/0.5; const a=1-it;
      const ang=Math.atan2(to.y-from.y,to.x-from.x)+Math.PI/2;
      for(let i=-1;i<=1;i++){
        const ox=Math.cos(ang)*i*8, oy=Math.sin(ang)*i*8;
        const d=Math.atan2(to.y-from.y,to.x-from.x);
        ctx.beginPath();
        ctx.moveTo(to.x+ox+Math.cos(d)*-20, to.y+oy+Math.sin(d)*-20);
        ctx.lineTo(to.x+ox+Math.cos(d)*20, to.y+oy+Math.sin(d)*20);
        ctx.strokeStyle=`rgba(255,255,255,${a})`; ctx.lineWidth=2; ctx.stroke();
      }
    }
  });
}

function animZenHeadbut(canvas, ctx, from, to) {
  return runCanvas(canvas, ctx, 420, (ctx, t) => {
    if(t<0.45) {
      // Pink aura charging then rushing
      const st=t/0.45;
      // Glow at attacker fading out
      const ga=Math.max(0,1-st*1.5);
      ctx.beginPath(); ctx.arc(from.x,from.y,20+st*5,0,Math.PI*2);
      ctx.fillStyle=`rgba(255,80,180,${ga*0.4})`; ctx.fill();
      // Rush streak
      const ex=lerp(from.x,to.x,st*0.8), ey=lerp(from.y,to.y,st*0.8);
      const g=ctx.createLinearGradient(from.x,from.y,ex,ey);
      g.addColorStop(0,'rgba(255,80,180,0)'); g.addColorStop(1,`rgba(255,80,180,${st*0.8})`);
      ctx.beginPath(); ctx.moveTo(from.x,from.y); ctx.lineTo(ex,ey);
      ctx.strokeStyle=g; ctx.lineWidth=7; ctx.stroke();
    } else {
      const it=(t-0.45)/0.55; const a=1-it;
      // Pink ring expansion
      ctx.beginPath(); ctx.arc(to.x,to.y,it*50,0,Math.PI*2);
      ctx.strokeStyle=`rgba(255,80,180,${a})`; ctx.lineWidth=4; ctx.stroke();
      ctx.beginPath(); ctx.arc(to.x,to.y,it*30,0,Math.PI*2);
      ctx.strokeStyle=`rgba(255,150,220,${a*0.6})`; ctx.lineWidth=2; ctx.stroke();
    }
  });
}

function animXScissor(canvas, ctx, from, to) {
  return runCanvas(canvas, ctx, 350, (ctx, t) => {
    if(t<0.4) {
      const st=t/0.4;
      const ex=lerp(from.x,to.x,st), ey=lerp(from.y,to.y,st);
      const g=ctx.createLinearGradient(from.x,from.y,ex,ey);
      g.addColorStop(0,'rgba(100,200,50,0)'); g.addColorStop(1,'rgba(100,200,50,0.8)');
      ctx.beginPath(); ctx.moveTo(from.x,from.y); ctx.lineTo(ex,ey);
      ctx.strokeStyle=g; ctx.lineWidth=5; ctx.stroke();
    } else {
      const it=(t-0.4)/0.6; const a=1-it;
      // X slash marks
      const s=30*(1-it*0.3);
      ctx.lineWidth=3; ctx.strokeStyle=`rgba(80,200,40,${a})`;
      ctx.beginPath(); ctx.moveTo(to.x-s,to.y-s); ctx.lineTo(to.x+s,to.y+s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(to.x+s,to.y-s); ctx.lineTo(to.x-s,to.y+s); ctx.stroke();
      ctx.strokeStyle=`rgba(200,255,100,${a*0.5})`;
      ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(to.x-s+2,to.y-s); ctx.lineTo(to.x+s+2,to.y+s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(to.x+s+2,to.y-s); ctx.lineTo(to.x-s+2,to.y+s); ctx.stroke();
    }
  });
}

function animRockSlide(canvas, ctx, from, to) {
  // 3 rocks falling from above target
  const rocks = [
    {ox:-20, delay:0,   size:12},
    {ox: 15, delay:60,  size:10},
    {ox:-5,  delay:120, size:14},
  ].map(r => ({
    ...r, alive:true, age:0,
    tick(ms){this.age=ms; this.alive=ms<600;},
    draw(ctx){
      const t=Math.max(0,(this.age-this.delay)/400);
      if(t<=0) return;
      const py=lerp(to.y-120, to.y, Math.min(t,1));
      const a=t<0.9?1:(1-t)/0.1;
      ctx.save(); ctx.translate(to.x+this.ox, py);
      ctx.rotate(t*2);
      ctx.beginPath();
      ctx.moveTo(0,-this.size); ctx.lineTo(this.size*0.7,this.size*0.5);
      ctx.lineTo(-this.size*0.7,this.size*0.5); ctx.closePath();
      ctx.fillStyle=`rgba(160,130,80,${a})`; ctx.fill();
      ctx.strokeStyle=`rgba(120,90,50,${a})`; ctx.lineWidth=1.5; ctx.stroke();
      ctx.restore();
      // Impact dust
      if(t>=1){
        const dt=Math.min(this.age-this.delay-400,200)/200;
        for(let i=0;i<4;i++){
          ctx.beginPath(); ctx.arc(to.x+this.ox+rnd(-15,15), to.y+rnd(0,10), 4*(1-dt), 0, Math.PI*2);
          ctx.fillStyle=`rgba(160,130,80,${(1-dt)*0.6})`; ctx.fill();
        }
      }
    }
  }));
  return runParticleCanvas(canvas, ctx, rocks, 650);
}

function animShadowClaw(canvas, ctx, from, to) {
  return runCanvas(canvas, ctx, 380, (ctx, t) => {
    if(t<0.4) {
      const st=t/0.4;
      const ex=lerp(from.x,to.x,st), ey=lerp(from.y,to.y,st);
      const g=ctx.createLinearGradient(from.x,from.y,ex,ey);
      g.addColorStop(0,'rgba(100,60,180,0)'); g.addColorStop(1,'rgba(160,100,255,0.7)');
      ctx.beginPath(); ctx.moveTo(from.x,from.y); ctx.lineTo(ex,ey);
      ctx.strokeStyle=g; ctx.lineWidth=5; ctx.stroke();
    } else {
      const it=(t-0.4)/0.6; const a=1-it;
      // 3 curved claw marks
      const s=35*(1-it*0.2);
      for(let i=0;i<3;i++){
        const oy=(i-1)*14;
        ctx.beginPath();
        ctx.moveTo(to.x-s, to.y+oy-s*0.3);
        ctx.quadraticCurveTo(to.x, to.y+oy, to.x+s, to.y+oy+s*0.3);
        ctx.strokeStyle=`rgba(${i===1?'180,120,255':'120,60,200'},${a})`; ctx.lineWidth=2.5; ctx.stroke();
      }
      // Dark aura
      ctx.beginPath(); ctx.arc(to.x,to.y,25*(1-it),0,Math.PI*2);
      ctx.fillStyle=`rgba(60,0,120,${a*0.3})`; ctx.fill();
    }
  });
}

function animDragonClaw(canvas, ctx, from, to) {
  return runCanvas(canvas, ctx, 400, (ctx, t) => {
    if(t<0.4) {
      const st=t/0.4;
      const ex=lerp(from.x,to.x,st), ey=lerp(from.y,to.y,st);
      const g=ctx.createLinearGradient(from.x,from.y,ex,ey);
      g.addColorStop(0,'rgba(60,80,220,0)'); g.addColorStop(1,'rgba(100,140,255,0.9)');
      ctx.beginPath(); ctx.moveTo(from.x,from.y); ctx.lineTo(ex,ey);
      ctx.strokeStyle=g; ctx.lineWidth=7; ctx.stroke();
      ctx.shadowColor='rgba(80,100,255,0.8)'; ctx.shadowBlur=12; ctx.stroke(); ctx.shadowBlur=0;
    } else {
      const it=(t-0.4)/0.6; const a=1-it;
      const s=40*(1-it*0.2);
      // 3 diagonal dragon claw marks
      for(let i=0;i<3;i++){
        const oy=(i-1)*12; const ox=(i-1)*5;
        ctx.beginPath();
        ctx.moveTo(to.x-s+ox,to.y+oy-s*0.5);
        ctx.lineTo(to.x+ox,to.y+oy);
        ctx.lineTo(to.x+s*0.6+ox,to.y+oy+s*0.4);
        ctx.strokeStyle=`rgba(80,120,255,${a})`; ctx.lineWidth=2.5;
        ctx.shadowColor='rgba(60,80,220,0.6)'; ctx.shadowBlur=6; ctx.stroke(); ctx.shadowBlur=0;
      }
      ctx.beginPath(); ctx.arc(to.x,to.y,30*(1-it),0,Math.PI*2);
      ctx.fillStyle=`rgba(60,80,220,${a*0.2})`; ctx.fill();
    }
  });
}

// --- Special move animations ---

function animHyperVoice(canvas, ctx, from, to) {
  // Sound wave rings traveling from attacker to target
  return runCanvas(canvas, ctx, 600, (ctx, t) => {
    const dx=to.x-from.x, dy=to.y-from.y;
    const dist=Math.hypot(dx,dy);
    for(let w=0;w<3;w++) {
      const wt=Math.max(0,t-w*0.15);
      if(wt<=0) continue;
      const progress=wt;
      const cx=from.x+dx*progress, cy=from.y+dy*progress;
      const r=20+wt*10;
      const a=Math.max(0,(1-wt)*0.8);
      ctx.beginPath(); ctx.ellipse(cx,cy,r,r*0.6,Math.atan2(dy,dx),0,Math.PI*2);
      ctx.strokeStyle=`rgba(220,220,220,${a})`; ctx.lineWidth=2+a*2; ctx.stroke();
    }
  });
}

function animSolarBeam(canvas, ctx, from, to) {
  // Phase 1: charge up (golden orb at attacker) | Phase 2: beam fires
  return runCanvas(canvas, ctx, 800, (ctx, t) => {
    if(t<0.5) {
      // Charge orb
      const ct=t/0.5;
      const r=5+ct*20;
      const g=ctx.createRadialGradient(from.x,from.y,0,from.x,from.y,r);
      g.addColorStop(0,'rgba(255,255,200,0.9)');
      g.addColorStop(0.5,'rgba(255,220,0,0.7)');
      g.addColorStop(1,'rgba(255,180,0,0)');
      ctx.beginPath(); ctx.arc(from.x,from.y,r,0,Math.PI*2);
      ctx.fillStyle=g; ctx.fill();
      // Particles gathering
      for(let i=0;i<8;i++){
        const ang=i/8*Math.PI*2+t*3; const r2=30*(1-ct);
        const px=from.x+Math.cos(ang)*r2, py=from.y+Math.sin(ang)*r2;
        ctx.beginPath(); ctx.arc(px,py,2,0,Math.PI*2);
        ctx.fillStyle=`rgba(255,220,50,${ct})`; ctx.fill();
      }
    } else {
      // Fire beam
      const bt=(t-0.5)/0.5;
      const ang=Math.atan2(to.y-from.y,to.x-from.x);
      const bLen=bt*Math.hypot(to.x-from.x,to.y-from.y);
      const bW=12-bt*4;
      ctx.save(); ctx.translate(from.x,from.y); ctx.rotate(ang);
      // Outer glow
      const g=ctx.createLinearGradient(0,0,bLen,0);
      g.addColorStop(0,'rgba(255,255,200,0.9)');
      g.addColorStop(0.7,'rgba(255,220,0,0.7)');
      g.addColorStop(1,'rgba(255,200,0,0)');
      ctx.fillStyle=g;
      ctx.fillRect(0,-bW,bLen,bW*2);
      // Core
      ctx.fillStyle=`rgba(255,255,240,0.95)`;
      ctx.fillRect(0,-bW/3,bLen,bW/1.5);
      ctx.restore();
    }
  });
}

function animAuraSphere(canvas, ctx, from, to) {
  // Pulsing blue orb traveling from attacker to target
  const dx=to.x-from.x, dy=to.y-from.y;
  return runCanvas(canvas, ctx, 550, (ctx, t) => {
    const px=from.x+dx*t, py=from.y+dy*t;
    // Outer aura
    const r=16+Math.sin(t*Math.PI*6)*3;
    const g=ctx.createRadialGradient(px,py,0,px,py,r*1.8);
    g.addColorStop(0,'rgba(100,160,255,0.9)');
    g.addColorStop(0.5,'rgba(60,100,220,0.5)');
    g.addColorStop(1,'rgba(40,60,200,0)');
    ctx.beginPath(); ctx.arc(px,py,r*1.8,0,Math.PI*2);
    ctx.fillStyle=g; ctx.fill();
    // Core
    ctx.beginPath(); ctx.arc(px,py,r*0.6,0,Math.PI*2);
    ctx.fillStyle='rgba(200,230,255,0.95)'; ctx.fill();
    // Trail
    const tLen=Math.min(t,0.3);
    for(let i=0;i<5;i++){
      const tr=i/5*tLen;
      const tx=from.x+dx*(t-tr), ty=from.y+dy*(t-tr);
      const ta=(1-i/5)*0.4;
      ctx.beginPath(); ctx.arc(tx,ty,r*(1-i/5)*0.5,0,Math.PI*2);
      ctx.fillStyle=`rgba(80,130,255,${ta})`; ctx.fill();
    }
    // Impact at end
    if(t>0.85) {
      const it=(t-0.85)/0.15;
      ctx.beginPath(); ctx.arc(to.x,to.y,it*40,0,Math.PI*2);
      ctx.strokeStyle=`rgba(100,160,255,${1-it})`; ctx.lineWidth=3; ctx.stroke();
    }
  });
}

function animSludgeBomb(canvas, ctx, from, to) {
  const dx=to.x-from.x, dy=to.y-from.y;
  return runCanvas(canvas, ctx, 550, (ctx, t) => {
    if(t<0.65) {
      // Blob arc trajectory
      const bt=t/0.65;
      const px=from.x+dx*bt, py=from.y+dy*bt - Math.sin(bt*Math.PI)*50;
      // Wobbling blob
      ctx.save(); ctx.translate(px,py);
      const wobble=Math.sin(bt*Math.PI*8)*0.15;
      ctx.scale(1+wobble, 1-wobble);
      const g=ctx.createRadialGradient(0,0,0,0,0,14);
      g.addColorStop(0,'rgba(180,80,240,0.9)');
      g.addColorStop(0.6,'rgba(140,50,200,0.8)');
      g.addColorStop(1,'rgba(100,20,160,0)');
      ctx.beginPath(); ctx.arc(0,0,14,0,Math.PI*2);
      ctx.fillStyle=g; ctx.fill();
      ctx.restore();
      // Drip trail
      for(let i=1;i<4;i++){
        const tr=i*0.06; const tbt=Math.max(0,bt-tr);
        const tx=from.x+dx*tbt, ty=from.y+dy*tbt-Math.sin(tbt*Math.PI)*50;
        ctx.beginPath(); ctx.arc(tx,ty,6-i,0,Math.PI*2);
        ctx.fillStyle=`rgba(160,60,220,${0.5-i*0.1})`; ctx.fill();
      }
    } else {
      // Splatter
      const it=(t-0.65)/0.35; const a=1-it;
      for(let i=0;i<8;i++){
        const ang=i/8*Math.PI*2; const r=it*40;
        ctx.beginPath(); ctx.ellipse(to.x+Math.cos(ang)*r, to.y+Math.sin(ang)*r*0.6, 5*(1-it*0.5), 3*(1-it*0.5), ang, 0, Math.PI*2);
        ctx.fillStyle=`rgba(160,60,220,${a*0.8})`; ctx.fill();
      }
      ctx.beginPath(); ctx.arc(to.x,to.y,20*(1-it*0.5),0,Math.PI*2);
      ctx.fillStyle=`rgba(140,50,200,${a*0.4})`; ctx.fill();
    }
  });
}

function animEarthPower(canvas, ctx, from, to) {
  return runCanvas(canvas, ctx, 650, (ctx, t) => {
    // Ground cracks at target
    const rgb='180,140,60';
    if(t>0.1) {
      const ct=Math.min((t-0.1)/0.4,1);
      // Radiating cracks
      for(let i=0;i<6;i++){
        const ang=i/6*Math.PI*2; const len=ct*35;
        ctx.beginPath(); ctx.moveTo(to.x,to.y+10);
        ctx.lineTo(to.x+Math.cos(ang)*len, to.y+10+Math.sin(ang)*len*0.5);
        ctx.strokeStyle=`rgba(${rgb},${ct*0.8})`; ctx.lineWidth=2; ctx.stroke();
      }
    }
    // Earth pillars erupting
    if(t>0.3) {
      const pt=(t-0.3)/0.4;
      const pProgress=Math.min(pt,1);
      const pA=pt>0.7?(1-(pt-0.7)/0.3):1;
      // Center pillar
      const pH=50*pProgress;
      const g=ctx.createLinearGradient(to.x,to.y+10,to.x,to.y+10-pH);
      g.addColorStop(0,`rgba(${rgb},0)`);
      g.addColorStop(0.3,`rgba(${rgb},0.8)`);
      g.addColorStop(1,`rgba(200,180,80,${pA*0.9})`);
      ctx.fillStyle=g;
      ctx.fillRect(to.x-8,to.y+10-pH,16,pH);
      // Side pillars
      for(let s=-1;s<=1;s+=2){
        const sH=pH*0.7;
        const sg=ctx.createLinearGradient(to.x+s*20,to.y+10,to.x+s*20,to.y+10-sH);
        sg.addColorStop(0,`rgba(${rgb},0)`); sg.addColorStop(1,`rgba(${rgb},${pA*0.7})`);
        ctx.fillStyle=sg; ctx.fillRect(to.x+s*20-5,to.y+10-sH,10,sH);
      }
    }
  });
}

function animAirSlash(canvas, ctx, from, to) {
  const dx=to.x-from.x, dy=to.y-from.y;
  const ang=Math.atan2(dy,dx);
  return runCanvas(canvas, ctx, 450, (ctx, t) => {
    if(t<0.6) {
      // Crescent shape traveling
      const bt=t/0.6;
      const px=from.x+dx*bt, py=from.y+dy*bt;
      ctx.save(); ctx.translate(px,py); ctx.rotate(ang);
      ctx.beginPath();
      ctx.arc(0,0,18,0.4*Math.PI,1.6*Math.PI);
      ctx.arc(0,-5,14,1.6*Math.PI,0.4*Math.PI,true);
      ctx.closePath();
      ctx.fillStyle=`rgba(130,200,255,${bt*0.8})`;
      ctx.strokeStyle=`rgba(200,240,255,${bt})`;
      ctx.lineWidth=2; ctx.fill(); ctx.stroke();
      ctx.restore();
    } else {
      const it=(t-0.6)/0.4; const a=1-it;
      // Slash at target
      ctx.save(); ctx.translate(to.x,to.y); ctx.rotate(ang);
      for(let i=-1;i<=1;i++){
        ctx.beginPath();
        ctx.moveTo(-25, i*8); ctx.lineTo(25, i*8);
        ctx.strokeStyle=`rgba(180,230,255,${a})`; ctx.lineWidth=2; ctx.stroke();
      }
      ctx.restore();
    }
  });
}

function animBugBuzz(canvas, ctx, from, to) {
  const dx=to.x-from.x, dy=to.y-from.y;
  return runCanvas(canvas, ctx, 600, (ctx, t) => {
    // Vibration rings spreading from attacker, reaching target
    for(let w=0;w<4;w++){
      const wt=Math.max(0,t-w*0.12);
      if(wt<=0) continue;
      const px=from.x+dx*Math.min(wt,1), py=from.y+dy*Math.min(wt,1);
      const r=8+wt*15;
      const a=Math.max(0,(1-wt)*0.7);
      ctx.beginPath(); ctx.arc(px,py,r,0,Math.PI*2);
      ctx.strokeStyle=`rgba(100,200,50,${a})`; ctx.lineWidth=2; ctx.stroke();
      ctx.beginPath(); ctx.arc(px,py,r*0.6,0,Math.PI*2);
      ctx.strokeStyle=`rgba(150,220,80,${a*0.5})`; ctx.lineWidth=1; ctx.stroke();
    }
  });
}

function animPowerGem(canvas, ctx, from, to) {
  // Gem shards converging at target from different directions
  const shards = Array.from({length:6}, (_, i) => {
    const ang=i/6*Math.PI*2;
    const startR=80;
    return {
      startX:to.x+Math.cos(ang)*startR, startY:to.y+Math.sin(ang)*startR,
      alive:true, age:0,
      tick(ms){this.age=ms; this.alive=ms<550;},
      draw(ctx){
        const t=Math.min(this.age/400,1);
        const px=lerp(this.startX,to.x,t), py=lerp(this.startY,to.y,t);
        const a=t<0.8?1:1-(t-0.8)/0.2;
        ctx.save(); ctx.translate(px,py); ctx.rotate(this.age*0.01);
        ctx.beginPath();
        ctx.moveTo(0,-8); ctx.lineTo(5,0); ctx.lineTo(0,8); ctx.lineTo(-5,0); ctx.closePath();
        ctx.fillStyle=`rgba(220,200,255,${a})`;
        ctx.strokeStyle=`rgba(255,255,255,${a})`; ctx.lineWidth=1;
        ctx.fill(); ctx.stroke();
        ctx.restore();
        // Impact flash
        if(t>=1){
          const dt=Math.min((this.age-400)/150,1);
          ctx.beginPath(); ctx.arc(to.x,to.y,dt*25*(1-dt)*4,0,Math.PI*2);
          ctx.fillStyle=`rgba(255,255,255,${(1-dt)*0.5})`; ctx.fill();
        }
      }
    };
  });
  return runParticleCanvas(canvas, ctx, shards, 580);
}

function animShadowBall(canvas, ctx, from, to) {
  const dx=to.x-from.x, dy=to.y-from.y;
  return runCanvas(canvas, ctx, 650, (ctx, t) => {
    const px=from.x+dx*t, py=from.y+dy*t;
    // Dark swirling orb
    const r=14+Math.sin(t*Math.PI*5)*2;
    const g=ctx.createRadialGradient(px,py,0,px,py,r*2);
    g.addColorStop(0,'rgba(60,0,100,0.9)');
    g.addColorStop(0.4,'rgba(100,20,160,0.7)');
    g.addColorStop(1,'rgba(60,0,120,0)');
    ctx.beginPath(); ctx.arc(px,py,r*2,0,Math.PI*2);
    ctx.fillStyle=g; ctx.fill();
    // Dark core
    ctx.beginPath(); ctx.arc(px,py,r*0.7,0,Math.PI*2);
    ctx.fillStyle='rgba(20,0,40,0.95)'; ctx.fill();
    // Void trail
    for(let i=1;i<=4;i++){
      const tr=i*0.05;
      const tx=from.x+dx*(t-tr), ty=from.y+dy*(t-tr);
      if(t-tr<0) continue;
      ctx.beginPath(); ctx.arc(tx,ty,r*(1-i/5),0,Math.PI*2);
      ctx.fillStyle=`rgba(80,20,140,${0.3-i*0.06})`; ctx.fill();
    }
    // Impact
    if(t>0.85){
      const it=(t-0.85)/0.15;
      ctx.beginPath(); ctx.arc(to.x,to.y,it*35,0,Math.PI*2);
      ctx.fillStyle=`rgba(40,0,80,${(1-it)*0.5})`; ctx.fill();
    }
  });
}

function animDragonPulse(canvas, ctx, from, to) {
  const dx=to.x-from.x, dy=to.y-from.y;
  const dist=Math.hypot(dx,dy);
  const ang=Math.atan2(dy,dx);
  return runCanvas(canvas, ctx, 600, (ctx, t) => {
    // Dragon-shaped energy wave
    const progress=t;
    const cx=from.x+dx*progress, cy=from.y+dy*progress;
    // Main wave
    ctx.save(); ctx.translate(cx,cy); ctx.rotate(ang);
    const wW=12+Math.sin(t*Math.PI*3)*4;
    const g=ctx.createRadialGradient(0,0,0,0,0,wW*2);
    g.addColorStop(0,'rgba(80,200,255,0.9)');
    g.addColorStop(0.5,'rgba(60,80,220,0.6)');
    g.addColorStop(1,'rgba(40,60,200,0)');
    ctx.beginPath(); ctx.arc(0,0,wW*2,0,Math.PI*2);
    ctx.fillStyle=g; ctx.fill();
    // Dragon scales pattern
    for(let s=-2;s<=2;s++){
      ctx.beginPath(); ctx.ellipse(s*8,-wW*0.3,4,wW*0.6,0,0,Math.PI*2);
      ctx.fillStyle=`rgba(100,200,255,0.4)`; ctx.fill();
    }
    ctx.restore();
    // Teal trail
    for(let i=1;i<=5;i++){
      const tr=i*0.06; const tp=Math.max(0,t-tr);
      const tx=from.x+dx*tp, ty=from.y+dy*tp;
      ctx.beginPath(); ctx.arc(tx,ty,8*(1-i/6),0,Math.PI*2);
      ctx.fillStyle=`rgba(60,180,220,${0.4-i*0.07})`; ctx.fill();
    }
    if(t>0.85){
      const it=(t-0.85)/0.15;
      ctx.beginPath(); ctx.arc(to.x,to.y,it*40,0,Math.PI*2);
      ctx.strokeStyle=`rgba(60,120,255,${1-it})`; ctx.lineWidth=3; ctx.stroke();
    }
  });
}

function animSplash(canvas, ctx, from, to) {
  // Water droplets arc up from the attacker and fall back down
  return runCanvas(canvas, ctx, 700, (ctx, t) => {
    const drops = [
      { ox: -18, delay: 0.0, height: 55 },
      { ox:   0, delay: 0.1, height: 75 },
      { ox:  18, delay: 0.2, height: 55 },
      { ox:  -9, delay: 0.3, height: 40 },
      { ox:   9, delay: 0.35, height: 40 },
    ];
    for (const d of drops) {
      const lt = Math.max(0, (t - d.delay) / (1 - d.delay));
      if (lt <= 0) continue;
      const a = lt < 0.8 ? 1 : 1 - (lt - 0.8) / 0.2;
      // parabolic arc: up then down
      const x = from.x + d.ox;
      const y = from.y - Math.sin(lt * Math.PI) * d.height;
      ctx.beginPath();
      ctx.arc(x, y, 5 * (1 - lt * 0.4), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(80,160,255,${a * 0.85})`;
      ctx.fill();
      // small ripple at the bottom when drop falls back
      if (lt > 0.7) {
        const rt = (lt - 0.7) / 0.3;
        ctx.beginPath();
        ctx.arc(x, from.y, rt * 14, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(80,200,255,${(1 - rt) * 0.5})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  });
}

function animTeleport(canvas, ctx, from, to) {
  // Expanding psychic rings burst from the attacker, then a quick flash
  return runCanvas(canvas, ctx, 500, (ctx, t) => {
    // Three rings expanding outward
    for (let i = 0; i < 3; i++) {
      const delay = i * 0.12;
      const rt = Math.max(0, (t - delay) / (1 - delay));
      const a = (1 - rt) * 0.8;
      if (a <= 0) continue;
      ctx.beginPath();
      ctx.arc(from.x, from.y, rt * 45 * (1 + i * 0.25), 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(200,120,255,${a})`;
      ctx.lineWidth = 3 - i * 0.8;
      ctx.stroke();
    }
    // Central flash that peaks at t=0.25 then fades
    const flash = t < 0.25 ? t / 0.25 : 1 - (t - 0.25) / 0.75;
    if (flash > 0) {
      ctx.beginPath();
      ctx.arc(from.x, from.y, flash * 20, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(230,180,255,${flash * 0.6})`;
      ctx.fill();
    }
  });
}

function playAttackAnimation(moveType, attackerEl, targetEl, isSpecial = true, moveName = '') {
  if (!attackerEl || !targetEl) return Promise.resolve();
  const ac = animCanvas(attackerEl, targetEl);
  if (!ac) return Promise.resolve();
  const { canvas, ctx, from, to } = ac;

  // Useless move animations (attacker-centered, no damage)
  if (moveName === 'Splash')   return animSplash(canvas, ctx, from, to);
  if (moveName === 'Teleport') return animTeleport(canvas, ctx, from, to);

  if (!isSpecial) {
    // Physical move animations
    switch(moveName) {
      case 'Body Slam':    return animBodySlam(canvas, ctx, from, to);
      case 'Fire Punch':   return animFirePunch(canvas, ctx, from, to);
      case 'Waterfall':    return animWaterfall(canvas, ctx, from, to);
      case 'Thunder Punch':return animThunderPunch(canvas, ctx, from, to);
      case 'Razor Leaf':   return runParticleCanvas(canvas, ctx, buildParticles('grass', from, to), 650);
      case 'Ice Punch':    return animIcePunch(canvas, ctx, from, to);
      case 'Close Combat': return animCloseCombat(canvas, ctx, from, to);
      case 'Poison Jab':   return animPoisonJab(canvas, ctx, from, to);
      case 'Earthquake':   return animEarthquake(canvas, ctx, from, to);
      case 'Aerial Ace':   return animAerialAce(canvas, ctx, from, to);
      case 'Zen Headbutt': return animZenHeadbut(canvas, ctx, from, to);
      case 'X-Scissor':    return animXScissor(canvas, ctx, from, to);
      case 'Rock Slide':   return animRockSlide(canvas, ctx, from, to);
      case 'Shadow Claw':  return animShadowClaw(canvas, ctx, from, to);
      case 'Dragon Claw':  return animDragonClaw(canvas, ctx, from, to);
      default: {
        // Generic physical fallback
        const rgb = TYPE_COLORS_RGB[moveType.toLowerCase()] || '200,200,200';
        return runCanvas(canvas, ctx, 350, (ctx, t) => {
          if(t<0.4){
            const st=t/0.4; const ex=lerp(from.x,to.x,st), ey=lerp(from.y,to.y,st);
            const g=ctx.createLinearGradient(from.x,from.y,ex,ey);
            g.addColorStop(0,`rgba(${rgb},0)`); g.addColorStop(1,`rgba(${rgb},0.8)`);
            ctx.beginPath(); ctx.moveTo(from.x,from.y); ctx.lineTo(ex,ey);
            ctx.strokeStyle=g; ctx.lineWidth=6; ctx.lineCap='round'; ctx.stroke();
          } else {
            const it=(t-0.4)/0.6; const a=1-it;
            for(let r=0;r<3;r++){
              ctx.beginPath(); ctx.arc(to.x,to.y,it*40*(r+1)/3,0,Math.PI*2);
              ctx.strokeStyle=`rgba(${rgb},${a*0.8/(r+1)})`; ctx.lineWidth=3-r; ctx.stroke();
            }
          }
        });
      }
    }
  } else {
    // Special move animations
    switch(moveName) {
      case 'Hyper Voice':  return animHyperVoice(canvas, ctx, from, to);
      case 'Magical Leaf': return animRazorLeaf(canvas, ctx, from, to);
      // Surf, Thunderbolt use the existing buildParticles animations (water/electric are great)
      case 'Aura Sphere':  return animAuraSphere(canvas, ctx, from, to);
      case 'Sludge Bomb':  return animSludgeBomb(canvas, ctx, from, to);
      case 'Earth Power':  return animEarthPower(canvas, ctx, from, to);
      case 'Air Slash':    return animAirSlash(canvas, ctx, from, to);
      case 'Bug Buzz':     return animBugBuzz(canvas, ctx, from, to);
      case 'Power Gem':    return animPowerGem(canvas, ctx, from, to);
      case 'Shadow Ball':  return animShadowBall(canvas, ctx, from, to);
      case 'Dragon Pulse': return animDragonPulse(canvas, ctx, from, to);
      default: {
        // Use existing buildParticles for remaining special moves (Flamethrower, Surf, Thunderbolt, Ice Beam, Psychic)
        const type = (moveType || 'normal').toLowerCase();
        const particles = buildParticles(type, from, to);
        const duration = type === 'electric' ? 550 : type === 'psychic' ? 700 : type === 'fire' ? 800 : 650;
        return runParticleCanvas(canvas, ctx, particles, duration);
      }
    }
  }
}

/* ── particle factories ── */
function rnd(a, b) { return a + Math.random() * (b - a); }
function lerp(a, b, t) { return a + (b - a) * t; }

function buildParticles(type, from, to) {
  const dx = to.x - from.x, dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  const nx = dx / dist, ny = dy / dist; // normalised direction

  const ps = [];

  if (type === 'fire') {
    // Fireball: glowing orb travels from attacker to target with ember trail, then explodes
    const TRAVEL = 400;

    // Main fireball orb
    let fbx = from.x, fby = from.y, fbAge = 0;
    ps.push({ alive: true,
      tick(ms) { fbAge = ms;
        const t = Math.min(ms / TRAVEL, 1);
        fbx = lerp(from.x, to.x, t); fby = lerp(from.y, to.y, t);
        this.alive = ms < TRAVEL + 80; },
      draw(ctx) {
        const a = Math.max(0, 1 - Math.max(0, fbAge - TRAVEL) / 80);
        // outer heat glow
        const glow = ctx.createRadialGradient(fbx, fby, 0, fbx, fby, 26);
        glow.addColorStop(0, `rgba(255,120,0,${a * 0.35})`);
        glow.addColorStop(1, `rgba(180,30,0,0)`);
        ctx.beginPath(); ctx.arc(fbx, fby, 26, 0, Math.PI * 2);
        ctx.fillStyle = glow; ctx.fill();
        // inner fireball
        const core = ctx.createRadialGradient(fbx, fby, 0, fbx, fby, 13);
        core.addColorStop(0,   `rgba(255,255,200,${a})`);
        core.addColorStop(0.3, `rgba(255,160,20,${a})`);
        core.addColorStop(0.7, `rgba(220,50,0,${a * 0.85})`);
        core.addColorStop(1,   `rgba(80,0,0,0)`);
        ctx.beginPath(); ctx.arc(fbx, fby, 13, 0, Math.PI * 2);
        ctx.fillStyle = core; ctx.fill();
      }
    });

    // Ember trail — particles spawned at positions along the fireball's path
    for (let i = 0; i < 38; i++) {
      const spawnFrac = i / 38;
      const spawnMs   = spawnFrac * TRAVEL;
      const spawnX    = lerp(from.x, to.x, spawnFrac);
      const spawnY    = lerp(from.y, to.y, spawnFrac);
      const evx = rnd(-0.5, 0.5);
      const evy = rnd(-1.4, 0.2); // hot air rises
      const life = rnd(180, 340);
      const startSize = rnd(3, 8);
      let age = -spawnMs;
      ps.push({ alive: true,
        tick(ms) { age = ms - spawnMs; this.alive = age < life; },
        draw(ctx) {
          if (age < 0) return;
          const t = age / life;
          const a = Math.max(0, t < 0.12 ? t / 0.12 : 1 - (t - 0.12) / 0.88);
          const ex = spawnX + evx * age * 0.05;
          const ey = spawnY + evy * age * 0.05;
          const s  = lerp(startSize, startSize * 2.8, t);
          const grad = ctx.createRadialGradient(ex, ey, 0, ex, ey, s);
          grad.addColorStop(0,   `rgba(255,230,120,${a * 0.95})`);
          grad.addColorStop(0.4, `rgba(240,90,10,${a * 0.75})`);
          grad.addColorStop(1,   `rgba(120,20,0,0)`);
          ctx.beginPath(); ctx.arc(ex, ey, s, 0, Math.PI * 2);
          ctx.fillStyle = grad; ctx.fill();
        }
      });
    }

    // Impact explosion burst
    for (let i = 0; i < 20; i++) {
      const delay = TRAVEL + i * 10;
      const angle = rnd(0, Math.PI * 2);
      const speed = rnd(1.0, 2.4);
      const life  = rnd(220, 380);
      const size  = rnd(5, 12);
      let px = to.x, py = to.y, age = -delay;
      ps.push({ alive: true,
        tick(ms) { age = ms - delay; if (age < 0) { this.alive = true; return; }
          px += Math.cos(angle) * speed * 1.6;
          py += Math.sin(angle) * speed * 1.6 - age * 0.0012;
          this.alive = age < life; },
        draw(ctx) {
          if (age < 0) return;
          const t = age / life;
          const a = Math.max(0, t < 0.1 ? t / 0.1 : 1 - (t - 0.1) / 0.9);
          const s = lerp(size, size * 2.4, t);
          const grad = ctx.createRadialGradient(px, py, 0, px, py, s);
          grad.addColorStop(0,   `rgba(255,240,160,${a})`);
          grad.addColorStop(0.3, `rgba(255,110,15,${a * 0.9})`);
          grad.addColorStop(0.7, `rgba(180,35,0,${a * 0.5})`);
          grad.addColorStop(1,   `rgba(60,0,0,0)`);
          ctx.beginPath(); ctx.arc(px, py, s, 0, Math.PI * 2);
          ctx.fillStyle = grad; ctx.fill();
        }
      });
    }

    // Impact shockwave ring
    let impactAge = -TRAVEL;
    ps.push({ alive: true,
      tick(ms) { impactAge = ms - TRAVEL; this.alive = impactAge < 360; },
      draw(ctx) {
        if (impactAge < 0) return;
        const t = impactAge / 360;
        ctx.beginPath(); ctx.arc(to.x, to.y, t * 40, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,110,0,${(1 - t) * 0.6})`; ctx.lineWidth = 3 * (1 - t) + 1; ctx.stroke();
      }
    });

  } else if (type === 'water') {
    // Water Gun: a coherent pressurised stream (grows like the ice beam but wavy+blue)
    let streamAge = 0;
    ps.push({
      alive: true,
      tick(ms) { streamAge = ms; this.alive = ms < 680; },
      draw(ctx) {
        const growT = Math.min(streamAge / 300, 1);
        const fadeA = Math.max(0, 1 - Math.max(0, streamAge - 420) / 260);
        // Draw the stream as a series of short segments with a sine-wave wobble
        const segs = 40;
        const drawSegs = Math.ceil(growT * segs);
        const waveFreq = 3.5; // oscillations along the stream
        const waveAmp  = 5;   // perpendicular pixels
        const phase = streamAge * 0.012; // scrolling phase = water flowing
        ctx.beginPath();
        for (let s = 0; s <= drawSegs; s++) {
          const t = s / segs;
          const bx = lerp(from.x, to.x, t);
          const by = lerp(from.y, to.y, t);
          const wave = Math.sin(t * Math.PI * 2 * waveFreq - phase) * waveAmp;
          const wx = bx - ny * wave, wy = by + nx * wave;
          s === 0 ? ctx.moveTo(wx, wy) : ctx.lineTo(wx, wy);
        }
        // outer glow
        ctx.strokeStyle = `rgba(60,140,255,${fadeA * 0.45})`;
        ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.stroke();
        // mid band
        ctx.beginPath();
        for (let s = 0; s <= drawSegs; s++) {
          const t = s / segs;
          const bx = lerp(from.x, to.x, t), by = lerp(from.y, to.y, t);
          const wave = Math.sin(t * Math.PI * 2 * waveFreq - phase) * waveAmp;
          const wx = bx - ny * wave, wy = by + nx * wave;
          s === 0 ? ctx.moveTo(wx, wy) : ctx.lineTo(wx, wy);
        }
        ctx.strokeStyle = `rgba(100,190,255,${fadeA * 0.85})`;
        ctx.lineWidth = 5; ctx.stroke();
        // bright core
        ctx.beginPath();
        for (let s = 0; s <= drawSegs; s++) {
          const t = s / segs;
          const bx = lerp(from.x, to.x, t), by = lerp(from.y, to.y, t);
          const wave = Math.sin(t * Math.PI * 2 * waveFreq - phase) * waveAmp;
          const wx = bx - ny * wave, wy = by + nx * wave;
          s === 0 ? ctx.moveTo(wx, wy) : ctx.lineTo(wx, wy);
        }
        ctx.strokeStyle = `rgba(220,240,255,${fadeA * 0.7})`;
        ctx.lineWidth = 1.5; ctx.stroke();
      }
    });
    // Foam bubbles riding the stream tip
    for (let i = 0; i < 12; i++) {
      const delay = i * 22;
      const life  = rnd(200, 320);
      const perpOff = rnd(-6, 6);
      let age = -delay;
      ps.push({
        alive: true,
        tick(ms) { age = ms - delay; this.alive = age < life; },
        draw(ctx) {
          if (age < 0) return;
          const t = Math.min(age / 260, 1) * Math.min((delay / (12 * 22)), 1);
          const bx = lerp(from.x, to.x, t) - ny * perpOff;
          const by = lerp(from.y, to.y, t) + nx * perpOff;
          const a  = Math.max(0, 1 - age / life);
          ctx.beginPath(); ctx.arc(bx, by, rnd(2, 4), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(190,225,255,${a * 0.75})`; ctx.fill();
        }
      });
    }
    // Splash at impact
    let splashAge = -1;
    ps.push({
      alive: true,
      tick(ms) { splashAge = ms - 280; this.alive = splashAge < 420; },
      draw(ctx) {
        if (splashAge < 0) return;
        const t = splashAge / 420;
        for (let r = 1; r <= 3; r++) {
          ctx.beginPath(); ctx.arc(to.x, to.y, Math.max(0, t * 38 * r / 3), 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(80,180,255,${(1 - t) * 0.6 / r})`;
          ctx.lineWidth = 3 * (1 - t) + 0.5; ctx.stroke();
        }
      }
    });

  } else if (type === 'electric') {
    // Thunderbolt: animated zigzag bolt
    let bolts = [];
    function makeBolt(ox, oy) {
      const segs = 10;
      const pts = [{ x: from.x + ox, y: from.y + oy }];
      for (let i = 1; i < segs; i++) {
        const t = i / segs;
        const bx = lerp(from.x + ox, to.x + ox, t) + rnd(-18, 18);
        const by = lerp(from.y + oy, to.y + oy, t) + rnd(-18, 18);
        pts.push({ x: bx, y: by });
      }
      pts.push({ x: to.x + ox, y: to.y + oy });
      return pts;
    }
    for (let b = 0; b < 3; b++) bolts.push(makeBolt(rnd(-6, 6), rnd(-6, 6)));
    let boltAge = 0;
    ps.push({
      alive: true,
      tick(ms) { boltAge = ms; if (ms % 80 < 40) bolts = bolts.map(() => makeBolt(rnd(-6,6), rnd(-6,6))); this.alive = ms < 500; },
      draw(ctx) {
        const growT = Math.min(boltAge / 200, 1);
        for (const bolt of bolts) {
          const showSegs = Math.ceil(growT * bolt.length);
          ctx.beginPath();
          ctx.moveTo(bolt[0].x, bolt[0].y);
          for (let i = 1; i < showSegs; i++) ctx.lineTo(bolt[i].x, bolt[i].y);
          const a = Math.max(0, 1 - Math.max(0, boltAge - 350) / 150);
          ctx.strokeStyle = `rgba(255,255,80,${a * 0.9})`;
          ctx.lineWidth = 2.5;
          ctx.shadowColor = 'rgba(255,255,0,0.8)'; ctx.shadowBlur = 10;
          ctx.stroke();
          ctx.shadowBlur = 0;
          // core white line
          ctx.beginPath(); ctx.moveTo(bolt[0].x, bolt[0].y);
          for (let i = 1; i < showSegs; i++) ctx.lineTo(bolt[i].x, bolt[i].y);
          ctx.strokeStyle = `rgba(255,255,255,${a * 0.6})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    });

  } else if (type === 'grass') {
    // Vine Whip: two bezier vines that grow from attacker and lash the target
    const midX = (from.x + to.x) / 2, midY = (from.y + to.y) / 2;
    // Perpendicular offset for each vine's control point (one curves up, one down)
    for (let v = 0; v < 2; v++) {
      const sign   = v === 0 ? 1 : -1;
      const curveMag = dist * 0.30 * sign;
      const cpx = midX - ny * curveMag + rnd(-10, 10);
      const cpy = midY + nx * curveMag + rnd(-10, 10);
      const totalLife = 580;
      const growEnd   = 320; // ms until vine fully extended
      const fadeStart = 400;
      const delay = v * 60;
      let age = -delay;

      // helper: point on quadratic bezier at t
      function bpx(t) { return (1-t)*(1-t)*from.x + 2*(1-t)*t*cpx + t*t*to.x; }
      function bpy(t) { return (1-t)*(1-t)*from.y + 2*(1-t)*t*cpy + t*t*to.y; }

      ps.push({
        alive: true,
        tick(ms) { age = ms - delay; this.alive = age < totalLife; },
        draw(ctx) {
          if (age < 0) return;
          const growT = Math.min(age / growEnd, 1);
          const fadeA = Math.max(0, 1 - Math.max(0, age - fadeStart) / (totalLife - fadeStart));
          const segs  = 30;
          const drawSegs = Math.ceil(growT * segs);

          // Vine body (3 passes: glow, main, highlight)
          const passes = [
            { lw: 7,   color: `rgba(30,90,10,${fadeA * 0.4})` },
            { lw: 3.5, color: `rgba(50,140,20,${fadeA * 0.9})` },
            { lw: 1.2, color: `rgba(130,210,70,${fadeA * 0.55})` },
          ];
          for (const { lw, color } of passes) {
            ctx.beginPath();
            for (let s = 0; s <= drawSegs; s++) {
              const t = s / segs;
              s === 0 ? ctx.moveTo(bpx(t), bpy(t)) : ctx.lineTo(bpx(t), bpy(t));
            }
            ctx.strokeStyle = color; ctx.lineWidth = lw;
            ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
          }

          // Leaves every ~5 segments
          for (let s = 4; s < drawSegs; s += 5) {
            const t = s / segs;
            const lx = bpx(t), ly = bpy(t);
            // tangent direction
            const t2 = Math.min(t + 0.02, 1);
            const tang = Math.atan2(bpy(t2) - ly, bpx(t2) - lx);
            const leafSide = s % 10 < 5 ? 1 : -1;
            ctx.save();
            ctx.translate(lx, ly);
            ctx.rotate(tang + leafSide * Math.PI / 3.5);
            ctx.beginPath();
            ctx.ellipse(4, 0, 7, 3, 0, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(70,170,35,${fadeA * 0.85})`; ctx.fill();
            ctx.restore();
          }

          // Whip-tip flash when vine is fully extended
          if (growT >= 1) {
            const flashA = Math.max(0, 1 - Math.max(0, age - growEnd) / 120) * fadeA;
            ctx.beginPath(); ctx.arc(to.x, to.y, Math.max(0, 10 * flashA), 0, Math.PI * 2);
            ctx.fillStyle = `rgba(150,255,80,${flashA * 0.6})`; ctx.fill();
          }
        }
      });
    }

  } else if (type === 'ice') {
    // Ice Beam: expanding cyan beam + crystal shards at impact
    let beamAge = 0;
    ps.push({
      alive: true,
      tick(ms) { beamAge = ms; this.alive = ms < 600; },
      draw(ctx) {
        const growT  = Math.min(beamAge / 300, 1);
        const fadeT  = Math.max(0, (beamAge - 350) / 250);
        const endX   = lerp(from.x, to.x, growT);
        const endY   = lerp(from.y, to.y, growT);
        const a      = (1 - fadeT) * 0.85;
        // outer glow
        ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(endX, endY);
        ctx.strokeStyle = `rgba(140,230,255,${a * 0.5})`;
        ctx.lineWidth = 10; ctx.stroke();
        // core beam
        ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(endX, endY);
        ctx.strokeStyle = `rgba(210,245,255,${a})`;
        ctx.lineWidth = 3; ctx.stroke();
        // ice crystals along beam
        if (growT > 0.3) {
          for (let i = 0; i < 5; i++) {
            const bt = (i + 1) / 6;
            if (bt > growT) continue;
            const cx = lerp(from.x, to.x, bt), cy = lerp(from.y, to.y, bt);
            ctx.save(); ctx.translate(cx, cy); ctx.rotate(beamAge * 0.003 + i);
            ctx.beginPath();
            for (let s = 0; s < 6; s++) {
              const ang = (s / 6) * Math.PI * 2;
              ctx.moveTo(0, 0); ctx.lineTo(Math.cos(ang) * 7, Math.sin(ang) * 7);
            }
            ctx.strokeStyle = `rgba(200,240,255,${a})`; ctx.lineWidth = 1.5; ctx.stroke();
            ctx.restore();
          }
        }
      }
    });

  } else if (type === 'fighting') {
    // Mach Punch: glowing red orb travels from attacker to target, then impact burst
    const fTravelTime = 240;
    let fpx = from.x, fpy = from.y, fAge = 0;
    ps.push({ alive: true,
      tick(ms) { fAge = ms;
        const t = Math.min(ms / fTravelTime, 1);
        fpx = lerp(from.x, to.x, t); fpy = lerp(from.y, to.y, t);
        this.alive = ms < fTravelTime + 60; },
      draw(ctx) {
        const tTravel = Math.min(fAge / fTravelTime, 1);
        const a = Math.max(0, 1 - Math.max(0, fAge - fTravelTime) / 60);
        // motion trail
        for (let ti = 0; ti < tTravel; ti += 0.09) {
          if (tTravel - ti > 0.4) continue;
          const tx = lerp(from.x, to.x, ti), ty = lerp(from.y, to.y, ti);
          const ta = ((ti - (tTravel - 0.4)) / 0.4) * a * 0.45;
          ctx.beginPath(); ctx.arc(tx, ty, 10 * ta, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(220,40,40,${ta})`; ctx.fill();
        }
        const s = 14;
        const grad = ctx.createRadialGradient(fpx, fpy, 0, fpx, fpy, s);
        grad.addColorStop(0, `rgba(255,200,200,${a})`);
        grad.addColorStop(0.4, `rgba(220,40,40,${a * 0.9})`);
        grad.addColorStop(1, `rgba(100,0,0,0)`);
        ctx.beginPath(); ctx.arc(fpx, fpy, s, 0, Math.PI * 2);
        ctx.fillStyle = grad; ctx.fill();
      }
    });
    // Impact burst after travel
    for (let i = 0; i < 6; i++) {
      const delay = fTravelTime + i * 40;
      const angle = (i / 6) * Math.PI * 2 + rnd(0, 0.5);
      const speed = rnd(1.0, 1.8);
      const life  = rnd(220, 320);
      let px = to.x, py = to.y, age = -delay;
      ps.push({
        alive: true,
        tick(ms) { age = ms - delay; if (age < 0) { this.alive = true; return; }
          px += Math.cos(angle) * speed * 1.5; py += Math.sin(angle) * speed * 1.5;
          this.alive = age < life; },
        draw(ctx) {
          if (age < 0) return;
          const a = Math.max(0, 1 - age / life);
          const s = (12 + 8 * (1 - age / life)) * a;
          ctx.save(); ctx.translate(px, py); ctx.rotate(angle);
          ctx.beginPath();
          ctx.moveTo(0, -s); ctx.lineTo(s * 0.3, -s * 0.3); ctx.lineTo(s, 0);
          ctx.lineTo(s * 0.3, s * 0.3); ctx.lineTo(0, s);
          ctx.lineTo(-s * 0.3, s * 0.3); ctx.lineTo(-s, 0);
          ctx.lineTo(-s * 0.3, -s * 0.3); ctx.closePath();
          ctx.fillStyle = `rgba(220,40,40,${a * 0.85})`; ctx.fill();
          ctx.restore();
        }
      });
    }
    // shockwave ring at impact
    let ringAge = -fTravelTime;
    ps.push({ alive: true,
      tick(ms) { ringAge = ms - fTravelTime; this.alive = ringAge < 350; },
      draw(ctx) {
        if (ringAge < 0) return;
        const t = ringAge / 350;
        ctx.beginPath(); ctx.arc(to.x, to.y, Math.max(0, t * 45), 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,80,80,${(1 - t) * 0.8})`; ctx.lineWidth = 3; ctx.stroke();
      }
    });

  } else if (type === 'poison') {
    // Sludge Bomb: purple bubble stream
    for (let i = 0; i < 18; i++) {
      const delay = i * 25;
      const spread = rnd(-20, 20);
      const speed = rnd(0.55, 0.85);
      const cos = Math.cos(spread * Math.PI / 180);
      const sin = Math.sin(spread * Math.PI / 180);
      const vx = (nx * cos - ny * sin) * speed;
      const vy = (ny * cos + nx * sin) * speed;
      const life = rnd(380, 540);
      const size = rnd(5, 13);
      let px = from.x + rnd(-5, 5), py = from.y + rnd(-5, 5);
      let age = -delay;
      ps.push({
        alive: true,
        tick(ms) { age = ms - delay; if (age < 0) { this.alive = true; return; }
          px += vx * 1.8; py += vy * 1.8; this.alive = age < life; },
        draw(ctx) {
          if (age < 0) return;
          const a = Math.max(0, 1 - age / life);
          const s = size * (0.5 + 0.5 * (1 - age / life));
          const grad = ctx.createRadialGradient(px - s * 0.2, py - s * 0.2, s * 0.1, px, py, s);
          grad.addColorStop(0, `rgba(220,180,255,${a})`);
          grad.addColorStop(0.5, `rgba(160,60,200,${a * 0.9})`);
          grad.addColorStop(1, `rgba(80,0,120,0)`);
          ctx.beginPath(); ctx.arc(px, py, s, 0, Math.PI * 2);
          ctx.fillStyle = grad; ctx.fill();
          // bubble highlight
          ctx.beginPath(); ctx.arc(px - s * 0.3, py - s * 0.3, s * 0.25, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,255,${a * 0.4})`; ctx.fill();
        }
      });
    }

  } else if (type === 'ground') {
    // Earthquake: brown rock shards + quake wave at target
    for (let i = 0; i < 15; i++) {
      const delay = i * 30;
      const angle = rnd(Math.PI * 1.1, Math.PI * 1.9); // upward spread
      const speed = rnd(1.0, 2.0);
      const life  = rnd(400, 600);
      const size  = rnd(6, 14);
      let px = lerp(from.x, to.x, rnd(0.3, 1.0));
      let py = lerp(from.y, to.y, rnd(0.3, 1.0));
      let vx = Math.cos(angle) * speed, vy = Math.sin(angle) * speed;
      let age = -delay;
      ps.push({
        alive: true,
        tick(ms) { age = ms - delay; if (age < 0) { this.alive = true; return; }
          px += vx * 2; vy += 0.08; py += vy * 2; this.alive = age < life; },
        draw(ctx) {
          if (age < 0) return;
          const a = Math.max(0, 1 - age / life);
          ctx.save(); ctx.translate(px, py); ctx.rotate(age * 0.005);
          ctx.beginPath();
          ctx.moveTo(0, -size); ctx.lineTo(size * 0.6, 0); ctx.lineTo(0, size * 0.5);
          ctx.lineTo(-size * 0.6, 0); ctx.closePath();
          ctx.fillStyle = `rgba(160,100,40,${a * 0.9})`; ctx.fill();
          ctx.restore();
        }
      });
    }
    // Quake lines
    let qAge = 0;
    ps.push({ alive: true, tick(ms) { qAge = ms; this.alive = ms < 500; },
      draw(ctx) {
        for (let i = 1; i <= 3; i++) {
          const r = (qAge / 500) * 60 * i / 3;
          const a = (1 - qAge / 500) * 0.6;
          ctx.beginPath(); ctx.ellipse(to.x, to.y, r, r * 0.35, 0, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(140,80,20,${a})`; ctx.lineWidth = 2; ctx.stroke();
        }
      }
    });

  } else if (type === 'flying') {
    // Wing Attack / Air Slash: white curved wind blades
    for (let i = 0; i < 4; i++) {
      const delay = i * 80;
      const offset = (i - 1.5) * 20;
      const life = 400;
      let age = -delay;
      ps.push({
        alive: true,
        tick(ms) { age = ms - delay; this.alive = age < life; },
        draw(ctx) {
          if (age < 0) return;
          const t = age / life;
          const tx = lerp(from.x, to.x, t);
          const ty = lerp(from.y, to.y, t);
          const perpX = -ny * offset, perpY = nx * offset;
          const a = Math.max(0, Math.sin(t * Math.PI));
          ctx.save(); ctx.translate(tx + perpX, ty + perpY);
          const ang = Math.atan2(dy, dx);
          ctx.rotate(ang);
          ctx.beginPath();
          ctx.moveTo(-20, 0);
          ctx.bezierCurveTo(-10, -12, 10, -12, 20, 0);
          ctx.bezierCurveTo(10, 12, -10, 12, -20, 0);
          ctx.fillStyle = `rgba(200,230,255,${a * 0.75})`; ctx.fill();
          ctx.restore();
        }
      });
    }

  } else if (type === 'psychic') {
    // Psychic: pink expanding rings + orbiting sparkles
    let pAge = 0;
    ps.push({ alive: true, tick(ms) { pAge = ms; this.alive = ms < 700; },
      draw(ctx) {
        for (let i = 0; i < 3; i++) {
          const lag = i * 120;
          const t = Math.max(0, Math.min((pAge - lag) / 450, 1));
          if (t <= 0) continue;
          const r = lerp(10, 55, t);
          const a = (1 - t) * 0.7;
          ctx.beginPath(); ctx.arc(to.x, to.y, r, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255,80,180,${a})`; ctx.lineWidth = 3; ctx.stroke();
        }
        // orbital sparks
        for (let s = 0; s < 5; s++) {
          const ang = (pAge * 0.006) + (s / 5) * Math.PI * 2;
          const orb = lerp(from.x, to.x, Math.min(pAge / 350, 1));
          const orby = lerp(from.y, to.y, Math.min(pAge / 350, 1));
          const r = 18;
          const sx = orb + Math.cos(ang) * r, sy = orby + Math.sin(ang) * r;
          const a = Math.max(0, 1 - Math.max(0, pAge - 400) / 300);
          ctx.beginPath(); ctx.arc(sx, sy, 3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,100,200,${a})`; ctx.fill();
        }
      }
    });

  } else if (type === 'bug') {
    // Bug Buzz: yellow-green spore cloud
    for (let i = 0; i < 25; i++) {
      const delay = i * 15;
      const angle = rnd(0, Math.PI * 2);
      const spread = rnd(-25, 25);
      const speed = rnd(0.5, 0.9);
      const cos = Math.cos(spread * Math.PI / 180);
      const sin = Math.sin(spread * Math.PI / 180);
      const vx = (nx * cos - ny * sin) * speed;
      const vy = (ny * cos + nx * sin) * speed;
      const life = rnd(300, 500);
      const size = rnd(3, 8);
      let px = from.x, py = from.y, age = -delay;
      ps.push({
        alive: true,
        tick(ms) { age = ms - delay; if (age < 0) { this.alive = true; return; }
          px += vx * 1.8 + Math.sin(age * 0.05 + angle) * 0.4;
          py += vy * 1.8; this.alive = age < life; },
        draw(ctx) {
          if (age < 0) return;
          const a = Math.max(0, 1 - age / life);
          ctx.beginPath(); ctx.arc(px, py, Math.max(0, size * a), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(150,220,30,${a * 0.85})`; ctx.fill();
        }
      });
    }

  } else if (type === 'rock') {
    // Rock Slide: grey tumbling boulders
    for (let i = 0; i < 10; i++) {
      const delay = i * 40;
      const spread = rnd(-12, 12);
      const speed = rnd(0.75, 1.1);
      const cos = Math.cos(spread * Math.PI / 180);
      const sin = Math.sin(spread * Math.PI / 180);
      const vx = (nx * cos - ny * sin) * speed;
      const vy = (ny * cos + nx * sin) * speed;
      const life = rnd(350, 500);
      const size = rnd(8, 16);
      const sides = Math.floor(rnd(5, 8));
      let px = from.x + rnd(-8, 8), py = from.y + rnd(-8, 8), rot = rnd(0, Math.PI * 2);
      let age = -delay;
      ps.push({
        alive: true,
        tick(ms) { age = ms - delay; if (age < 0) { this.alive = true; return; }
          px += vx * 2.0; py += vy * 2.0; rot += 0.07; this.alive = age < life; },
        draw(ctx) {
          if (age < 0) return;
          const a = Math.max(0, 1 - age / life);
          ctx.save(); ctx.translate(px, py); ctx.rotate(rot);
          ctx.beginPath();
          for (let s = 0; s < sides; s++) {
            const ang = (s / sides) * Math.PI * 2;
            const r = size * (0.8 + 0.2 * Math.cos(ang * 3));
            s === 0 ? ctx.moveTo(Math.cos(ang)*r, Math.sin(ang)*r)
                    : ctx.lineTo(Math.cos(ang)*r, Math.sin(ang)*r);
          }
          ctx.closePath();
          ctx.fillStyle = `rgba(140,130,110,${a * 0.9})`;
          ctx.strokeStyle = `rgba(80,70,60,${a})`; ctx.lineWidth = 1.5;
          ctx.fill(); ctx.stroke();
          ctx.restore();
        }
      });
    }

  } else if (type === 'ghost') {
    // Shadow Ball: dark purple wisp
    let gAge = 0;
    let px = from.x, py = from.y;
    let wobble = 0;
    ps.push({ alive: true,
      tick(ms) { gAge = ms;
        const t = Math.min(ms / 500, 1);
        px = lerp(from.x, to.x, t); py = lerp(from.y, to.y, t);
        wobble = Math.sin(ms * 0.015) * 8;
        this.alive = ms < 600; },
      draw(ctx) {
        const a = Math.max(0, 1 - Math.max(0, gAge - 450) / 150);
        const s = 22;
        const grad = ctx.createRadialGradient(px + wobble, py, 0, px + wobble, py, s);
        grad.addColorStop(0, `rgba(200,100,255,${a})`);
        grad.addColorStop(0.4, `rgba(100,0,180,${a * 0.8})`);
        grad.addColorStop(1, `rgba(20,0,60,0)`);
        ctx.beginPath(); ctx.arc(px + wobble, py, s, 0, Math.PI * 2);
        ctx.fillStyle = grad; ctx.fill();
        // trailing wisps
        for (let t2 = 0.1; t2 < 1; t2 += 0.2) {
          const trail_t = Math.min(gAge / 500 - t2, 0);
          if (trail_t >= 0) continue;
          const twx = lerp(from.x, to.x, Math.max(0, gAge / 500 - t2));
          const twy = lerp(from.y, to.y, Math.max(0, gAge / 500 - t2));
          ctx.beginPath(); ctx.arc(twx, twy, Math.max(0, s * t2 * 0.6), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(100,0,180,${a * t2 * 0.4})`; ctx.fill();
        }
      }
    });

  } else if (type === 'dragon') {
    // Dragon Rage: rainbow energy beam
    let dAge = 0;
    ps.push({ alive: true, tick(ms) { dAge = ms; this.alive = ms < 700; },
      draw(ctx) {
        const growT = Math.min(dAge / 320, 1);
        const fadeA = Math.max(0, 1 - Math.max(0, dAge - 450) / 250);
        const endX = lerp(from.x, to.x, growT), endY = lerp(from.y, to.y, growT);
        const colors = ['255,60,60','255,160,0','255,255,0','60,220,60','60,160,255','160,80,255'];
        for (let c = 0; c < colors.length; c++) {
          const offset = (c - 2.5) * 3;
          const perpX = -ny * offset, perpY = nx * offset;
          ctx.beginPath();
          ctx.moveTo(from.x + perpX, from.y + perpY);
          ctx.lineTo(endX + perpX, endY + perpY);
          ctx.strokeStyle = `rgba(${colors[c]},${fadeA * 0.7})`;
          ctx.lineWidth = 3; ctx.stroke();
        }
        // white core
        ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(endX, endY);
        ctx.strokeStyle = `rgba(255,255,255,${fadeA * 0.4})`; ctx.lineWidth = 1.5; ctx.stroke();
      }
    });

  } else if (type === 'dark') {
    // Dark Pulse / Night Slash: black energy slashes
    for (let i = 0; i < 5; i++) {
      const delay = i * 60;
      const life = 350;
      let age = -delay;
      ps.push({
        alive: true,
        tick(ms) { age = ms - delay; this.alive = age < life; },
        draw(ctx) {
          if (age < 0) return;
          const t = age / life;
          const tx = lerp(from.x, to.x, t);
          const ty = lerp(from.y, to.y, t);
          const a = Math.sin(t * Math.PI) * 0.9;
          const ang = Math.atan2(dy, dx) + (i - 2) * 0.2;
          const len = 28;
          ctx.save(); ctx.translate(tx, ty); ctx.rotate(ang);
          ctx.beginPath(); ctx.moveTo(-len, 0); ctx.lineTo(len, 0);
          ctx.strokeStyle = `rgba(80,0,120,${a})`; ctx.lineWidth = 5;
          ctx.shadowColor = 'rgba(60,0,80,0.8)'; ctx.shadowBlur = 8;
          ctx.stroke();
          ctx.beginPath(); ctx.moveTo(-len, 0); ctx.lineTo(len, 0);
          ctx.strokeStyle = `rgba(200,100,255,${a * 0.5})`; ctx.lineWidth = 1.5;
          ctx.stroke(); ctx.shadowBlur = 0;
          ctx.restore();
        }
      });
    }

  } else if (type === 'steel') {
    // Flash Cannon: silver metallic orb travels from attacker to target, then spark burst
    const sTravelTime = 270;
    let spx = from.x, spy = from.y, sAge2 = 0;
    ps.push({ alive: true,
      tick(ms) { sAge2 = ms;
        const t = Math.min(ms / sTravelTime, 1);
        spx = lerp(from.x, to.x, t); spy = lerp(from.y, to.y, t);
        this.alive = ms < sTravelTime + 60; },
      draw(ctx) {
        const tTravel = Math.min(sAge2 / sTravelTime, 1);
        const a = Math.max(0, 1 - Math.max(0, sAge2 - sTravelTime) / 60);
        // trailing gleam
        for (let ti = Math.max(0, tTravel - 0.38); ti < tTravel; ti += 0.07) {
          const tx = lerp(from.x, to.x, ti), ty = lerp(from.y, to.y, ti);
          const ta = ((ti - (tTravel - 0.38)) / 0.38) * a * 0.5;
          ctx.beginPath(); ctx.arc(tx, ty, 9 * ta, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(180,200,220,${ta})`; ctx.fill();
        }
        const s = 12;
        const grad = ctx.createRadialGradient(spx - s * 0.3, spy - s * 0.3, s * 0.1, spx, spy, s);
        grad.addColorStop(0, `rgba(255,255,255,${a})`);
        grad.addColorStop(0.4, `rgba(200,215,230,${a * 0.9})`);
        grad.addColorStop(1, `rgba(100,120,150,0)`);
        ctx.beginPath(); ctx.arc(spx, spy, s, 0, Math.PI * 2);
        ctx.fillStyle = grad; ctx.fill();
      }
    });
    // Spark burst on impact
    for (let i = 0; i < 20; i++) {
      const delay = sTravelTime + i * 15;
      const angle = rnd(0, Math.PI * 2);
      const speed = rnd(0.8, 2.0);
      const life  = rnd(200, 360);
      let px = to.x, py = to.y, age = -delay;
      ps.push({
        alive: true,
        tick(ms) { age = ms - delay; if (age < 0) { this.alive = true; return; }
          px += Math.cos(angle) * speed * 2; py += Math.sin(angle) * speed * 2;
          this.alive = age < life; },
        draw(ctx) {
          if (age < 0) return;
          const a = Math.max(0, 1 - age / life);
          ctx.beginPath();
          ctx.moveTo(px, py); ctx.lineTo(px - Math.cos(angle) * 10, py - Math.sin(angle) * 10);
          ctx.strokeStyle = `rgba(200,210,220,${a})`; ctx.lineWidth = 2.5; ctx.stroke();
          ctx.beginPath(); ctx.arc(px, py, Math.max(0, 2.5 * a), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(240,245,255,${a})`; ctx.fill();
        }
      });
    }

  } else if (type === 'fairy') {
    // Moonblast: pink sparkles + stars
    for (let i = 0; i < 22; i++) {
      const delay = i * 20;
      const spread = rnd(-30, 30);
      const speed = rnd(0.5, 0.9);
      const cos = Math.cos(spread * Math.PI / 180);
      const sin = Math.sin(spread * Math.PI / 180);
      const vx = (nx * cos - ny * sin) * speed;
      const vy = (ny * cos + nx * sin) * speed;
      const life = rnd(350, 550);
      const size = rnd(4, 9);
      let px = from.x + rnd(-6, 6), py = from.y + rnd(-6, 6), rot = rnd(0, Math.PI);
      let age = -delay;
      ps.push({
        alive: true,
        tick(ms) { age = ms - delay; if (age < 0) { this.alive = true; return; }
          px += vx * 1.8; py += vy * 1.8; rot += 0.08; this.alive = age < life; },
        draw(ctx) {
          if (age < 0) return;
          const a = Math.max(0, 1 - age / life);
          ctx.save(); ctx.translate(px, py); ctx.rotate(rot);
          // 4-point star
          ctx.beginPath();
          for (let s = 0; s < 8; s++) {
            const ang = (s / 8) * Math.PI * 2;
            const r = s % 2 === 0 ? size : size * 0.4;
            s === 0 ? ctx.moveTo(Math.cos(ang)*r, Math.sin(ang)*r)
                    : ctx.lineTo(Math.cos(ang)*r, Math.sin(ang)*r);
          }
          ctx.closePath();
          ctx.fillStyle = `rgba(255,140,200,${a * 0.9})`; ctx.fill();
          ctx.restore();
        }
      });
    }

  } else {
    // Normal: white energy orb traveling to target
    let px = from.x, py = from.y, nAge = 0;
    ps.push({ alive: true,
      tick(ms) { nAge = ms;
        const t = Math.min(ms / 400, 1);
        px = lerp(from.x, to.x, t); py = lerp(from.y, to.y, t);
        this.alive = ms < 450; },
      draw(ctx) {
        const a = Math.max(0, 1 - Math.max(0, nAge - 350) / 100);
        const grad = ctx.createRadialGradient(px, py, 0, px, py, 18);
        grad.addColorStop(0, `rgba(255,255,255,${a})`);
        grad.addColorStop(1, `rgba(200,200,200,0)`);
        ctx.beginPath(); ctx.arc(px, py, 18, 0, Math.PI * 2);
        ctx.fillStyle = grad; ctx.fill();
      }
    });
  }

  return ps;
}

// Visual turn-by-turn battle animation
async function animateBattleVisually(detailedLog, pTeamInit, eTeamInit) {
  renderBattleField(pTeamInit, eTeamInit);

  // Track live HP during animation
  const logEl = null; // combat log removed
  const pHp = pTeamInit.map(p => ({ current: p.currentHp, max: p.maxHp }));
  const eHp = eTeamInit.map(p => ({
    current: p.currentHp !== undefined ? p.currentHp : p.maxHp,
    max: p.maxHp,
  }));

  function addLogEntry(msg, cls = '') {
    if (!logEl) return;
    const div = document.createElement('div');
    div.className = `log-entry ${cls}`;
    div.textContent = msg;
    logEl.appendChild(div);
    logEl.scrollTop = logEl.scrollHeight;
  }

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms / battleSpeedMultiplier));
  }

  for (const event of detailedLog) {
    if (event.type === 'attack') {
      const attackerSideId = event.side === 'player' ? 'player-side' : 'enemy-side';
      const targetSideId = event.side === 'player' ? 'enemy-side' : 'player-side';
      const attackerEl = document.querySelector(`#${attackerSideId} .battle-pokemon[data-idx="${event.attackerIdx}"]`);
      const targetEl = document.querySelector(`#${targetSideId} .battle-pokemon[data-idx="${event.targetIdx}"]`);
      const hitClass = `hit-${event.moveType.toLowerCase()}`;

      if (attackerEl) attackerEl.classList.add('attacking');

      // Play canvas projectile animation concurrently with attacker pulse
      if (attackerEl && targetEl) {
        await playAttackAnimation(event.moveType, attackerEl, targetEl, event.isSpecial, event.moveName);
      } else {
        await sleep(220);
      }
      if (attackerEl) attackerEl.classList.remove('attacking');

      // Hit flash + SFX on target while HP bar animates
      if (targetEl) targetEl.classList.add(hitClass);
      if (event.crit && targetEl) {
        targetEl.classList.add('crit-flash');
        const popup = document.createElement('div');
        popup.className = 'crit-popup';
        popup.textContent = 'Critical!';
        targetEl.appendChild(popup);
        setTimeout(() => popup.remove(), 800);
      }
      if (targetEl) {
        const targetHpTrack = event.side === 'player' ? eHp : pHp;
        const prev = targetHpTrack[event.targetIdx].current;
        await animateHpBar(targetEl, prev, event.targetHpAfter, targetHpTrack[event.targetIdx].max);
        targetHpTrack[event.targetIdx].current = event.targetHpAfter;
      }

      await sleep(300);
      if (targetEl) targetEl.classList.remove(hitClass);
      if (targetEl) targetEl.classList.remove('crit-flash');

      let effText = '';
      if (event.typeEff >= 2) effText = ' Super effective!';
      else if (event.typeEff === 0) effText = ' No effect!';
      else if (event.typeEff < 1) effText = ' Not very effective...';
      if (event.crit) effText += ' Critical hit!';

      const sideLabel = event.side === 'player' ? '' : '(enemy) ';
      addLogEntry(
        `${sideLabel}${event.attackerName} used ${event.moveName} → ${event.targetName} took ${event.damage} dmg.${effText}`,
        event.side === 'player' ? 'log-player' : 'log-enemy'
      );

      await sleep(100);

    } else if (event.type === 'effect') {
      const sideId = event.side === 'player' ? 'player-side' : 'enemy-side';
      const el = document.querySelector(`#${sideId} .battle-pokemon[data-idx="${event.idx}"]`);
      const teamHp = event.side === 'player' ? pHp : eHp;
      const prev = teamHp[event.idx].current;

      if (el) {
        await animateHpBar(el, prev, event.hpAfter, teamHp[event.idx].max);
      }
      teamHp[event.idx].current = event.hpAfter;

      addLogEntry(event.reason, 'log-item');
      await sleep(100);

    } else if (event.type === 'faint') {
      const sideId = event.side === 'player' ? 'player-side' : 'enemy-side';
      const el = document.querySelector(`#${sideId} .battle-pokemon[data-idx="${event.idx}"]`);
      if (el) { el.classList.add('fainted'); el.classList.remove('active-pokemon'); }
      addLogEntry(`${event.name} fainted!`, 'log-faint');
      await sleep(300);

    } else if (event.type === 'send_out') {
      const sideId = event.side === 'player' ? 'player-side' : 'enemy-side';
      // Clear previous active highlight on this side
      document.querySelectorAll(`#${sideId} .battle-pokemon`).forEach(el => el.classList.remove('active-pokemon'));
      const el = document.querySelector(`#${sideId} .battle-pokemon[data-idx="${event.idx}"]`);
      if (el) el.classList.add('active-pokemon');
      addLogEntry(`${event.name} was sent out!`, event.side === 'player' ? 'log-player' : 'log-enemy');
      await sleep(250);

    } else if (event.type === 'transform') {
      const sideId = event.side === 'player' ? 'player-side' : 'enemy-side';
      const el = document.querySelector(`#${sideId} .battle-pokemon[data-idx="${event.idx}"]`);
      if (el) {
        // Flash white, swap sprite, update name display
        el.classList.add('hit-normal');
        await sleep(200);
        const imgEl = el.querySelector('.battle-sprite');
        if (imgEl) imgEl.src = event.spriteUrl;
        const nameEl = el.querySelector('.battle-poke-name');
        if (nameEl) nameEl.textContent = `${event.name} Lv${pTeamInit[event.idx].level}`;
        el.classList.remove('hit-normal');
      }
      addLogEntry(`${event.name} transformed into ${event.intoName}!`, 'log-player');
      await sleep(400);

    } else if (event.type === 'result') {
      addLogEntry(
        event.playerWon ? '--- Victory! ---' : '--- Defeat! ---',
        event.playerWon ? 'log-win' : 'log-lose'
      );
    }
  }
}

// Show a brief notification banner on the map screen
function showMapNotification(msg) {
  const mapScreen = document.getElementById('map-screen');
  if (!mapScreen) return;

  const existing = mapScreen.querySelector('.map-notification');
  if (existing) existing.remove();

  const div = document.createElement('div');
  div.className = 'map-notification';
  div.textContent = msg;
  mapScreen.appendChild(div);

  setTimeout(() => {
    div.style.opacity = '0';
    setTimeout(() => div.remove(), 500);
  }, 1800);
}

// Render trainer sprites on both battle sides
function renderTrainerIcons(gender, enemyName = null, showPlayer = true) {
  const playerEl = document.getElementById('player-trainer-icon');
  const enemyEl  = document.getElementById('enemy-trainer-icon');
  if (playerEl) {
    if (showPlayer) playerEl.innerHTML = TRAINER_SVG[gender] || TRAINER_SVG.boy;
    else playerEl.innerHTML = '';
  }
  if (enemyEl) {
    if (enemyName) {
      enemyEl.innerHTML = getTrainerImgHtml(enemyName);
      // Mirror to face player
      const img = enemyEl.querySelector('img');
      if (img) img.style.transform = 'scaleX(-1)';
    } else {
      enemyEl.innerHTML = ''; // Wild battle — no enemy trainer portrait
    }
  }
}

// Play the classic white-flash evolution animation
async function playEvoAnimation(pokemon, evoData) {
  const overlay  = document.getElementById('evo-overlay');
  const msgEl    = document.getElementById('evo-msg');
  const spriteEl = document.getElementById('evo-sprite');
  if (!overlay) return;

  const newSpriteUrl = pokemon.isShiny
    ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${evoData.into}.png`
    : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${evoData.into}.png`;
  const oldSpriteUrl = pokemon.spriteUrl || '';
  const displayName  = pokemon.nickname || pokemon.name;

  msgEl.textContent = `What? ${displayName} is evolving!`;
  spriteEl.src = oldSpriteUrl;
  spriteEl.style.filter = 'brightness(0) invert(1)'; // white silhouette
  overlay.style.background = '#111';
  overlay.style.display = 'flex';

  let skipped = false;
  const skipResolve = new Promise(r => {
    overlay.onclick = () => { skipped = true; r(); };
  });
  const sleep = ms => skipped ? Promise.resolve() : Promise.race([new Promise(r => setTimeout(r, ms)), skipResolve]);

  // Alternate between old and new silhouette, slow → fast (like the GB games)
  const delays = [600, 600, 500, 500, 400, 350, 280, 200, 150, 110, 80, 60, 50, 40, 40, 35];
  for (const d of delays) {
    if (skipped) break;
    spriteEl.src = (spriteEl.src.endsWith(oldSpriteUrl) || spriteEl.src === oldSpriteUrl)
      ? newSpriteUrl : oldSpriteUrl;
    await sleep(d);
  }

  // End on new sprite — single white flash to reveal
  spriteEl.src = newSpriteUrl;
  overlay.style.background = '#fff';
  await sleep(120);
  overlay.style.background = '#111';
  spriteEl.style.filter = ''; // show in full color

  msgEl.textContent = `${displayName} evolved into ${evoData.name}!`;
  await sleep(2000);

  overlay.style.display = 'none';
  overlay.style.background = '#000';
  overlay.onclick = null;
  spriteEl.style.filter = '';
}

// Show Eevee evolution choice and return the chosen evoData (from EEVEE_EVOLUTIONS)
function showEeveeChoice(pokemon) {
  return new Promise(resolve => {
    const overlay  = document.getElementById('eevee-choice-overlay');
    const choicesEl = document.getElementById('eevee-choices');
    choicesEl.innerHTML = '';

    for (const evoData of EEVEE_EVOLUTIONS) {
      const spriteUrl = pokemon.isShiny
        ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${evoData.into}.png`
        : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${evoData.into}.png`;

      const card = document.createElement('div');
      card.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:8px;cursor:pointer;' +
        'border:2px solid #555;border-radius:8px;padding:12px 16px;background:#1a1a1a;' +
        'transition:border-color 0.15s,background 0.15s;';
      card.onmouseenter = () => { card.style.borderColor = '#fff'; card.style.background = '#2a2a2a'; };
      card.onmouseleave = () => { card.style.borderColor = '#555'; card.style.background = '#1a1a1a'; };

      const img = document.createElement('img');
      img.src = spriteUrl;
      img.style.cssText = 'width:72px;height:72px;image-rendering:pixelated;';

      const nameEl = document.createElement('div');
      nameEl.textContent = evoData.name;
      nameEl.style.cssText = "font-family:'Press Start 2P',monospace;font-size:8px;color:#fff;";

      const typeEl = document.createElement('div');
      typeEl.textContent = evoData.types.join('/');
      typeEl.style.cssText = "font-family:'Press Start 2P',monospace;font-size:7px;color:#aaa;";

      card.append(img, nameEl, typeEl);
      card.onclick = () => {
        overlay.style.display = 'none';
        resolve(evoData);
      };
      choicesEl.appendChild(card);
    }

    overlay.style.display = 'flex';
  });
}

// Check team for pending evolutions after a won battle and play animations
async function checkAndEvolveTeam() {
  const skipAnim = getSettings().autoSkipEvolve;
  for (const pokemon of state.team) {
    if (pokemon.currentHp <= 0) continue;

    let evo;
    if (pokemon.speciesId === 133) {
      // Eevee — show choice at level 36 (always ask user, even when skipping animation)
      if (pokemon.level < 36) continue;
      evo = await showEeveeChoice(pokemon);
    } else {
      evo = GEN1_EVOLUTIONS[pokemon.speciesId];
      if (!evo || pokemon.level < evo.level) continue;
      if (pokemon.speciesId === evo.into) continue;
    }

    if (!skipAnim) await playEvoAnimation(pokemon, evo);

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
  }
}

// Animate level-up events returned by applyLevelGain
async function animateLevelUp(levelUps) {
  const pEl = document.getElementById('player-side');
  if (!pEl || levelUps.length === 0) return;
  const sleep = ms => new Promise(r => setTimeout(r, ms / battleSpeedMultiplier));

  await Promise.all(levelUps.map(async ({ idx, pokemon, newLevel, preHp }) => {
    const el = pEl.querySelector(`.battle-pokemon[data-idx="${idx}"]`);
    if (!el) return;

    // Animate HP bar filling up (alive pokemon only)
    if (pokemon.currentHp > 0 && pokemon.currentHp > preHp) {
      await animateHpBar(el, preHp, pokemon.currentHp, pokemon.maxHp, 400);
    }

    // Golden glow + floating "Lv X!" text
    el.classList.add('level-up');
    const lvText = document.createElement('div');
    lvText.className = 'level-up-text';
    lvText.textContent = `Lv ${newLevel}!`;
    el.appendChild(lvText);

    await sleep(900);
    el.classList.remove('level-up');
    lvText.remove();

    // Update name/level label after animation
    const nameEl = el.querySelector('.battle-poke-name');
    if (nameEl) nameEl.textContent = `${pokemon.nickname || pokemon.name} Lv${newLevel}`;
  }));
}

// Legacy: animate battle log line by line (kept for fallback)

// ---- Achievement Toast ----

let _toastQueue = [];
let _toastRunning = false;

function showAchievementToast(ach) {
  _toastQueue.push(ach);
  if (!_toastRunning) _runToastQueue();
}

function _runToastQueue() {
  if (_toastQueue.length === 0) { _toastRunning = false; return; }
  _toastRunning = true;
  const ach = _toastQueue.shift();

  const toast = document.createElement('div');
  toast.className = 'achievement-toast';
  toast.innerHTML = `<span class="ach-toast-icon">${ach.icon}</span>
    <div class="ach-toast-text">
      <div class="ach-toast-label">Achievement Unlocked!</div>
      <div class="ach-toast-name">${ach.name}</div>
    </div>`;
  document.body.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => toast.classList.add('visible'));

  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => { toast.remove(); _runToastQueue(); }, 400);
  }, 3000);
}

// ---- Settings Modal ----

function applyDarkMode() {
  document.body.classList.toggle('dark-mode', !!getSettings().darkMode);
}

function openSettingsModal() {
  const existing = document.getElementById('settings-modal');
  if (existing) { existing.remove(); return; }

  const modal = document.createElement('div');
  modal.id = 'settings-modal';

  function row(label, key, disabled = false) {
    const s = getSettings();
    return `<label class="settings-row${disabled ? ' settings-row-disabled' : ''}">
      <span class="settings-label">${label}</span>
      <input type="checkbox" class="settings-checkbox" data-key="${key}" ${s[key] ? 'checked' : ''} ${disabled ? 'disabled' : ''}>
    </label>`;
  }

  function render() {
    const s = getSettings();
    modal.innerHTML = `
      <div class="settings-modal-box">
        <div class="settings-modal-header">
          <span>Settings</span>
          <button class="ach-modal-close" onclick="document.getElementById('settings-modal').remove()">✕</button>
        </div>
        <div class="settings-section-title">Display</div>
        ${row('Dark Mode', 'darkMode')}
        <div class="settings-section-title">Auto-Skip</div>
        ${row('Regular Trainers', 'autoSkipBattles', s.autoSkipAllBattles)}
        ${row('All Fights', 'autoSkipAllBattles')}
        ${row('Evolutions', 'autoSkipEvolve')}
      </div>`;

    modal.querySelectorAll('.settings-checkbox').forEach(cb => {
      cb.onchange = () => {
        const s2 = getSettings();
        s2[cb.dataset.key] = cb.checked;
        saveSettings(s2);
        applyDarkMode();
        render();
      };
    });
  }

  render();
  document.body.appendChild(modal);
}

// ---- Achievements Modal ----

function openAchievementsModal() {
  const existing = document.getElementById('achievements-modal');
  if (existing) { existing.remove(); return; }

  const unlocked = getUnlockedAchievements();

  const modal = document.createElement('div');
  modal.id = 'achievements-modal';
  modal.innerHTML = `
    <div class="ach-modal-box">
      <div class="ach-modal-header">
        <span>Achievements (${unlocked.size}/${ACHIEVEMENTS.length})</span>
        <button class="ach-modal-close" onclick="document.getElementById('achievements-modal').remove()">✕</button>
      </div>
      <div class="ach-modal-grid">
        ${ACHIEVEMENTS.map(a => {
          const done = unlocked.has(a.id);
          return `<div class="ach-card ${done ? 'unlocked' : 'locked'}">
            <div class="ach-icon">${a.icon}</div>
            <div class="ach-name">${a.name}</div>
            <div class="ach-desc">${a.desc}</div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  document.body.appendChild(modal);
}

// ---- Pokedex Modal ----

function openPokedexModal(initialTab = 'normal') {
  const existing = document.getElementById('pokedex-modal');
  if (existing) { existing.remove(); return; }

  const BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/';

  function buildNormalGrid() {
    const dex = getPokedex();
    const caughtCount = [...ALL_CATCHABLE_IDS].filter(id => dex[id]?.caught).length;
    const grid = Array.from({ length: 151 }, (_, i) => {
      const id = i + 1;
      const e = dex[id];
      if (e) {
        const types = (e.types || []).map(t =>
          `<span class="type-badge type-${t.toLowerCase()}">${t}</span>`).join('');
        return `<div class="dex-card dex-caught">
          <div class="dex-num">#${String(id).padStart(3,'0')}</div>
          <img src="${BASE + id + '.png'}" alt="${e.name}" class="dex-sprite"
               onerror="this.src='';this.style.display='none'">
          <div class="dex-name">${e.name}</div>
          <div class="dex-types">${types}</div>
        </div>`;
      }
      return `<div class="dex-card dex-unknown">
        <div class="dex-num">#${String(id).padStart(3,'0')}</div>
        <img src="${BASE + id + '.png'}" alt="???" class="dex-sprite dex-silhouette"
             onerror="this.src='';this.style.display='none'">
        <div class="dex-name dex-unknown-name">???</div>
      </div>`;
    }).join('');
    return { grid, count: caughtCount };
  }

  function buildShinyGrid() {
    const dex = getShinyDex();
    const BASE_SHINY = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/';
    const count = [...ALL_CATCHABLE_IDS].filter(id => dex[id]).length;
    const grid = Array.from({ length: 151 }, (_, i) => {
      const id = i + 1;
      const e = dex[id];
      if (e) {
        const types = (e.types || []).map(t =>
          `<span class="type-badge type-${t.toLowerCase()}">${t}</span>`).join('');
        return `<div class="dex-card shiny-dex-card">
          <div class="dex-num">#${String(id).padStart(3,'0')}</div>
          <img src="${e.shinySpriteUrl || BASE_SHINY + id + '.png'}" alt="${e.name}" class="dex-sprite"
               onerror="this.src='';this.style.display='none'">
          <div class="dex-name">${e.name}</div>
          <div class="dex-types">${types}</div>
          <div class="shiny-star">★</div>
        </div>`;
      }
      return `<div class="dex-card dex-unknown">
        <div class="dex-num">#${String(id).padStart(3,'0')}</div>
        <img src="${BASE_SHINY + id + '.png'}" alt="???" class="dex-sprite dex-silhouette"
             onerror="this.src='';this.style.display='none'">
        <div class="dex-name dex-unknown-name">???</div>
      </div>`;
    }).join('');
    return { grid, count };
  }

  const modal = document.createElement('div');
  modal.id = 'pokedex-modal';
  modal.innerHTML = `
    <div class="dex-modal-box">
      <div class="dex-modal-header">
        <div class="dex-tabs">
          <button class="dex-tab" data-tab="normal">📖 Pokédex</button>
          <button class="dex-tab" data-tab="shiny">✨ Shiny</button>
        </div>
        <span class="dex-counts" id="dex-count-label"></span>
        <button class="ach-modal-close" onclick="document.getElementById('pokedex-modal').remove()">✕</button>
      </div>
      <div style="display:flex;align-items:center;gap:8px;padding:8px 12px 4px;">
        <div style="flex:1;background:#2a0010;height:26px;overflow:hidden;position:relative;border:2px solid #550000;">
          <div id="dex-progress-bar" style="height:100%;background:repeating-linear-gradient(60deg,#cc1111 0px,#cc1111 16px,#ee3333 16px,#ee3333 32px);transition:width 0.3s;width:0%"></div>
          <span id="dex-progress-label" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:'Press Start 2P',monospace;font-size:8px;font-weight:bold;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,0.8);pointer-events:none;"></span>
        </div>
        <div id="dex-charm-icon" style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;border:2px solid #550000;background:#1a0004;flex-shrink:0;" title="Shiny Charm — complete the Pokédex to unlock. Doubles all shiny rates.">
          <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/shiny-charm.png" alt="Shiny Charm" style="width:24px;height:24px;image-rendering:pixelated;" onerror="this.style.display='none'">
        </div>
      </div>
      <div class="dex-grid" id="dex-grid-content"></div>
    </div>`;

  function switchTab(tab) {
    modal.querySelectorAll('.dex-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    modal.querySelector('.dex-modal-box').classList.toggle('shiny-dex-box', tab === 'shiny');
    const { grid, count } = tab === 'shiny' ? buildShinyGrid() : buildNormalGrid();
    document.getElementById('dex-grid-content').innerHTML = grid;
    const total = ALL_CATCHABLE_IDS.size;
    const pct = Math.floor(count / total * 100);
    document.getElementById('dex-count-label').textContent = `${count} / ${total}`;
    document.getElementById('dex-progress-bar').style.width = `${pct}%`;
    document.getElementById('dex-progress-label').textContent = `${pct}%`;
    const charmEl = document.getElementById('dex-charm-icon');
    if (hasShinyCharm()) {
      charmEl.style.borderColor = 'gold';
      charmEl.style.boxShadow = '0 0 6px gold';
      charmEl.title = 'Shiny Charm — active! Doubles all shiny rates.';
    }
  }

  modal.querySelectorAll('.dex-tab').forEach(b =>
    b.addEventListener('click', () => switchTab(b.dataset.tab)));
  document.body.appendChild(modal);
  switchTab(initialTab);
}

function openShinyDexModal() { openPokedexModal('shiny'); }

// ---- Patch Notes Modal ----

const PATCH_NOTES = [
  {
    version: '1.3.1',
    title: 'Cloud Saves & QoL Update',
    date: '2026-04-18',
    sections: [
      {
        heading: 'Cloud Saves',
        entries: [
          'Sign in with Google to sync your save across devices — button on the title screen',
          'Progress is automatically pushed to the cloud after each run and on wins',
          'On a new device, cloud save loads automatically if it is newer than local',
        ],
      },
      {
        heading: 'Run Persistence',
        entries: [
          'Your run is now saved to local storage — closing the tab mid-run no longer loses progress',
          'Continue Run button appears on the title screen when a saved run exists',
          'Reloading during a fight brings you back to the same fight with the same encounter',
        ],
      },
      {
        heading: 'Seeded Randomness',
        entries: [
          'Each run now has a seed — encounters, map layout, and battle outcomes are fully deterministic',
          'Reloading during a fight produces identical crits, damage rolls, and Pokémon choices',
        ],
      },
      {
        heading: 'Map & Mobile',
        entries: [
          'Visited nodes are now greyed out — your last visited node shows a ✓',
          'Edges you have already travelled are visually darker than available paths',
          'Long press a node on mobile to see what it is before committing',
          'Node tooltips now correctly disappear when entering a battle on mobile',
          'Hovering over Pokémon or nodes no longer triggers accidentally after a screen transition',
          'Team bar on mobile now uses a 3-column grid layout',
          'Team panel takes 2/3 width, item panel takes 1/3 on mobile',
          'Map header no longer shows the map name — badges display in a single row',
          'Random Pokémon Center nodes removed — only the guaranteed one remains',
        ],
      },
      {
        heading: 'Pokémon Reordering',
        entries: [
          'Team drag and drop now uses pointer events — feels smooth and precise on both desktop and mobile',
        ],
      },
      {
        heading: 'Bug Fixes',
        entries: [
          'You can no longer encounter a legendary already on your team',
          'Starters now correctly benefit from the Shiny Charm',
          'Traded Pokémon can now be shiny',
          'Lucky Egg description corrected — it boosts XP after every battle, not just wild ones',
          'Discord link is now readable regardless of background color',
        ],
      },
    ],
  },
  {
    version: '1.3',
    title: 'Visual Rework & Achievements Update',
    date: '2026-04-17',
    sections: [
      {
        heading: 'Visual Rework',
        entries: [
          'New retro GBA-style light panel aesthetic across all cards, HUD boxes, and modals',
          'Pixel-art hard shadows on cards, HP bars, battle divs, and buttons',
          'Battle Pokémon cells are taller with bigger sprites and a larger base platform',
          'All primary buttons redesigned to match the retro panel style',
          'Normal Mode button highlighted in blue, Nuzlocke in red',
          'Removed redundant "Defeated [Leader]" line from the badge screen',
          'Battle background now fills the full cell on mobile',
          'Gender selection is saved — you only need to pick once across all runs',
          'Settings button is now accessible from the main menu',
        ],
      },
      {
        heading: 'Dark Mode',
        entries: [
          'Dark mode toggle added to Settings — switches to a warm dark palette and a separate background',
          'Preference is saved and restored across sessions',
          'All panels, modals, buttons, Pokédex, and achievements support dark mode',
        ],
      },
      {
        heading: 'Attack Animations',
        entries: [
          'Fire: overhauled to a glowing fireball traveling to the target with an ember trail and impact explosion',
          'Fighting: red impact orb now travels from attacker to target before the burst',
          'Steel: silver metallic orb travels to the target before sparks fly on impact',
          'Hit flash brightness reduced across all types — less obnoxious on bright panels',
        ],
      },
      {
        heading: 'New Achievements',
        entries: [
          '🦅 Bird Keeper — beat the game with all 3 legendary birds on your team',
          '🏃 No Rest for the Wicked — beat the game without using a Pokémon Center',
          '🎒 Minimalist — beat the game without picking up any items',
          '🔣 Type Supremacy — beat the game with 4 of 6 Pokémon sharing a type',
          '💫 Shiny Squad — beat the game with a full team of shiny Pokémon',
          '🔁 On a Roll — beat the game two runs in a row',
        ],
      },
      {
        heading: 'Bug Fixes',
        entries: [
          'Pokémon no longer skip evolution entirely when "Skip Evolutions" is on — only the animation is skipped',
          'Pokémon obtained by trading are now correctly registered in the Pokédex',
        ],
      },
    ],
  },
  {
    version: '1.2',
    title: 'Combat & Maps Update',
    date: '2026-04-02',
    sections: [
      {
        heading: 'Combat Pacing',
        entries: [
          'Skipping battle animations now speeds them up instead of jumping straight to the end',
          'Skip button greys out after pressing instead of disappearing',
          'Auto-skip setting hides the skip button entirely — no more greyed-out clutter',
          'Continue button is now available as soon as the level-up animation starts — click to fast-forward and auto-proceed',
          'All Pokémon level up simultaneously instead of one at a time',
        ],
      },
      {
        heading: 'Difficulty',
        entries: [
          'Gym leaders Lt. Surge, Erika, and Koga now give their Pokémon held items',
          'Lt. Surge: Pikachu → Eviolite, Voltorb → Magnet, Raichu → Life Orb',
          'Erika: Tangela → Leftovers, Victreebel → Poison Barb, Vileplume → Miracle Seed',
          'Koga: Koffing × 2 → Rocky Helmet, Muk → Poison Barb, Weezing → Leftovers',
        ],
      },
      {
        heading: 'Branching Paths',
        entries: [
          'Tons of overall improvements to branching paths',
          'The last content layer before each boss is now guaranteed to have a Pokémon Center',
          'Added proper icons for nodes',
        ],
      },
      {
        heading: 'Misc',
        entries: [
          'Removed the map legend from the bottom of the screen',
        ],
      },
    ],
  },
  {
    version: '1.1',
    title: 'Items & Structure Update',
    date: '2026-03-11',
    sections: [
      {
        heading: 'New: Usable Items',
        entries: [
          '💊 Max Revive — fully revives a fainted Pokémon (only offered when someone is fainted)',
          '🍬 Rare Candy — gives a Pokémon +3 levels; triggers evolution if the threshold is reached',
          '🌟 Evolution Stone — force evolves any Pokémon regardless of level (Eevee gets the choice picker)',
          'Usable items stack in the bag and are consumed on use',
        ],
      },
      {
        heading: 'New: Hall of Fame',
        entries: [
          'Every championship win now saves your winning team to the Hall of Fame',
          'View past winning teams from the title screen — sprites, levels, and nicknames preserved',
          'Hard mode wins are marked with 💀',
        ],
      },
      {
        heading: 'Enemy Items Rework',
        entries: [
          'Elite Four and Champion now use per-Pokémon held items instead of shared trainer items',
          'Gary gives each of his Pokémon the type-boosting item matching their primary type',
          'Gym leaders Sabrina, Blaine, and Giovanni also reworked to per-Pokémon items',
          'Enemy held items now interact with all item effects the same way the player\'s do',
        ],
      },
      {
        heading: 'Map Generation',
        entries: [
          'Layer 1 of every map is now guaranteed to have at least one Catch node',
          'Layers 1, 3, and 5 are now guaranteed to have at least one Battle node',
          'The first Catch node on Map 1 always includes a Grass or Water type Pokémon',
        ],
      },
    ],
  },
];

function openPatchNotesModal() {
  const existing = document.getElementById('patch-notes-modal');
  if (existing) { existing.remove(); return; }

  const notesHtml = PATCH_NOTES.map(patch => {
    const sectionsHtml = patch.sections.map(s => `
      <div style="margin-bottom:12px;">
        <div style="font-size:9px;color:#4af;margin-bottom:6px;">${s.heading}</div>
        <ul style="margin:0;padding-left:16px;list-style:disc;">
          ${s.entries.map(e => `<li style="font-size:9px;color:var(--text-dim);margin-bottom:4px;line-height:1.6;">${e}</li>`).join('')}
        </ul>
      </div>`).join('');
    return `
      <div style="margin-bottom:20px;">
        <div style="display:flex;align-items:baseline;gap:12px;margin-bottom:10px;border-bottom:1px solid var(--border);padding-bottom:8px;">
          <span style="font-size:12px;color:gold;">v${patch.version}</span>
          <span style="font-size:10px;color:#fff;">${patch.title}</span>
          <span style="font-size:9px;color:var(--text-dim);margin-left:auto;">${patch.date}</span>
        </div>
        ${sectionsHtml}
      </div>`;
  }).join('');

  const modal = document.createElement('div');
  modal.id = 'patch-notes-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:300;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;';
  modal.innerHTML = `
    <div style="background:var(--bg-main);border:2px solid var(--border);border-radius:12px;width:90%;max-width:500px;max-height:80vh;display:flex;flex-direction:column;font-family:'Press Start 2P',monospace;">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--border);">
        <span style="font-size:10px;color:gold;">Patch Notes</span>
        <button style="background:none;border:none;color:var(--text-main);font-size:16px;cursor:pointer;line-height:1;" onclick="document.getElementById('patch-notes-modal').remove()">✕</button>
      </div>
      <div style="overflow-y:auto;padding:16px;">${notesHtml}</div>
    </div>`;

  document.body.appendChild(modal);
}

// ---- Hall of Fame Modal ----

function openHallOfFameModal() {
  const existing = document.getElementById('hof-modal');
  if (existing) { existing.remove(); return; }

  const entries = getHallOfFame();

  const modal = document.createElement('div');
  modal.id = 'hof-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:300;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;';

  const entriesHtml = entries.length === 0
    ? '<div style="color:var(--text-dim);text-align:center;padding:24px;font-size:11px;">No championships yet.<br>Defeat the Elite Four to be remembered!</div>'
    : [...entries].reverse().map(e => {
        const pokemonHtml = e.team.map(p => `
          <div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
            <img src="${p.spriteUrl}" style="width:48px;height:48px;image-rendering:pixelated;${p.isShiny ? 'filter:drop-shadow(0 0 4px gold);' : ''}" title="${p.nickname || p.name}">
            <div style="font-size:7px;color:${p.isShiny ? 'gold' : 'var(--text-dim)'};">${p.nickname || p.name}</div>
            <div style="font-size:7px;color:var(--text-dim);">Lv.${p.level}</div>
          </div>`).join('');
        return `
          <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:10px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
              <span style="font-size:10px;color:gold;font-weight:bold;">Championship #${e.runNumber}${e.hardMode ? ' ☠️' : ''}</span>
              <span style="font-size:9px;color:var(--text-dim);">${e.date}</span>
            </div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;">${pokemonHtml}</div>
          </div>`;
      }).join('');

  modal.innerHTML = `
    <div style="background:var(--bg-main);border:2px solid var(--border);border-radius:12px;width:90%;max-width:480px;max-height:80vh;display:flex;flex-direction:column;">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--border);">
        <span style="font-family:'Press Start 2P',monospace;font-size:10px;color:gold;">Hall of Fame</span>
        <button style="background:none;border:none;color:var(--text-main);font-size:16px;cursor:pointer;line-height:1;" onclick="document.getElementById('hof-modal').remove()">✕</button>
      </div>
      <div style="overflow-y:auto;padding:14px;font-family:'Press Start 2P',monospace;">${entriesHtml}</div>
    </div>`;

  document.body.appendChild(modal);
}
