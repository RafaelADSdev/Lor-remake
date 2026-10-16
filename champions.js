/* Explicit champion rules; authoritative form metadata comes from cards.js. */
(function (root) {
  "use strict";
  function evolve(s, owner, unit) {
    const spec = unit.levelSpec;
    if (!spec || unit.level === 2) return;
    const key = unit.championKey;
    unit.attack += spec.attack - unit.baseStats.attack;
    const gain = spec.health - unit.baseStats.health;
    unit.health += gain;
    unit.maxHealth += gain;
    unit.code = spec.code;
    unit.image = spec.image;
    unit.portrait = spec.portrait;
    unit.text = spec.text;
    unit.level = 2;
    for(const key of ['onAttack','onDeath','onSummon','attackSkill','attackSkillCode'])
      if(spec[key]!==undefined)unit[key]=structuredClone(spec[key]);
    unit.keywords = [...new Set([...unit.keywords, ...spec.keywords])];
    if(s.players[owner].board.some(c=>c.id===unit.id))
      (s.presentationEvents ||= []).push({kind:'levelup',code:unit.code,owner,id:unit.id});
  }
  function check(s) {
    for (let i = 0; i < 2; i++) {
      const p = s.players[i];
      p.leveledChampions ||= [];
      if(p.maxMana>=10&&[...p.board,...p.hand,...p.deck].some(u=>u.championKey==='01FR024'&&!u.aniviaEgg)&&!p.leveledChampions.includes('01FR024')){
        p.leveledChampions.push('01FR024');s.log.push('Anivia subiu para o nível 2.');
      }
      for (const u of p.board) {
        if (!u.champion || u.health <= 0) continue;
        const condition =
          (u.championKey === "01DE012" && (u.strikes || 0) >= 2) ||
          (u.championKey === "01NX038" && s.players[1 - i].nexus <= 10) ||
          (u.championKey === '01FR009'&&(u.survivedDamage||0)>=10);
        if (condition && !p.leveledChampions.includes(u.championKey)) {
          p.leveledChampions.push(u.championKey);
          s.log.push(u.name + " subiu para o nível 2.");
        }
      }
      for (const zone of ["board", "hand", "deck"])
        for (const u of p[zone])
          if (u.champion && !u.aniviaEgg && p.leveledChampions.includes(u.championKey))
            evolve(s, i, u);
    }
  }
  function strike(unit) {
    if (unit?.champion && unit.championKey === "01DE012" && unit.attack > 0)
      unit.strikes = (unit.strikes || 0) + 1;
  }
  function survived(s,owner,unit,n){
    if(unit.championKey!=='01FR009'||n<=0||unit.health<=0)return null;
    unit.survivedDamage=(unit.survivedDamage||0)+n;
    check(s);
    if(unit.level===2||!unit.poroSummoned){unit.poroSummoned=true;return unit.survivalToken;}
    return null;
  }
  function preventDeaths(s){
    for(let i=0;i<2;i++){
      const p=s.players[i],doomed=p.board.filter(u=>u.championKey==='01FR039'&&u.level===1&&u.health<=0);
      if(!doomed.length)continue;
      for(const unit of doomed)unit.health=unit.maxHealth;
      p.leveledChampions||=[];
      if(!p.leveledChampions.includes('01FR039')){p.leveledChampions.push('01FR039');s.log.push('Tryndamere subiu para o nível 2.');}
    }
    check(s);
  }
  function summoned(s, i, unit) {
    if (unit.effect === "garen")
      for (const ally of s.players[i].board) {
        if (ally.id === unit.id) continue;
        ally.attack++;
        ally.health++;
        ally.maxHealth++;
        ally.tempAttack = (ally.tempAttack || 0) + 1;
        ally.tempHealth = (ally.tempHealth || 0) + 1;
      }
    check(s);
  }
  function roundStart(s) {
    for(let i=0;i<2;i++){
      const p=s.players[i];
      if(p.maxMana>=10)for(const unit of p.board.filter(u=>u.aniviaEgg)){
        const id=unit.id,base=structuredClone(s.cardCatalog[unit.reviveAs]);
        for(const key of Object.keys(unit))delete unit[key];
        Object.assign(unit,base,{id,maxHealth:base.health});
        if(!p.leveledChampions.includes(base.championKey))p.leveledChampions.push(base.championKey);
        evolve(s,i,unit);
      }
    }
    for (let i = 0; i < 2; i++)
      if (
        s.players[i].board.some(
          (u) => u.championKey === "01DE012" && u.level === 2 && u.health > 0,
        )
      )
        s.attackTokens[i] = true;
  }
  function view(s, i, c) {
    if(c.costBySummoned8&&(s.players[i].summoned8||0)>=5)c={...c,cost:0};
    if (
      c.champion &&
      c.spellSpec &&
      s.players[i].board.some((u) => u.championKey === c.championKey)
    )
      return {
        ...c,
        ...c.spellSpec,
        id: c.id,
        champion: false,
        spellFrom: c.championKey,
      };
    return c;
  }
  const api = { check, strike, summoned, roundStart, view, survived, preventDeaths };
  if (typeof module !== "undefined") module.exports = api;
  else root.ChampionRules = api;
})(typeof window === "undefined" ? globalThis : window);
