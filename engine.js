(function (root) {
  "use strict";
  const has = (u, k) => u.keywords.includes(k);
  const Champions =
    typeof module !== "undefined"
      ? require("./champions.js")
      : root.ChampionRules;
  const instant = c => ["Burst", "Focus"].includes(c.speed);
  const targeted = c => !!c.ruleTarget || !!c.targetSlots || ["buff", "heal", "damage", "kill", "frostbite", "judgment"].includes(c.effect);
  function neededCatalog(catalog,codes){
    const selected={};
    function add(code){if(!catalog[code]||selected[code])return;selected[code]=catalog[code];visit(catalog[code]);}
    function visit(value){
      if(Array.isArray(value)){for(const item of value)visit(item);return;}
      if(!value||typeof value!=="object")return;
      if(value.code)add(value.code);
      if(value.recallAs)add(value.recallAs);
      if(value.reviveAs)add(value.reviveAs);
      if(value.attackSkillCode)add(value.attackSkillCode);
      if(value.survivalToken)add(value.survivalToken);
      if(value.pool)for(const code of value.pool)add(code);
      for(const child of Object.values(value))visit(child);
    }
    for(const code of codes)add(code);
    return selected;
  }
  function hydrate(s,catalog){
    const codes=new Set();
    function visit(value){
      if(Array.isArray(value)){for(const item of value)visit(item);return;}
      if(!value||typeof value!=="object")return;
      for(const key of ['code','championKey','spellFrom','recallAs','reviveAs','attackSkillCode','survivalToken'])
        if(value[key])codes.add(value[key]);
      for(const child of Object.values(value))visit(child);
    }
    for(const p of s.players){
      for(const zone of ['hand','board','deck'])visit(p[zone]);
      p.scheduled||=[];p.globalBuffs||=[];p.leveledChampions||=[];p.graveyard||=[];p.roundStartEffects||=[];
      for(const key of ['deathsThisRound','deathsTotal','stunsRecalls','summoned8'])p[key]??=0;
      p.maxMana??=Math.min(10,s.round);
      visit(p.scheduled);visit(p.globalBuffs);visit(p.graveyard);visit(p.roundStartEffects);
    }
    visit(s.stack);visit(s.combat?.skills);
    s.cardCatalog={...neededCatalog(catalog,[...codes]),...(s.cardCatalog||{})};
    s.presentationEvents||=[];
    return s;
  }
  function present(s, kind, owner, unit, target) {
    (s.presentationEvents ||= []).push({kind, owner, code:unit.code, id:unit.id, ...(target ? {target} : {})});
  }
  function fresh(s, code, owner) {
    const base = s.cardCatalog[code];
    if (!base) throw Error("Definição de carta ausente: " + code);
    const card={...structuredClone(base), id:"c" + s.nextId++, maxHealth:base.health};
    if(owner!==undefined)for(const rule of s.players[owner].globalBuffs||[])
      if((!rule.codeMatch||rule.codeMatch===code)&&(!rule.subtype||card.subtypes?.includes(rule.subtype)))buff(card,rule);
    if(owner!==undefined)syncConditional(s.players[owner],card);
    return card;
  }
  function syncConditional(player,unit){
    const spec=unit.conditionalStats;if(!spec)return;
    const active=(!spec.ifEnlightened||player.maxMana>=10);
    const attack=(active?spec.amount||0:0)-(unit.conditionalAttackApplied||0);
    const health=(active?spec.hp||0:0)-(unit.conditionalHealthApplied||0);
    unit.attack=Math.max(0,unit.attack+attack);unit.health+=health;unit.maxHealth=(unit.maxHealth??unit.health-health)+health;
    unit.conditionalAttackApplied=active?spec.amount||0:0;unit.conditionalHealthApplied=active?spec.hp||0:0;
  }
  function handAdd(s, i, card) {
    if (s.players[i].hand.length < 10) s.players[i].hand.push(card);
    else log(s, card.name + " foi descartada: mão cheia.");
  }
  function discard(s,i,card){
    s.players[i].hand=s.players[i].hand.filter(c=>c.id!==card.id);
    runRules(s,i,card,card.onDiscard);
  }
  function summon(s, i, card) {
    if (s.players[i].board.length >= 6) return null;
    const u = typeof card === "string" ? fresh(s, card,i) : card;
    s.players[i].board.push(u);
    u.summonedRound = s.round;
    if(u.cost>=8)s.players[i].summoned8=(s.players[i].summoned8||0)+1;
    present(s,"summon",i,u);
    if (has(u,"Attune")) s.players[i].spellMana=Math.min(3,s.players[i].spellMana+1);
    for (const ally of [...s.players[i].board]) {
      if (ally.id !== u.id && ally.health > 0)
        runRules(s,i,ally,ally.onOtherSummon,u.id);
    }
    runRules(s,i,u,u.onSummon);
    Champions.summoned(s,i,u);
    return u;
  }
  function recall(s, i, u) {
    const side=s.players.findIndex(p=>p.board.some(c=>c.id===u.id));
    if(side<0)return;
    s.players[side].board=s.players[side].board.filter(c=>c.id!==u.id);
    present(s,"recall",side,u);
    runRules(s,side,u,u.onRecall);
    handAdd(s,side,fresh(s,u.recallAs || u.championKey || u.code,side));
    s.players[i].stunsRecalls=(s.players[i].stunsRecalls||0)+1;
  }
  function stun(s,i,u,c) {
    u.stunned=true;
    present(s,"stun",1-i,c||u,u.id);
    s.players[i].stunsRecalls=(s.players[i].stunsRecalls||0)+1;
    if(s.combat){
      s.combat.ids=s.combat.ids.filter(id=>id!==u.id);
      for(const [a,b] of Object.entries(s.combat.blocks||{}))
        if(b===u.id)delete s.combat.blocks[a];
      for(const [a,b] of Object.entries(s.combat.forcedBlocks||{}))
        if(b===u.id||a===u.id)delete s.combat.forcedBlocks[a];
    }
  }
  function ruleUnits(s,i,c,r,target) {
    const own=s.players[i], enemy=s.players[1-i];
    if(r.targetIndex!==undefined)target=target?.[r.targetIndex];
    let units = r.scope==="self" ? (c.health>0?[c]:[]) :
      (!r.scope||r.scope==="target") ? s.players.flatMap(p=>[...p.board,...p.hand]).filter(u=>Array.isArray(target)?target.includes(u.id):u.id===target) :
      r.scope==="all" ? s.players.flatMap(p=>p.board) :
      r.scope==="enemy" ? enemy.board : r.scope==="hand" ? own.hand :
      r.scope==="deck" ? own.deck : r.scope==="global" ? [...own.board,...own.hand,...own.deck] : own.board;
    units=units.filter(u=>u.type==="unit" && (!r.other || u.id!==c.id) &&
      (!r.subtype || u.subtypes?.includes(r.subtype)) &&
      (!r.followersOnly || !u.champion) &&
      (!r.exceptTarget || u.id!==target) &&
      (!r.summonedThisRound || u.summonedRound===s.round) &&
      (!r.codeMatch || u.code===r.codeMatch) &&
      (!r.ephemeral || has(u,"Ephemeral")) &&
      (r.maxPower===undefined||u.attack<=r.maxPower) &&
      (r.minPower===undefined||u.attack>=r.minPower) &&
      (r.minCost===undefined||u.cost>=r.minCost) &&
      (r.maxCost===undefined||u.cost<=r.maxCost) &&
      (r.maxHealth===undefined||u.health<=r.maxHealth) &&
      (!r.damaged||u.health<u.maxHealth) &&
      (!r.stunnedOrDamaged||u.stunned||u.health<u.maxHealth) &&
      (!r.combat||s.combat&&(s.combat.ids.includes(u.id)||Object.values(s.combat.blocks||{}).includes(u.id))));
    if(r.strongest)units.sort((a,b)=>b.attack-a.attack||b.health-a.health||b.cost-a.cost);
    if(r.weakest)units.sort((a,b)=>a.attack-b.attack||a.health-b.health||a.cost-b.cost);
    if(r.top)units=units.slice().reverse();
    return r.limit ? units.slice(0,r.limit) : units;
  }
  function runRules(s,i,c,rules,target,blocked=[]) {
    const p=s.players[i];
    for(const r of rules||[]){
      if(r.ifDiedRound && !p.deathsThisRound)continue;
      if(r.ifDeathsRound && (p.deathsThisRound||0)<r.ifDeathsRound)continue;
      if(r.ifOtherRegion && !p.board.some(u=>u.id!==c.id&&u.region===r.ifOtherRegion))continue;
      if(r.ifTargetEphemeral&&!p.board.some(u=>u.id===target&&has(u,"Ephemeral")))continue;
      const picked=s.players.flatMap(p=>[...p.board,...p.hand]).find(u=>u.id===(Array.isArray(target)?target[r.targetIndex||0]:target));
      if(r.ifAllyMinPower&&!p.board.some(u=>u.attack>=r.ifAllyMinPower))continue;
      if(r.ifTargetSubtype&&!picked?.subtypes?.includes(r.ifTargetSubtype))continue;
      if(r.ifTargetDamaged&&!(picked?.health<picked?.maxHealth))continue;
      if(r.ifTargetUndamaged&&!(picked?.health===picked?.maxHealth))continue;
      if(r.ifTargetAlive&&!picked)continue;
      let units=ruleUnits(s,i,c,r,target).filter(u=>!blocked.includes(u.id));
      const n=r.perDeath ? (p.deathsTotal||0) : r.perOtherAlly ? p.board.filter(u=>u.id!==c.id).length :
        r.perStunRecall ? (p.stunsRecalls||0) : r.amount||0;
      if(r.action==="buff"){
        const spec={...r,amount:n,hp:r.hpPerAmount?n:r.hp};
        for(const u of units)buff(u,spec);
        if(r.scope==="global")(p.globalBuffs||=[]).push(spec);
      }
      else if(r.action==="draw")for(let k=0;k<n;k++)draw(s,i,r.filter,r.discount);
      else if(r.action==="drawBoth")for(let side=0;side<2;side++)for(let k=0;k<n;k++)draw(s,side);
      else if(r.action==="damage")for(const u of units)damage(u,r.cannotKill?Math.min(n,Math.max(0,u.health-1)+(has(u,'Tough')?1:0)):n,s);
      else if(r.action==='damageAnything'){
        const id=r.targetIndex!==undefined?target?.[r.targetIndex]:target;
        if(id==='nexus')s.players[1-i].nexus-=n;
        else if(id==='my-nexus')p.nexus-=n;
        else for(const u of units)damage(u,n,s);
      }
      else if(r.action==="drainTarget")for(const u of units){const dealt=damage(u,n,s);p.nexus=Math.min(20,p.nexus+dealt);}
      else if(r.action==="nexusDamage")s.players[1-i].nexus-=n;
      else if(r.action==="bothNexusDamage"){p.nexus-=n;s.players[1-i].nexus-=n;}
      else if(r.action==="drainNexus"){s.players[1-i].nexus-=n;p.nexus=Math.min(20,p.nexus+n);}
      else if(r.action==="halfNexus")s.players[1-i].nexus-=Math.ceil(s.players[1-i].nexus/2);
      else if(r.action==="healNexus")p.nexus=Math.min(20,p.nexus+n);
      else if(r.action==='healAnything'){
        if(target==='my-nexus')p.nexus=Math.min(20,p.nexus+n);
        else for(const u of units)u.health=Math.min(u.maxHealth,u.health+n);
      }
      else if(r.action==='healNexusDamageSelf'){
        const healed=Math.min(n,Math.max(0,20-p.nexus));p.nexus+=healed;damage(c,healed,s);
      }
      else if(r.action==="heal")for(const u of units)u.health=Math.min(u.maxHealth,u.health+n);
      else if(r.action==="healFull")for(const u of units)u.health=u.maxHealth;
      else if(r.action==="doubleStats")for(const u of units){u.attack*=2;u.maxHealth+=u.health;u.health*=2;}
      else if(r.action==="kill")for(const u of units)u.health=0;
      else if(r.action==="stun")for(const u of units)stun(s,i,u,c);
      else if(r.action==="freeze")for(const u of units){u.tempAttack=(u.tempAttack||0)-u.attack;u.attack=0;}
      else if(r.action==="shatter")for(const u of units){if(u.attack===0)damage(u,n,s);else{u.tempAttack=(u.tempAttack||0)-u.attack;u.attack=0;}}
      else if(r.action==="killDamagedElseDamage")for(const u of units){if(u.health<u.maxHealth)u.health=0;else damage(u,n,s);}
      else if(r.action==="recall")for(const u of [...units])recall(s,i,u);
      else if(r.action==="returnSelf")handAdd(s,i,fresh(s,c.championKey||c.code,i));
      else if(r.action==="refill")p.spellMana=Math.min(3,p.spellMana+n);
      else if(r.action==="rally"){s.attackTokens[i]=true;if(s.token===i)s.attackAvailable=true;}
      else if(r.action==="schedule")(p.scheduled||=[]).push({round:s.round+1,rules:r.rules,card:structuredClone(c),target});
      else if(r.action==="ramp"){
        const gems=Math.min(n,10-p.maxMana);p.maxMana+=gems;
        if(!r.empty)p.mana=Math.min(p.maxMana,p.mana+gems);
        if(r.temporary)p.tempManaGems=(p.tempManaGems||0)+gems;
      }
      else if(r.action==="revive"){
        let dead=[...(p.graveyard||[])].filter(u=>(!r.roundOnly||u.diedRound===s.round)&&(!r.champion||u.champion));
        if(r.strongest)dead.sort((a,b)=>b.attack-a.attack||b.maxHealth-a.maxHealth||b.cost-a.cost);
        if(r.random&&dead.length)dead=[dead[Math.floor(rng(s)*dead.length)]];
        for(const old of dead.slice(0,r.count||1)){
          const revived=fresh(s,old.championKey||old.code,i);
          if(r.ephemeral&&!has(revived,'Ephemeral'))revived.keywords.push('Ephemeral');
          summon(s,i,revived);
        }
      }
      else if(r.action==='killRevive')for(const ally of units){
        const from=(p.graveyard||[]).length;ally.health=0;clean(s);
        if(p.graveyard.slice(from).some(dead=>dead.id===ally.id))for(let k=0;k<(r.count||1);k++){
          const copy=fresh(s,ally.championKey||ally.code,i);if(r.ephemeral&&!has(copy,'Ephemeral'))copy.keywords.push('Ephemeral');summon(s,i,copy);
        }
      }
      else if(r.action==="summonDeckTop"){
        if(p.board.length<6){const index=p.deck.findLastIndex(u=>u.type==='unit');if(index>=0)summon(s,i,p.deck.splice(index,1)[0]);}
        if(r.repeat)(p.roundStartEffects||=[]).push({card:structuredClone(c),rules:[{action:'summonDeckTop'}]});
      }
      else if(r.action==="strikePair"){
        const [first,second]=(target||[]).map(id=>s.players.flatMap(p=>p.board).find(u=>u.id===id));
        if(first&&second&&!blocked.includes(first.id)&&!blocked.includes(second.id))strikePair(s,i,first,second,r.mutual,r.overwhelm);
      }
      else if(r.action==="atrocity"){
        const ally=p.board.find(u=>u.id===target?.[0]),victim=target?.[1];
        if(ally&&!blocked.includes(ally.id)){
          const power=ally.attack;ally.health=0;clean(s);
          if(victim==='nexus')s.players[1-i].nexus-=power;
          else if(victim==='my-nexus')p.nexus-=power;
          else{const u=s.players.flatMap(p=>p.board).find(u=>u.id===victim);if(u&&!blocked.includes(u.id))damage(u,power,s);}
        }
      }
      else if(r.action==="summon"||r.action==="create"){
        for(let k=0;k<(r.count||1);k++){
          const code=r.code || r.pool[Math.floor(rng(s)*r.pool.length)];
          if(r.action==="summon")summon(s,r.enemy?1-i:i,code);
          else {const copy=fresh(s,code,i);if(r.fleeting)copy.fleeting=true;handAdd(s,i,copy);}
        }
      }
      else if(r.action==="copySummon")for(const u of units)for(let k=0;k<(r.count||1);k++){
        const copy={...structuredClone(u),id:"c"+s.nextId++};
        if(r.ephemeralCopy&&!has(copy,"Ephemeral"))copy.keywords.push("Ephemeral");
        if(r.one){copy.attack=1;copy.health=1;copy.maxHealth=1;copy.tempAttack=copy.tempHealth=0;}
        summon(s,i,copy);
      }
      else if(r.action==="copyHand")for(const u of units){const copy=fresh(s,u.championKey||u.code,i);if(r.ephemeralCopy)copy.keywords.push("Ephemeral");if(r.amount||r.hp)buff(copy,{...r,permanent:true});handAdd(s,i,copy);}
      else if(r.action==="obliterateWeak")for(const side of s.players){side.board=side.board.filter(u=>u.attack>n||blocked.includes(u.id));side.hand=side.hand.filter(u=>u.type!=="unit"||u.attack>n);}
      else if(r.action==="watcher"){
        const e=s.players[1-i],keep=[];
        for(let k=e.deck.length-1;k>=0;k--)if(!e.deck[k].champion&&keep.length<3)keep.unshift(e.deck[k]);
        e.deck=keep;
      }
      else if(r.action==="discountHand"){for(const u of p.hand)if(!r.unitsOnly||u.type==="unit")u.cost=Math.max(0,u.cost-n);}
      else if(r.action==='discountMostExpensiveUnit'){
        const card=p.hand.filter(u=>u.type==='unit').sort((a,b)=>b.cost-a.cost)[0];if(card)card.cost=Math.max(0,card.cost-n);
      }
      else if(r.action==='fillHand')while(p.hand.length<10)handAdd(s,i,fresh(s,r.code,i));
      else if(r.action==="doubleAttack")for(const u of units)u.attack*=2;
      else if(r.action==="powerToHealth")for(const u of units)u.attack=Math.max(u.attack,u.health);
      else if(r.action==="obliterateBottom")s.players[1-i].deck.splice(0,n);
      else if(r.action==="discardEnemyWeakestFollower"){
        const enemy=s.players[1-i],list=enemy.hand.filter(u=>u.type==="unit"&&!u.champion).sort((a,b)=>a.attack-b.attack||a.health-b.health||a.cost-b.cost);
        if(list[0])discard(s,1-i,list[0]);
      }
      else if(r.action==="discardEnemyHighestCost"){
        const enemy=s.players[1-i],list=[...enemy.hand].sort((a,b)=>b.cost-a.cost);
        if(list[0])discard(s,1-i,list[0]);
      }
      else if(r.action==="drawPerAlly"){const count=p.board.filter(u=>u.attack>=r.minPower).length;for(let k=0;k<count;k++)draw(s,i);}
      else if(r.action==="summonMatchingSelf"){
        const copy=fresh(s,r.code,i);copy.attack=c.attack;copy.health=c.health;copy.maxHealth=c.maxHealth;summon(s,i,copy);
      }
      else if(r.action==="regenerationGift")for(const u of units){if(has(u,"Regeneration"))buff(u,{amount:2,hp:2,permanent:true});else buff(u,{permanent:true,grantKeywords:["Regeneration"]});}
      else throw Error("Regra sem implementação: "+r.action);
      // A sequential instruction observes the board after the previous deaths
      // and last breaths. Remove the whole dead wave before firing any trigger.
      if(s.players.some(player=>player.board.some(u=>u.health<=0)))clean(s);
    }
  }
  function strikePair(s,owner,a,b,mutual=false,overwhelm=false){
    const power=a.attack,back=b.attack,hp=b.health,tough=has(b,'Tough'),dealt=damage(b,power,s);
    if(power>0){Champions.strike(a);runRules(s,owner,a,a.onStrike,b.id);}
    if(mutual){const returned=damage(a,back,s);if(back>0){Champions.strike(b);runRules(s,1-owner,b,b.onStrike,a.id);}lifesteal(s,1-owner,b,returned);}
    const excess=overwhelm&&has(a,'Overwhelm')?Math.max(0,power-hp-(tough?1:0)):0;
    s.players[1-owner].nexus-=excess;
    lifesteal(s,owner,a,(excess?Math.min(hp,dealt):dealt)+excess);
    if(b.health<=0&&a.health>0&&has(a,'Fury'))buff(a,{amount:1,hp:1,permanent:true});
    if(a.health<=0&&b.health>0&&has(b,'Fury'))buff(b,{amount:1,hp:1,permanent:true});
    if(power>0&&has(a,'Ephemeral'))a.health=0;
    if(mutual&&back>0&&has(b,'Ephemeral'))b.health=0;
  }
  function rng(s) {
    s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0;
    return s.seed / 4294967296;
  }
  function log(s, t) {
    s.log.push(t);
    s.log = s.log.slice(-45);
  }
  function check(s) {
    const dead = s.players.map((p) => p.nexus <= 0);
    if (dead.some(Boolean)) {
      s.winner = dead[0] && dead[1] ? "draw" : dead[0] ? 1 : 0;
      s.phase = "over";
    }
  }
  function draw(s, i, filter, discount=0) {
    const p = s.players[i];
    if (!p.deck.length) {
      p.nexus = 0;
      log(s, "Deck esgotado.");
      check(s);
      return;
    }
    const index=filter ? p.deck.findLastIndex(c=>(!filter.type||c.type===filter.type)&&(!filter.champion||c.champion)&&(!filter.minPower||c.attack>=filter.minPower)&&(!filter.maxCost||c.cost<=filter.maxCost)&&(!filter.subtype||c.subtypes?.includes(filter.subtype))) : p.deck.length-1;
    if(index<0)return;
    const c = p.deck.splice(index,1)[0];
    c.cost=Math.max(0,c.cost-discount);
    if (p.hand.length < 10) p.hand.push(c);
    else {log(s, c.name + " foi descartada: mão cheia.");for(const u of [...p.board])runRules(s,i,u,u.onOverdraw,c.id);}
    for(const u of [...p.board])runRules(s,i,u,u.onDraw,c.id);
  }
  function create(catalog, deck0, deck1, seed, options = {}) {
    const s = {
      version: 1,
      rulesVersion: options.faithful ? 5 : 4,
      seed: seed >>> 0,
      nextId: 1,
      round: 0,
      token: 1,
      priority: 0,
      passes: 0,
      phase: "main",
      winner: null,
      combat: null,
      log: [],
      players: [],
      cardCatalog: neededCatalog(catalog,[...deck0,...deck1]),
      presentationEvents: [],
    };
    for (const list of [deck0, deck1]) {
      const deck = list.map((code) => {
        if (!catalog[code]) throw Error("Carta desconhecida");
        return {
          ...catalog[code],
          keywords: [...catalog[code].keywords],
          id: "c" + s.nextId++,
          maxHealth: catalog[code].health,
        };
      });
      for (let j = deck.length - 1; j > 0; j--) {
        const k = Math.floor(rng(s) * (j + 1));
        [deck[j], deck[k]] = [deck[k], deck[j]];
      }
      s.players.push({
        nexus: 20,
        mana: 0,
        maxMana: 0,
        spellMana: 0,
        hand: [],
        board: [],
        deck,
        leveledChampions: [],
        deathsThisRound: 0,
        deathsTotal: 0,
        scheduled: [],
        graveyard: [],
        roundStartEffects: [],
      });
    }
    for (let j = 0; j < 4; j++) for (let i = 0; i < 2; i++) draw(s, i);
    if (options.faithful && !options.skipMulligan) s.phase = "mulligan";
    else round(s);
    return s;
  }
  function mulligan(s, ids) {
    if (
      s.phase !== "mulligan" ||
      !Array.isArray(ids) ||
      new Set(ids).size !== ids.length ||
      ids.some((id) => !s.players[0].hand.some((c) => c.id === id))
    )
      throw Error("Troca inicial inválida.");
    for (let i = 0; i < 2; i++) {
      const p = s.players[i];
      const replace =
        i === 0 ? ids : p.hand.filter((c) => c.cost >= 4).map((c) => c.id);
      const returned = p.hand.filter((c) => replace.includes(c.id));
      p.hand = p.hand.filter((c) => !replace.includes(c.id));
      for (let n = 0; n < returned.length; n++) draw(s, i);
      p.deck.push(...returned);
      for (let j = returned.length ? p.deck.length - 1 : 0; j > 0; j--) {
        const k = Math.floor(rng(s) * (j + 1));
        [p.deck[j], p.deck[k]] = [p.deck[k], p.deck[j]];
      }
    }
    s.phase = "main";
    log(s, "Mão inicial confirmada.");
    round(s);
  }
  function round(s) {
    if(s.round>0)for(let i=0;i<2;i++)for(const u of [...s.players[i].board])runRules(s,i,u,u.onRoundEnd);
    clean(s);
    if(s.winner!==null)return;
    s.round++;
    s.token = 1 - s.token;
    s.attackAvailable = true;
    s.attackTokens = [s.token === 0, s.token === 1];
    s.priority = s.token;
    s.passes = 0;
    for (let i = 0; i < 2; i++) {
      const p = s.players[i];
      p.hand=p.hand.filter(c=>!c.fleeting);
      p.spellMana = Math.min(3, p.spellMana + p.mana);
      p.maxMana=Math.min(10,Math.max(0,(p.maxMana??s.round-1)-(p.tempManaGems||0))+1);
      p.tempManaGems=0;
      p.mana = p.maxMana;
      for (const u of p.board) {
        if (has(u, "Ephemeral")) u.health = 0;
        u.keywords = u.keywords.filter((k) => k !== "Barrier");
        u.attack -= u.tempAttack || 0;
        u.health -= u.tempHealth || 0;
        u.maxHealth -= u.tempHealth || 0;
        u.tempAttack = 0;
        u.tempHealth = 0;
        if (u.tempKeywords?.length)
          u.keywords = u.keywords.filter((k) => !u.tempKeywords.includes(k));
        u.tempKeywords = [];
        u.stunned=false;
        if (has(u, "Regeneration") && !has(u, "Ephemeral"))
          u.health = u.maxHealth;
      }
    }
    clean(s);
    if (s.winner !== null) return;
    Champions.roundStart(s);
    for(let i=0;i<2;i++){
      const p=s.players[i];
      p.deathsThisRound=0;
      const ready=(p.scheduled||[]).filter(t=>t.round<=s.round);
      p.scheduled=(p.scheduled||[]).filter(t=>t.round>s.round);
      for(const task of ready)runRules(s,i,task.card,task.rules,task.target);
      for(const task of [...(p.roundStartEffects||[])])runRules(s,i,task.card,task.rules);
      for(const u of [...p.board])runRules(s,i,u,u.onRoundStart);
    }
    clean(s);
    for (let i = 0; i < 2; i++) draw(s, i);
    log(
      s,
      "Rodada " +
        s.round +
        " · " +
        (s.token === 0 ? "Você" : "Bot") +
        " tem o ataque.",
    );
  }
  function turn(s, i) {
    if (s.phase !== "main" || s.priority !== i || s.winner !== null)
      throw Error("Aguarde sua ação.");
  }
  function validTarget(s, i, c, target) {
    if(c.targetSlots){
      return Array.isArray(target)&&target.length===c.targetSlots.length&&new Set(target).size===target.length&&target.every((id,index)=>validTarget(s,i,{...c,targetSlots:null,targetCount:0,ruleTarget:c.targetSlots[index]},id));
    }
    if(c.targetCount>1){
      const single={...c,targetCount:0};
      return Array.isArray(target)&&target.length>=1&&target.length<=c.targetCount&&new Set(target).size===target.length&&target.every(id=>validTarget(s,i,single,id));
    }
    const own = s.players[i].board.find((u) => u.id === target),
      enemy = s.players[1 - i].board.find((u) => u.id === target);
    if(c.ruleTarget){
      const t=c.ruleTarget;
      if(target==='nexus'&&['enemy','any','both'].includes(t.allowNexus))return true;
      if(target==='my-nexus'&&['ally','any','both'].includes(t.allowNexus))return true;
      const ownUnit=t.zone==='hand'?s.players[i].hand.find(u=>u.id===target&&u.id!==c.id):own;
      const enemyUnit=t.zone==='hand'?s.players[1-i].hand.find(u=>u.id===target):enemy;
      const u=t.side==="ally"?ownUnit:t.side==="enemy"?enemyUnit:ownUnit||enemyUnit;
      return !!u && (!t.follower||!u.champion) &&
        (!t.keyword||has(u,t.keyword)) &&
        (t.type===undefined||u.type===t.type)&&
        (t.minPower===undefined||u.attack>=t.minPower) &&
        (t.maxHealth===undefined||u.health<=t.maxHealth) &&
        (t.maxPower===undefined||u.attack<=t.maxPower) &&
        (!t.damaged||u.health<u.maxHealth) &&
        (!t.stunnedOrDamaged||u.stunned||u.health<u.maxHealth) &&
        (!t.attacking||s.combat&&s.combat.ids.includes(u.id)) &&
        (!t.combat||s.combat&&(s.combat.ids.includes(u.id)||Object.values(s.combat.blocks||{}).includes(u.id)));
    }
    if (c.effect === "heal") return target === "my-nexus" || !!own;
    if (c.effect === "kill") {
      const u = enemy || (c.targetMode === "any" ? own : null);
      return !!u && (c.maxPower === undefined || u.attack <= c.maxPower);
    }
    if (c.effect === "frostbite") return !!enemy;
    if (c.effect === "judgment")
      return (
        !!s.combat &&
        ["block", "response"].includes(s.phase) &&
        s.players[i].board.some((u) => u.id === target) &&
        (s.combat.owner === i
          ? s.combat.ids.includes(target)
          : Object.values(s.combat.blocks || {}).includes(target))
      );
    if (c.effect === "buff")
      return s.players[i].board.some((u) => u.id === target);
    if (c.effect === "damage")
      return (
        (!c.unitsOnly &&
          (target === "nexus" ||
            (c.targetMode === "any" && target === "my-nexus"))) ||
        !!enemy ||
        (c.targetMode === "any" && !!own)
      );
    return true;
  }
  function playable(s, i, c) {
    c = Champions.view(s, i, c);
    if(c.targetSlots&&!hasTargetSelection(s,i,c)&&c.type!=='unit')return false;
    if (targeted(c) && !targets(s, i, c).length && c.type!=="unit")
      return false;
    if(c.requiresDeathsRound&&(s.players[i].deathsThisRound||0)<c.requiresDeathsRound)return false;
    if (c.effect === "buffAll" && !s.players[i].board.length) return false;
    if (c.effect === "buff" && !s.players[i].board.length) return false;
    if (s.phase === "mulligan" || s.phase === "over") return false;
    if (
      s.phase === "response" &&
      (c.type !== "spell" || !["Burst", "Fast"].includes(c.speed))
    )
      return false;
    if (
      s.phase === "response" &&
      c.speed === "Fast" &&
      (s.stack || []).length >= 9
    )
      return false;
    if (
      c.effect === "judgment" &&
      (!s.combat || !s.players[i].board.some((u) => validTarget(s, i, c, u.id)))
    )
      return false;
    if (
      s.phase === "block" &&
      (c.type !== "spell" || !["Burst", "Fast"].includes(c.speed))
    )
      return false;
    return (
      c.cost <=
        s.players[i].mana + (c.type === "spell" ? s.players[i].spellMana : 0) &&
      (c.type === "spell" || s.players[i].board.length < 6)
    );
  }
  function damage(u, n, s) {
    if (n > 0 && has(u, "Barrier")) {
      u.keywords = u.keywords.filter((k) => k !== "Barrier");
      return 0;
    }
    const dealt = Math.max(0, n - (has(u, "Tough") ? 1 : 0));
    u.health -= dealt;
    if(s&&u.health<=0&&u.championKey==='01FR039'&&u.level===1)Champions.preventDeaths(s);
    if(s&&dealt>0&&u.health>0){
      const owner=s.players.findIndex(p=>p.board.some(c=>c.id===u.id));
      if(owner>=0){
        const token=Champions.survived(s,owner,u,dealt);
        if(token)summon(s,owner,token);
        runRules(s,owner,u,u.onSurviveDamage);
      }
    }
    return dealt;
  }
  function clean(s) {
    for(const p of s.players)for(const zone of ['board','hand','deck'])for(const u of p[zone])syncConditional(p,u);
    let dead;
    do {
      Champions.preventDeaths(s);
      dead=s.players.flatMap((p,i)=>p.board.filter(u=>u.health<=0).map(u=>({owner:i,unit:u})));
      for(const p of s.players)p.board=p.board.filter(u=>u.health>0);
      for(const {owner:i,unit:u} of dead){
        const p=s.players[i];p.deathsThisRound=(p.deathsThisRound||0)+1;p.deathsTotal=(p.deathsTotal||0)+1;
        (p.graveyard||=[]).push({...structuredClone(u),diedRound:s.round});
        present(s,"death",i,u);
        if(u.effect==="lastDamage"){s.players[1-i].nexus--;lifesteal(s,i,u,1);}
        for(const ally of [...p.board])runRules(s,i,ally,ally.onAllyDeath,u.id);
        runRules(s,i,u,u.onDeath);
      }
    }while(dead.length&&s.players.some(p=>p.board.some(u=>u.health<=0)));
    check(s);
    Champions.check(s);
    if (s.combat) {
      s.combat.ids = s.combat.ids.filter((id) =>
        s.players[s.combat.owner].board.some((u) => u.id === id),
      );
      if (s.combat.blocks)
        for (const [a, b] of Object.entries(s.combat.blocks))
          if (
            !s.combat.ids.includes(a) ||
            !s.players[1 - s.combat.owner].board.some((u) => u.id === b)
          )
            if (!s.combat.locked) delete s.combat.blocks[a];
      for(const [a,b] of Object.entries(s.combat.forcedBlocks||{}))
        if(!s.combat.ids.includes(a)||!s.players[1-s.combat.owner].board.some(u=>u.id===b))delete s.combat.forcedBlocks[a];
    }
  }
  function play(s, i, id, target) {
    if (["block", "response"].includes(s.phase)) {
      if (s.priority !== i || s.winner !== null)
        throw Error("Aguarde sua ação.");
    } else turn(s, i);
    const p = s.players[i],
      original = p.hand.find((u) => u.id === id),
      c = original && Champions.view(s, i, original);
    const optional=c?.type==="unit"&&targeted(c)&&!hasTargetSelection(s,i,c);
    if (!c || !playable(s, i, c) || (!optional&&!validTarget(s, i, c, target)))
      throw Error("Carta ou alvo indisponível.");
    s.presentationEvents=[];
    let cost = c.cost;
    if (c.type === "spell") {
      const bank = Math.min(p.spellMana, cost);
      p.spellMana -= bank;
      cost -= bank;
    }
    p.mana -= cost;
    p.hand = p.hand.filter((u) => u.id !== id);
    if(c.type==="spell")for(const u of [...p.board])runRules(s,i,u,u.onSpell);
    if(s.winner!==null)return;
    if (s.rulesVersion >= 5 && c.type === "spell" && !instant(c)) {
      if (s.phase !== "response") {
        s.responseContext = s.combat ? "combat" : "main";
        s.stackOrigin = i;
        s.stack = s.combat ? structuredClone(s.combat.skills||[]) : [];
        if(s.combat)s.combat.skills=[];
        if (s.combat) lockBlocks(s);
      }
      s.stack.push({
        owner: i,
        card: structuredClone(c),
        original: structuredClone(original),
        target,
      });
      s.phase = "response";
      s.responsePasses = 1;
      s.priority = 1 - i;
      s.passes = 0;
      log(s, (i === 0 ? "Você" : "Bot") + " preparou " + c.name + ".");
      return;
    }
    if (c.type === "unit") {
      summon(s,i,c);
      if(!optional&&c.onPlay?.length){
        if(c.skill&&s.rulesVersion>=5){
          const ability={...c,type:"spell",speed:"Fast",effect:"rules",rules:c.onPlay};
          s.stack=[{owner:i,card:ability,original:structuredClone(original),target}];
          s.responseContext="main";s.stackOrigin=i;s.responsePasses=1;s.phase="response";s.priority=1-i;
        }else runRules(s,i,c,c.onPlay,target);
      }
    } else applySpell(s, i, c, original, target);
    log(s, (i === 0 ? "Você" : "Bot") + " jogou " + c.name + ".");
    if (s.rulesVersion < 5 || !instant(c)) s.passes = 0;
    if (s.phase === "main" && !instant(c)) s.priority = 1 - i;
    clean(s);
  }
  function applySpell(s, i, c, original, target) {
    const p = s.players[i];
    if(!c.targetSlots&&c.targetCount>1&&Array.isArray(target))target=target.filter(id=>validTarget(s,i,{...c,targetCount:0},id));
    if (!validTarget(s, i, c, target)) {
      log(s, c.name + " perdeu seu alvo e não resolveu.");
      return false;
    }
    present(s,"spell",i,c,target);
    const affected = c.effect==="rules" ? (c.rules||[]).flatMap(r=>ruleUnits(s,i,c,r,target)).map(u=>u.id) :
      ["killAll","sweep"].includes(c.effect) ? s.players[1-i].board.map(u=>u.id) : [target];
    const protectedIds=[];
    for(const u of s.players[1-i].board)
      if(affected.includes(u.id)&&has(u,"SpellShield")){
        u.keywords=u.keywords.filter(k=>k!=="SpellShield");protectedIds.push(u.id);
      }
    if(protectedIds.includes(target)&&c.effect!=="rules")return true;
    if (c.effect === "nexusDamage") s.players[1 - i].nexus -= c.amount;
    else if (c.effect === "damage") {
      let dealt = c.amount;
      if (target === "nexus") s.players[1 - i].nexus -= c.amount;
      else if (target === "my-nexus") p.nexus -= c.amount;
      else
        dealt = damage(
          s.players.flatMap((p) => p.board).find((u) => u.id === target),
          c.amount,s,
        );
      if (c.drain) p.nexus = Math.min(20, p.nexus + dealt);
    } else if (c.effect === "buff") {
      const u = p.board.find((u) => u.id === target);
      buff(u, c);
    } else if (c.effect === "buffAll") {
      for (const u of p.board) buff(u, c);
    } else if (c.effect === "heal") {
      if (target === "my-nexus") p.nexus = Math.min(20, p.nexus + c.amount);
      else {
        const u = p.board.find((u) => u.id === target);
        u.health = Math.min(u.maxHealth, u.health + c.amount);
      }
      for (let n = 0; n < (c.draw || 0); n++) draw(s, i);
    } else if (c.effect === "kill") {
      s.players.flatMap((p) => p.board).find((u) => u.id === target).health = 0;
    } else if (c.effect === "killAll") {
      for (const u of s.players.flatMap((p) => p.board)) if(!protectedIds.includes(u.id))u.health = 0;
    } else if (c.effect === "sweep") {
      for (let side = 0; side < 2; side++)
        if (!c.enemyOnly || side !== i)
          for (const u of s.players[side].board) if(!protectedIds.includes(u.id))damage(u, c.amount,s);
      if (c.heal) p.nexus = Math.min(20, p.nexus + c.heal);
    } else if (c.effect === "rally") {
      s.attackTokens ||= [
        s.token === 0 && s.attackAvailable,
        s.token === 1 && s.attackAvailable,
      ];
      s.attackTokens[i] = true;
      if (s.token === i) s.attackAvailable = true;
    } else if (c.effect === "frostbite") {
      const u = s.players[1 - i].board.find((u) => u.id === target);
      u.tempAttack = (u.tempAttack || 0) - u.attack;
      u.attack = 0;
    } else if (c.effect === "judgment") {
      const ally = p.board.find((u) => u.id === target),
        enemies = s.players[1 - i].board.filter((u) =>
          s.combat.owner === 1 - i
            ? s.combat.ids.includes(u.id)
            : Object.values(s.combat.blocks || {}).includes(u.id),
        );
      for (const enemy of enemies) {
        const dealt = damage(enemy, ally.attack,s);
        lifesteal(s, i, ally, dealt);
        Champions.strike(ally);
      }
      if (ally.attack > 0 && enemies.length && has(ally, "Ephemeral"))
        ally.health = 0;
    } else if(c.effect==="rules")runRules(s,i,c,c.rules,target,protectedIds);
    if (c.spellFrom) {
      const copy=fresh(s,c.spellFrom,i);
      p.deck.splice(Math.floor(rng(s) * (p.deck.length + 1)), 0, copy);
    }
    clean(s);
    return true;
  }
  function buff(u, c) {
    const oldPower=u.attack;
    u.attack=Math.max(0,u.attack+(c.amount || 0));
    u.health += c.hp || 0;
    u.maxHealth += c.hp || 0;
    if (!c.permanent) {
      u.tempAttack = (u.tempAttack || 0) + u.attack-oldPower;
      u.tempHealth = (u.tempHealth || 0) + (c.hp || 0);
    }
    for (const k of c.grantKeywords || []) {
      if (!u.keywords.includes(k)) {
        u.keywords.push(k);
        if (!c.permanent) (u.tempKeywords ||= []).push(k);
      }
      if (c.permanent && u.tempKeywords)
        u.tempKeywords = u.tempKeywords.filter((old) => old !== k);
    }
  }
  function lifesteal(s, owner, unit, n) {
    if (has(unit, "Lifesteal") && n > 0)
      s.players[owner].nexus = Math.min(20, s.players[owner].nexus + n);
  }
  function hasTargetSelection(s,i,c,picked=[]){
    if(!c.targetSlots)return !targeted(c)||targets(s,i,c).length>0;
    if(picked.length===c.targetSlots.length)return true;
    return targets(s,i,c,picked).some(id=>hasTargetSelection(s,i,c,[...picked,id]));
  }
  function targets(s, i, card, picked=[]) {
    const viewed = Champions.view(s, i, card),c={...viewed,targetCount:0};
    if(c.targetSlots){
      const slot=c.targetSlots[picked.length];if(!slot)return [];
      return targets(s,i,{...c,targetSlots:null,ruleTarget:slot},[]).filter(id=>!picked.includes(id));
    }
    if (!targeted(c))
      return [];
    return [
      ...s.players.flatMap((p) => p.board).map((u) => u.id),
      ...(c.ruleTarget?.zone==='hand'?s.players.flatMap(p=>p.hand.map(u=>u.id)):[]),
      "nexus",
      "my-nexus",
    ].filter((id) => validTarget(s, i, c, id));
  }
  function pass(s, i) {
    if (s.phase === "response") {
      if (s.priority !== i || s.winner !== null)
        throw Error("Aguarde sua resposta.");
      s.presentationEvents=[];
      s.responsePasses++;
      s.priority = 1 - i;
      if (s.responsePasses >= 2) return resolveStack(s);
      return;
    }
    turn(s, i);
    s.presentationEvents=[];
    log(s, (i === 0 ? "Você" : "Bot") + " passou.");
    s.passes++;
    s.priority = 1 - i;
    if (s.passes === 2) round(s);
    Champions.check(s);
  }
  function attack(s, i, ids, challenges={}) {
    turn(s, i);
    if (
      !canAttack(s, i) ||
      !ids.length ||
      new Set(ids).size !== ids.length ||
      ids.some((id) => !s.players[i].board.some((u) => u.id === id&&!u.stunned&&!has(u,"Immobile")))
    )
      throw Error("Ataque indisponível.");
    const forced={},used=new Set();
    for(const [aid,bid] of Object.entries(challenges)){
      const a=s.players[i].board.find(u=>u.id===aid),b=s.players[1-i].board.find(u=>u.id===bid);
      if(!ids.includes(aid)||!a||!b||used.has(bid)||!canChallenge(a,b))throw Error("Desafio inválido.");
      forced[aid]=bid;used.add(bid);
    }
    s.presentationEvents=[];
    if (!s.attackTokens)
      s.attackTokens = [
        s.token === 0 && s.attackAvailable,
        s.token === 1 && s.attackAvailable,
      ];
    s.attackTokens[i] = false;
    if(ids.every(id=>has(s.players[i].board.find(u=>u.id===id),"Scout"))&&s.players[i].scoutRound!==s.round){
      s.attackTokens[i]=true;s.players[i].scoutRound=s.round;
    }
    if (s.token === i) s.attackAvailable = false;
    s.passes = 0;
    s.combat = { owner: i, ids: [...ids], forcedBlocks:forced, blocks:{...forced} };
    s.phase = "block";
    s.priority = 1 - i;
    for (const u of s.players[i].board.filter((u) => ids.includes(u.id))) {
      present(s,"attack",i,u);
      if(u.attackSkill){
        const ability={...structuredClone(u),code:u.attackSkillCode||u.code,type:"spell",speed:"Fast",effect:"rules",rules:u.onAttack,ruleTarget:undefined};
        (s.combat.skills||=[]).push({owner:i,card:ability,original:structuredClone(u)});
      }else runRules(s,i,u,u.onAttack);
      if(u.supportRules){const index=ids.indexOf(u.id),next=ids[index+1];if(next)runRules(s,i,u,u.supportRules,next);}
      if (u.effect === "attackDamage") {
        s.players[1 - i].nexus--;
        lifesteal(s, i, u, 1);
      }
      if (u.effect === "growAttack") {
        u.attack += u.amount;
        u.health += u.hp || 0;
        u.maxHealth += u.hp || 0;
        if (s.rulesVersion >= 5 && u.code === "01DE056") {
          u.tempAttack = (u.tempAttack || 0) + u.amount;
          u.tempHealth = (u.tempHealth || 0) + (u.hp || 0);
        }
      }
    }
    log(
      s,
      (i === 0 ? "Você" : "Bot") + " atacou com " + ids.length + " unidade(s).",
    );
    Champions.check(s);
    clean(s);
    check(s);
  }
  function canBlock(a, b) {
    return (
      !b.stunned && !has(b,"Immobile") &&
      !has(b, "CantBlock") &&
      (!has(a, "Elusive") || has(b, "Elusive")||has(b,"Sharpsight")) &&
      (!has(a, "Fearsome") || b.attack >= 3) &&
      (!has(a,"Brash")||b.health>=3)
    );
  }
  function canChallenge(a,b){return !a.stunned&&(has(a,"Challenger")||has(b,"Vulnerable"));}
  function canAttack(s, i) {
    return s.attackTokens
      ? !!s.attackTokens[i]
      : s.token === i && s.attackAvailable;
  }
  function previewBlocks(s, i, blocks) {
    if (s.phase !== "block" || s.combat.owner === i || s.priority !== i)
      throw Error("Não é sua fase de bloqueio.");
    for(const [aid,bid] of Object.entries(s.combat.forcedBlocks||{}))
      if(s.combat.ids.includes(aid)&&s.players[i].board.some(u=>u.id===bid)&&blocks[aid]!==bid)throw Error("Bloqueio forçado pelo Desafiador.");
    const used = new Set();
    for (const [a, b] of Object.entries(blocks)) {
      const atk = s.players[1 - i].board.find((u) => u.id === a),
        def = s.players[i].board.find((u) => u.id === b);
      if (
        !s.combat.ids.includes(a) ||
        !atk ||
        !def ||
        used.has(b) ||
        (!canBlock(atk, def)&&s.combat.forcedBlocks?.[a]!==b)
      )
        throw Error("Bloqueio inválido.");
      used.add(b);
    }
    s.combat.blocks = { ...blocks };
  }
  function lockBlocks(s) {
    s.combat.locked = true;
    s.combat.blockedIds = Object.keys(s.combat.blocks || {});
  }
  function commitBlocks(s, i, blocks) {
    if (s.rulesVersion < 5) return resolve(s, blocks);
    previewBlocks(s, i, blocks);
    lockBlocks(s);
    s.stack = structuredClone(s.combat.skills||[]);
    s.combat.skills=[];
    s.responseContext = "combat";
    s.phase = "response";
    s.responsePasses = 1;
    s.priority = s.combat.owner;
    log(s, "Bloqueios confirmados. Janela de resposta antes dos golpes.");
  }
  function resolveStack(s) {
    const spells = [];
    while (s.stack?.length && s.winner === null) {
      const entry = s.stack.pop();
      const before = structuredClone(s);
      const resolved = applySpell(
        s,
        entry.owner,
        entry.card,
        entry.original,
        entry.target,
      );
      spells.push({ ...entry, resolved, before, after: structuredClone(s) });
      log(s, entry.card.name + (resolved ? " resolveu." : " dissipou."));
    }
    s.stack = [];
    if (s.winner !== null) return { kind: "stack", spells };
    let combat = null;
    let combatBefore = null;
    if (s.responseContext === "combat") {
      s.phase = "block";
      combatBefore = structuredClone(s);
      combat = resolve(s, s.combat.blocks || {});
    } else {
      s.phase = "main";
      s.priority = 1 - s.stackOrigin;
    }
    s.responseContext = null;
    s.responsePasses = 0;
    s.passes = 0;
    return { kind: "stack", spells, combat, combatBefore };
  }
  function training(catalog, deck0, deck1, seed, champion, options = {}) {
    const s = create(catalog, deck0, deck1, seed, {
        ...options,
        skipMulligan: true,
      }),
      p = s.players[0];
    if (!catalog[champion]?.champion)
      throw Error("Escolha um campeão disponível.");
    if (!p.hand.some((c) => c.championKey === champion)) {
      const index = p.deck.findIndex((c) => c.championKey === champion);
      if (index < 0) throw Error("O campeão precisa estar no deck.");
      const swap = p.hand.pop();
      p.hand.push(p.deck[index]);
      p.deck[index] = swap;
    }
    s.round = catalog[champion].cost;
    s.token = 0;
    s.attackTokens = [true, false];
    s.attackAvailable = true;
    s.priority = 0;
    s.training = true;
    for (const player of s.players) {
      player.mana = s.round;
      player.maxMana = s.round;
      player.spellMana = 0;
    }
    s.log = [
      "Treino: campeão na mão e mana inicial suficiente para invocá-lo.",
    ];
    return s;
  }
  function validateDeck(catalog, deck) {
    const errors = [];
    if (!Array.isArray(deck) || deck.length !== 40)
      errors.push("O deck precisa ter 40 cartas.");
    if (!Array.isArray(deck)) return errors;
    const counts = {},
      regions = new Set();
    let champions = 0;
    for (const code of deck) {
      const c = catalog[code];
      if (!c || c.collectible === false) {
        errors.push("Carta indisponível: " + code);
        continue;
      }
      counts[code] = (counts[code] || 0) + 1;
      regions.add(c.region);
      if (c.champion) champions++;
    }
    if (Object.values(counts).some((n) => n > 3))
      errors.push("Máximo de 3 cópias por carta.");
    if (champions > 6) errors.push("Máximo de 6 campeões.");
    if (regions.size > 2) errors.push("Máximo de 2 regiões.");
    return errors;
  }
  function resolve(s, blocks) {
    if (s.phase !== "block") throw Error("Não há combate.");
    const { owner, ids } = s.combat;
    const atk = s.players[owner],
      def = s.players[1 - owner];
    if(!s.combat.locked)for(const [aid,bid] of Object.entries(s.combat.forcedBlocks||{}))
      if(ids.includes(aid)&&def.board.some(u=>u.id===bid)&&blocks[aid]!==bid)throw Error("Bloqueio forçado pelo Desafiador.");
    const used = new Set();
    for (const [aid, bid] of Object.entries(blocks)) {
      const a = atk.board.find((u) => u.id === aid),
        b = def.board.find((u) => u.id === bid);
      if (s.rulesVersion >= 5 && s.combat.locked && (!a || !b || !ids.includes(aid))) continue;
      if (
        !ids.includes(aid) ||
        !a ||
        !b ||
        used.has(bid) ||
        (!s.combat.locked && !canBlock(a, b)&&s.combat.forcedBlocks?.[aid]!==bid)
      )
        throw Error("Bloqueio inválido.");
      used.add(bid);
    }
    const lanes = [];
    for (const id of ids) {
      const a = atk.board.find((u) => u.id === id),
        b = def.board.find((u) => u.id === blocks[id]);
      if (!a) continue;
      if (!b) {
        const ghost = s.rulesVersion >= 5 && s.combat.blockedIds?.includes(id);
        const nexusDamage =
          ghost && !has(a, "Overwhelm")
            ? 0
            : a.attack * (a.effect === "doubleNexus" ? 2 : 1);
        def.nexus -= nexusDamage;
        if (!ghost || has(a, "Overwhelm")) {
          Champions.strike(a);
          if(a.attack>0){runRules(s,owner,a,a.onStrike);runRules(s,owner,a,a.onNexusStrike);}
          lifesteal(s, owner, a, nexusDamage);
          if (a.attack > 0 && has(a, "Ephemeral")) a.health = 0;
        }
        lanes.push({
          attackerId: id,
          blockerId: null,
          attackerHealth: a.health,
          blockerHealth: null,
          nexusDamage,
        });
        continue;
      }
      const hp = b.health,attackPower=a.attack,blockPower=b.attack,blockerTough=has(b,'Tough');
      let attackDamage = damage(b, attackPower,s);
      Champions.strike(a);
      if(a.attack>0)runRules(s,owner,a,a.onStrike,b.id);
      const quickEphemeral =
        (has(a, "QuickStrike")||has(a,"DoubleStrike")) && has(a, "Ephemeral") && a.attack > 0;
      if (quickEphemeral) a.health = 0;
      let defendDamage = 0,
        defended = false;
      if ((!(has(a, "QuickStrike")||has(a,"DoubleStrike")) || b.health > 0) && !quickEphemeral) {
        if(has(a,"DoubleStrike")&&a.health>0){
          attackDamage+=damage(b,a.attack,s);
          if(a.attack>0)runRules(s,owner,a,a.onStrike,b.id);
          if(b.health<=0&&has(a,"Fury")){a.attack++;a.health++;a.maxHealth++;}
        }
        defendDamage = damage(a, (has(a,'QuickStrike')||has(a,'DoubleStrike'))?b.attack:blockPower,s);
        defended = true;
        Champions.strike(b);
        if(b.attack>0)runRules(s,1-owner,b,b.onStrike,a.id);
      }
      const nexusDamage = has(a, "Overwhelm")
        ? Math.max(0, attackPower - hp - (blockerTough ? 1 : 0))
        : 0;
      def.nexus -= nexusDamage;
      lifesteal(
        s,
        owner,
        a,
        (has(a, "Overwhelm") ? Math.min(hp, attackDamage) : attackDamage) +
          nexusDamage,
      );
      if (defended) lifesteal(s, 1 - owner, b, defendDamage);
      if(b.health<=0&&a.health>0&&has(a,"Fury")){a.attack++;a.health++;a.maxHealth++;}
      if(a.health<=0&&b.health>0&&has(b,"Fury")){b.attack++;b.health++;b.maxHealth++;}
      if (a.attack > 0 && has(a, "Ephemeral")) a.health = 0;
      if (defended && b.attack > 0 && has(b, "Ephemeral")) b.health = 0;
      lanes.push({
        attackerId: id,
        blockerId: b.id,
        attackerHealth: a.health,
        blockerHealth: b.health,
        nexusDamage,
      });
    }
    s.phase = "main";
    s.priority = 1 - owner;
    s.combat = null;
    log(s, "Combate resolvido.");
    clean(s);
    return {
      kind: "combat",
      owner,
      lanes,
      nexusAfter: s.players.map((p) => p.nexus),
    };
  }
  function autoBlocks(s) {
    const { owner, ids } = s.combat,
      available = s.players[1 - owner].board.filter(u=>!Object.values(s.combat.forcedBlocks||{}).includes(u.id)),
      blocks = {...s.combat.forcedBlocks};
    for (const id of [...ids].sort(
      (x, y) =>
        s.players[owner].board.find((u) => u.id === y).attack -
        s.players[owner].board.find((u) => u.id === x).attack,
    )) {
      const a = s.players[owner].board.find((u) => u.id === id);
      if(blocks[id])continue;
      const choices = available
        .filter((b) => canBlock(a, b))
        .sort(
          (x, y) =>
            (y.attack >= a.health) - (x.attack >= a.health) ||
            x.attack - y.attack,
        );
      if (choices.length) {
        blocks[id] = choices[0].id;
        available.splice(available.indexOf(choices[0]), 1);
      }
    }
    return blocks;
  }
  function bot(s, i = 1) {
    if (s.phase === "over") return;
    if (s.phase === "mulligan") return mulligan(s, []);
    if (s.priority !== i) return;
    if (s.phase === "block") {
      if (s.rulesVersion < 5) return resolve(s, autoBlocks(s));
      previewBlocks(s, i, autoBlocks(s));
    }
    if (s.phase === "main") turn(s, i);
    const p = s.players[i],
      enemy = s.players[1 - i];
    const cards = p.hand
      .map((c) => Champions.view(s, i, c))
      .filter((c) => playable(s, i, c))
      .sort((a, b) => b.cost - a.cost);
    for (const c of cards) {
      let target;
      if (c.effect === "rally" && canAttack(s, i)) continue;
      if (["killAll", "sweep"].includes(c.effect) && !enemy.board.length)
        continue;
      if (c.effect === "heal") {
        const hurt = p.board.find((u) => u.health < u.maxHealth);
        if (p.nexus <= 20 - c.amount) target = "my-nexus";
        else if (hurt) target = hurt.id;
        else if (c.draw) target = "my-nexus";
        else continue;
      }
      if (["kill", "frostbite"].includes(c.effect)) {
        const legal = targets(s, i, c);
        const victim = enemy.board
          .filter(
            (u) =>
              legal.includes(u.id) &&
              (c.effect !== "frostbite" || u.attack > 0),
          )
          .sort((a, b) => b.attack - a.attack)[0];
        if (!victim) continue;
        target = victim.id;
      }
      if (c.effect === "buff") {
        if (!p.board.length) continue;
        if (s.phase === "response" && !s.combat) continue;
        target = [...p.board].sort((a, b) => b.attack - a.attack)[0].id;
      }
      if (c.effect === "judgment") {
        const ally = p.board
          .filter((u) => validTarget(s, i, c, u.id))
          .sort((a, b) => b.attack - a.attack)[0];
        if (!ally) continue;
        target = ally.id;
      }
      if (c.effect === "damage") {
        const kill = enemy.board.find(
          (u) => u.health + (has(u, "Tough") ? 1 : 0) <= c.amount,
        );
        if (c.unitsOnly && !enemy.board.length) continue;
        target = kill
          ? kill.id
          : c.unitsOnly
            ? [...enemy.board].sort((a, b) => b.attack - a.attack)[0].id
            : "nexus";
      }
      if(c.ruleTarget){
        const legal=targets(s,i,c);
        const side=c.ruleTarget.side==="ally"?p.board:enemy.board;
        target=[...side].filter(u=>legal.includes(u.id)).sort((a,b)=>b.attack-a.attack)[0]?.id||legal[0];
        if(c.targetCount>1)target=legal.slice(0,c.targetCount);
        if(!target&&c.type!=="unit")continue;
      }
      if(c.targetSlots){
        target=[];
        for(let index=0;index<c.targetSlots.length;index++){
          const choices=targets(s,i,c,target);if(!choices.length)break;
          target.push(choices.includes('nexus')?'nexus':choices[0]);
        }
        if(target.length<c.targetSlots.length&&c.type!=='unit')continue;
      }
      play(s, i, c.id, target);
      return;
    }
    if (s.phase === "block") return commitBlocks(s, i, s.combat.blocks || {});
    if (s.phase === "response") return pass(s, i);
    const attackers=p.board.filter(u=>!u.stunned&&!has(u,"Immobile"));
    if (canAttack(s, i) && attackers.length) {
      attack(
        s,
        i,
        attackers.map((u) => u.id),
      );
      return;
    }
    pass(s, i);
  }
  function preview(s, blocks) {
    if (!s.combat && s.phase !== "response") return null;
    const copy = structuredClone(s);
    if (copy.phase === "block") {
      if (copy.rulesVersion >= 5) {
        commitBlocks(
          copy,
          1 - copy.combat.owner,
          blocks || copy.combat.blocks || {},
        );
        resolveStack(copy);
      } else resolve(copy, blocks || {});
    } else resolveStack(copy);
    return {
      nexus: copy.players.map((p) => p.nexus),
      survivors: copy.players.map((p) =>
        p.board.map((c) => ({ id: c.id, health: c.health })),
      ),
      winner: copy.winner,
    };
  }
  const api = {
    targets,
    hydrate,
    create,
    mulligan,
    play,
    pass,
    attack,
    resolve,
    bot,
    autoBlocks,
    canBlock,
    canChallenge,
    playable,
    canAttack,
    previewBlocks,
    commitBlocks,
    preview,
    training,
    validateDeck,
    cardView: Champions.view,
  };
  if (typeof module !== "undefined") module.exports = api;
  else root.Engine = api;
})(typeof window === "undefined" ? globalThis : window);
