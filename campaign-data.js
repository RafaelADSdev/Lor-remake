/* Campaign balance is original to this prototype. Coordinates come from Riot's atlas. */
(function (root) {
  const regions = [
    { id: "demacia", name: "Demacia", cardRegion: "Demacia", x: -428, y: 67, playable: true, level: [1, 5], title: "Escudo de Demacia", champion: "01DE012", deck: "garen_challengers", color: "#92c9e3", motto: "A força de um reino está em quem o defende.", description: "Cruze as fronteiras, enfrente a Vanguarda e prove sua estratégia diante de Garen.", boss: "Garen", names: ["Patrulha da fronteira", "Estrada da Vanguarda", "Margens do rio", "A guarda de petricita", "Provação dos Desafiadores", "Garen · Pela justiça", "A última linha de defesa"] },
    { id: "noxus", name: "Noxus", cardRegion: "Noxus", x: 0, y: 173, playable: true, level: [3, 8], title: "Força de Noxus", champion: "01NX038", deck: "darius_overwhelm", color: "#ed9e91", motto: "Toda vitória precisa ser conquistada.", description: "Atravesse as linhas da legião e sobreviva ao avanço de Darius. Cada ponto de vida importa.", boss: "Darius", names: ["Batedores da legião", "Marcha pela estrada", "Travessia sob cerco", "Arena dos desafiantes", "Vanguarda Trifariana", "Darius · A Mão de Noxus", "A força do império"] },
    { id: "freljord", name: "Freljord", cardRegion: "Freljord", x: -351, y: 285, playable: true, level: [5, 10], title: "Coração do Freljord", champion: "01FR039", deck: "tryndamere_ramp", color: "#b0dcdb", motto: "O inverno revela quem consegue resistir.", description: "Escolha sua passagem pelas montanhas. Os guardiões protegem a trilha; Tryndamere espera no fim da jornada.", boss: "Tryndamere", names: ["Trilha dos Poros", "Passagem das montanhas", "Travessia congelada", "O abrigo dos protetores", "Guardiões da tundra", "Tryndamere · Fúria imortal", "Lendas do inverno"] },
    {
      id: "ionia", name: "Ionia", cardRegion: "Ionia", x: 539, y: 232, playable: true,
      level: [6, 10], title: "Equilíbrio de Ionia", leader: "01IO056", deck: "campaign-ionia", color: "#b7d6a3",
      motto: "Cada passo pede equilíbrio.", boss: "Yone, o Perseguidor de Ventos",
      description: "Atravesse clareiras e templos. Retornos, atordoamentos e unidades Elusivas exigem que você escolha o momento de atacar.",
      names: ["Batedores de Navori", "Trilha da clareira", "As margens do Placidium", "Refúgio dos Kinkou", "O teste das sombras", "Yone · Os ventos de Ionia", "Minah · A última lição"],
    },
    {
      id: "piltover-zaun", name: "Piltover e Zaun", cardRegion: "PiltoverZaun", x: 194, y: -109, playable: true,
      level: [4, 8], title: "Engenho das Duas Cidades", leader: "08PZ028", deck: "campaign-piltover", color: "#e0bd7e",
      motto: "Uma descoberta pode mudar tudo.", boss: "Dragão Quimtec",
      description: "Das oficinas de Piltover aos becos de Zaun, enfrente invenções, dano direto e cópias. Detenha o Dragão Quimtec antes que a máquina entre em movimento.",
      names: ["Turno na academia", "Ponte do progresso", "Atalho pelos sumidouros", "A oficina clandestina", "Midenstokke · Linha de produção", "Dragão Quimtec · Reação em cadeia", "O dia do progresso"],
    },
    {
      id: "bilgewater", name: "Águas de Sentina", cardRegion: "Bilgewater", x: 569, y: -183, playable: true,
      level: [7, 11], title: "Lenda das Marés", leader: "02BW035", deck: "campaign-bilgewater", color: "#89d0bd",
      motto: "Nenhuma travessia vem sem um preço.", boss: "Xerife Lariette Rose",
      description: "Negocie sua passagem entre docas e embarcações. Lariette expõe suas unidades com Vulnerável; guarde uma resposta para a chegada da xerife.",
      names: ["Confusão nas docas", "Rota dos contrabandistas", "Travessia dos recifes", "Aposta no cais", "A frota caçadora", "Lariette Rose · Procurado", "A lei do porto"],
    },
    {
      id: "shurima", name: "Shurima", cardRegion: "Shurima", x: 67, y: -356, playable: true,
      level: [10, 14], title: "Guardião das Areias", leader: "04SH015", deck: "campaign-shurima", color: "#e3c786",
      motto: "As areias guardam aquilo que o tempo esquece.", boss: "Raz Sanguescama",
      description: "Siga as caravanas até as ruínas. Soldados de Areia pressionam o campo; Raz enfraquece suas defesas ao atacar.",
      names: ["Caravana das dunas", "Estrada das ruínas", "Leito do rio esquecido", "O posto dos Baccai", "A marcha das areias", "Raz Sanguescama · Emboscada", "O decreto do deserto"],
    },
    {
      id: "targon", name: "Targon", cardRegion: "Targon", x: -240, y: -384, playable: true,
      level: [12, 16], title: "Voz da Montanha", leader: "03MT033", deck: "campaign-targon", color: "#c9b9e1",
      motto: "O cume é apenas o começo.", boss: "Vovô Rumul",
      description: "Suba a montanha entre peregrinos e protetores. Fortalecimentos, Escudo de Feitiço e Sobrepujar tornam a formação inimiga cada vez mais resistente.",
      names: ["Peregrinos da encosta", "Passagem dos íbex", "Trilha das estrelas", "As dádivas da montanha", "Chamabrancas do cume", "Vovô Rumul · A prova do cume", "Sob o céu de Targon"],
    },
    {
      id: "ixtal", name: "Ixtal", cardRegion: "Noxus", x: 287, y: -332, playable: true,
      level: [14, 18], title: "Defensor da Selva", leader: "01NX051", deck: "campaign-ixtal", color: "#8dce98",
      motto: "A selva não cede aos invasores.", boss: "Capitão Farron",
      description: "Detenha uma expedição noxiana na selva de Ixtal. Batedores abrem caminho para o Capitão Farron e seu cerco de Sobrepujar e Dizimar.",
      opponentLabel: "Adversários: expedição noxiana",
      names: ["Batedores entre as raízes", "Estrada da expedição", "Travessia dos mangues", "O acampamento invasor", "Cerco na clareira", "Farron · A expedição de ferro", "A selva resiste"],
    },
    {
      id: "shadow-isles", name: "Ilhas das Sombras", cardRegion: "ShadowIsles", x: 700, y: -393, playable: true,
      level: [18, 22], title: "Luz contra a Névoa", leader: "01SI033", deck: "shadow_rebirth", color: "#83c9bc",
      motto: "Mesmo na névoa, uma luz pode resistir.", boss: "Comandante Ledros",
      description: "Siga os vestígios através da Névoa Negra. Sacrifícios e ressurreições trazem inimigos de volta; Ledros ameaça seu Nexus com a metade da Vida restante.",
      names: ["Vestígios na névoa", "Estrada das ruínas", "Travessia das águas mortas", "O jardim da Nunclareira", "Guardiões da ruína", "Ledros · O último comando", "A noite do Tormento"],
    },
  ];
  for (const r of regions) r.symbol = `assets/campaign/regions/${r.id}.png`;
  const expand = pairs => pairs.flatMap(([code, count]) => Array(count).fill(code));
  // Authored, legal regional lists; they stay separate from the player's deck library.
  const decks = {
    "campaign-ionia": expand([
      ["01IO017", 3], ["01IO006", 3], ["01IO026", 3], ["01IO057", 3], ["01IO040", 3], ["01IO056", 3], ["01IO033", 2], ["01IO030", 2],
      ["01IO011", 3], ["01IO004", 3], ["01IO018", 3], ["01IO037", 3], ["02IO005", 3], ["01IO002", 3],
    ]),
    "campaign-piltover": expand([
      ["01PZ055", 3], ["05PZ025", 3], ["01PZ018", 3], ["01PZ009", 3], ["01PZ059", 3], ["01PZ003", 3], ["01PZ021", 2], ["08PZ028", 2],
      ["01PZ052", 3], ["01PZ028", 3], ["03PZ013", 3], ["06PZ046", 3], ["01PZ014", 3], ["01PZ049", 3],
    ]),
    "campaign-bilgewater": expand([
      ["02BW013", 3], ["02BW040", 3], ["02BW005", 3], ["02BW036", 3], ["03BW002", 3], ["03BW007", 3], ["02BW027", 3], ["02BW038", 3], ["02BW035", 2], ["02BW021", 2],
      ["02BW020", 3], ["02BW025", 3], ["08BW032", 3], ["08BW002", 3],
    ]),
    "campaign-shurima": expand([
      ["04SH005", 3], ["04SH015", 3], ["04SH055", 3], ["04SH081", 3], ["04SH103", 3], ["04SH026", 3], ["04SH057", 3],
      ["04SH045", 3], ["04SH099", 3], ["04SH118", 3], ["04SH043", 3], ["04SH114", 3], ["04SH075", 2], ["06SH056", 2],
    ]),
    "campaign-targon": expand([
      ["03MT048", 3], ["03MT092", 3], ["03MT071", 3], ["03MT041", 3], ["03MT038", 3], ["03MT020", 3], ["03MT033", 2], ["03MT060", 2],
      ["03MT051", 3], ["03MT019", 3], ["05MT002", 3], ["03MT036", 3], ["05MT009", 3], ["03MT098", 3],
    ]),
    "campaign-ixtal": expand([
      ["01NX012", 3], ["01NX055", 3], ["01NX037", 3], ["01NX046", 3], ["01NX026", 3], ["03NX005", 3], ["01NX051", 2], ["01NX045", 2],
      ["01NX002", 3], ["01NX019", 3], ["01NX027", 3], ["02NX003", 3], ["01NX011", 3], ["03NX022", 3],
    ]),
  };
  const templates = [
    { suffix: "patrol", kind: "Batalha", offset: 0, xp: 40, hint: "Conheça as unidades e o ritmo desta região." },
    { suffix: "road", kind: "Rota terrestre", offset: 1, xp: 45, requires: ["patrol"], hint: "Um caminho de combate direto até a elite." },
    { suffix: "river", kind: "Rota alternativa", offset: 1, xp: 45, requires: ["patrol"], hint: "Uma composição alternativa. Vença esta rota ou a estrada para avançar." },
    { suffix: "optional", kind: "Opcional", offset: 2, xp: 60, requires: ["patrol"], spellMana: 1, hint: "O adversário começa com 1 de mana de feitiço. Não é necessário para chegar ao chefe." },
    { suffix: "elite", kind: "Elite", offset: 2, xp: 75, requiresAny: ["road", "river"], spellMana: 2, hint: "O adversário começa com 2 de mana de feitiço. Prepare suas respostas." },
    { suffix: "boss", kind: "Chefe", offset: 3, xp: 120, requires: ["elite"], spellMana: 2, hero: true, hint: "O chefe começa com seu campeão na mão após a troca inicial e 2 de mana de feitiço." },
    { suffix: "veteran", kind: "Desafio avançado", offset: 4, xp: 100, requires: ["boss"], spellMana: 3, hero: true, hint: "Deck de elite, campeão garantido após a troca inicial e 3 de mana de feitiço." },
  ];
  const encounters = regions.filter(r => r.playable).flatMap(r => templates.map((t, index) => ({
    ...t, id: r.id + "-" + t.suffix, region: r.id, name: r.names[index],
    level: r.level[0] + t.offset, deck: r.deck, champion: t.hero ? r.champion : null,
    openingCard: t.hero ? (r.leader || r.champion) : null,
    requires: (t.requires || []).map(s => r.id + "-" + s),
    requiresAny: (t.requiresAny || []).map(s => r.id + "-" + s),
    variant: index,
  })));
  for (const e of encounters.filter(e => e.region === "freljord")) {
    if (["patrol", "road"].includes(e.suffix)) e.deck = "braum_poros";
    if (["river", "optional", "elite"].includes(e.suffix)) e.deck = "braum_scars";
    if (e.suffix === "veteran") e.deck = "freljord_champions";
  }
  for (const e of encounters) {
    const r = regions.find(r => r.id === e.region);
    if (e.id === "ionia-veteran") e.openingCard = "01IO033";
    if (e.hero && r.leader) {
      const mana = e.spellMana;
      e.hint = `O adversário começa com sua carta de liderança na mão após a troca inicial e ${mana} de mana de feitiço. A liderança mantém seu custo normal.`;
    }
  }
  const content = { regions, encounters, decks };
  if (typeof module !== "undefined") module.exports = content;
  else root.CAMPAIGN_DATA = content;
})(typeof window === "undefined" ? globalThis : window);
