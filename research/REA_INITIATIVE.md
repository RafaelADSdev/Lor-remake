# Moeda de iniciativa e defesa dos dois lados

Os indicadores de ataque e defesa ficam dentro dos dois encaixes circulares da moldura nativa da ação: inferior para o jogador e superior para o bot. Eles acompanham `Engine.canAttack`. Conforme a correção solicitada pelo usuário, a moeda voa somente quando `state.round` avança e `state.token` muda de lado. `state.priority` pode alternar diversas vezes na rodada sem disparar a moeda. Gastar ou recuperar ataque (Mobilizar), bloquear e responder também não acionam o voo. Uma nova partida, a entrada após mulligan e a retomada de salvamento posicionam a moeda sem passagem retroativa.

O rosto corresponde ao lado que recebe o ataque da rodada: espada se `Engine.canAttack(state, target)` for verdadeiro, escudo caso contrário. A arte e a orientação são as mesmas do indicador fixo desse lado, sem copiar suas animações de espera ou fragmentos transitórios. Ao terminar o voo, a moeda é ocultada para manter o símbolo fixo legível; a borda clara continua marcando a prioridade de ação. Passar a ação não transfere o direito de atacar.

## Evidência preservada

REA CLI 6.5.0 verificou identidade e inventário de `initiative-source-snapshot.zip`. Evidence: **ev_3886a4b56cbf0d22d71820fc554004d0ff43cd0fa4e5dd68e950fb2ec72f5510**. SHA-256: **56a9e48cf008bd199878fedeffc835254cfae2d5dc8288d630d8d507b6594479**. Resultado: `rea-initiative-inventory.json`. A extração Unity e a decodificação das curvas usam os parsers locais; a Evidence REA não é uma captura ou execução do cliente Riot.

`scripts_reproducao/extract_initiative_evidence.py` preserva a cadeia serializada e o recurso do escudo em `assets_extraidos_atualizados_2026-10-15/initiative/`. `assets/arenas/token/initiative-sources.json` registra caminhos, IDs, hashes, derivação e adaptações. O cliente Riot não foi anexado nem executado.

## Relação entre estados e animação

No pacote `2b/4f2adf1fb53b93fd68946b7ce147f2.bbq`, SHA-256 `24639eb04ad3ef08b63483f45ef8b1ffb90e455a6024f34043235fb7e30ca7d1`, o FSM `InitiativeTokenRoot` (componente `2917402138821105814`) contém `Top`, `Bottom`, `ActivateTop`, `ActivateBottom`, sons `coin_gain/lose` e `SwapEffect`. Isso distingue a iniciativa dos estados de ataque documentados em `REA_TOKEN.md`.

A referência de `InitiativeToken_Animation` passa por `ActivateTimeline`, pelo PlayableDirector `2917402135701261909`, timeline `-4523325569452152042` e track `-4523325569985854028`. O `m_InfiniteClip` aponta ao AnimationClip **-4523325567422316303**, path **RootPos** (CRC32 `1752052838`).

O clipe dura **1 segundo**. A posição começa em `[88,29,-2.1900001]` e termina em `[88,-29,-2.2]`; Z alcança aproximadamente `-28.40709`, Euler X vai de `0` a `-360` graus e a escala cresce de `1` a cerca de `1.70809` antes de voltar a `1`. O importador reaproveita o decodificador cúbico de `import_current_motion.py`, preserva tempos e amostras e verifica valores finitos.

## Projeção e materiais adaptados

`initiative-token.js` aplica o progresso vertical, arco Z, giro e escala recuperados via WAAPI, sem easing global adicional. Os extremos são mapeados aos dois encaixes do HUD; o sentido inverso é espelhado. O navegador não executa o shader ou o FSM Unity. O sprite recuperado da malha `InitiativeToken_MD_mesh`, com UV e textura compartilhada originais, mostra um medalhão de cartas e permanece preservado no acervo, mas não é usado no voo atual. A substituição pelo rosto de ataque/defesa do destinatário é uma adaptação solicitada pelo usuário, não uma descoberta sobre o material original. `ArenaToken.paintCoin` escolhe a arte existente e evita refazer o DOM em atualizações sem mudança de rosto ou lado.

O importador ajusta círculos aos pixels dourados da moldura `action-dock.png` (336 × 512): centro inferior aproximado `[139.34,472.93]`, superior `[139.57,38.49]`, raios próximos de 30 pixels. Esses pontos são uma medição da projeção renderizada, não coordenadas recuperadas pelo REA. `getScreenCTM()` acompanha o tamanho real do SVG. Uma margem visual de 7% adapta o encaixe do sprite. A mesma projeção posiciona os símbolos fixos, redimensiona a arte e alinha o alvo de clique de 44 pixels do ataque. O recorte circular, o fundo do medalhão e a borda de iniciativa são adaptações do navegador. A posição é recalculada depois da mudança menu/duelo e ao redimensionar a arena ou o HUD.

O escudo usa o contorno de `Shield_Fill_Right_Alpha_TX.png`, Texture2D `402243861861140860` do pacote `3e/190a25ad478d1e6d9ef3adb72ccb11.bbq`. O contorno original em tons de cinza recebe preenchimento de aço e borda de latão adaptados, sobre o aro do medalhão. Não foi recuperada uma textura final de escudo com esse acabamento.

O módulo guarda uma cópia escalar do número da rodada, pois o motor altera o mesmo objeto de estado. Atualizações repetidas preservam o voo em andamento. Viradas rápidas entre rodadas partem da posição visível; sair do duelo, ocultar a página e redimensionar interrompem movimentos antigos. Efeitos desligados ou movimento reduzido posicionam a moeda diretamente no destino.

## Reprodução e verificação

1. Python 3.12 com UnityPy: `scripts_reproducao/extract_initiative_evidence.py`.
2. REA `inspect-artifact` no snapshot; preserve o resultado em `research/rea-initiative-inventory.json`.
3. Python com Pillow e NumPy: `tools/import_initiative.py`.
4. Playwright e Chrome: `node tests/initiative-token.cjs` verifica hashes, curva nativa, encaixes, passagem na troca de rodadas nos dois sentidos, ausência de passagem em ações comuns, Mobilizar, consumo de ataque e bloqueio/resposta, além de cancelamento, movimento reduzido e cinco larguras de 320 a 2529 pixels, offline.
5. `node tools/preview_initiative.cjs` grava o protótipo com os módulos de produção; não é uma gravação do cliente Riot.
