# Recursos atuais aplicados — v0.30

## Cartas e animações: cobertura atual

As 1.647 colecionáveis estão em Minha coleção e podem compor decks salvos, com edição/importação/exportação no fluxo normal. Outras 865 formas e cartas geradas podem ser inspecionadas e são criadas pelas regras. A v0.30 remove o modo livre separado, acrescenta nove decks prontos e destaca 12 listas com as cartas novas. Decks com habilidades ainda não implementadas ficam na biblioteca com indicação de regras pendentes; os decks totalmente implementados podem ser usados nos duelos. O arquivo `datadragon/supported-rules-coverage.json` registra a cobertura automática.

A cobertura automática passou de 77 para **396 colecionáveis**, com 36 subcartas, cinco campeões e 315 definições explícitas; as demais unidades admitidas possuem palavras-chave suportadas e não têm texto adicional que exija regra. Restam 1.251 colecionáveis com regras de duelo pendentes, que podem compor decks na biblioteca da coleção. Braum, Anivia e Tryndamere foram adicionados com evoluções e assinaturas. A seleção sequencial aceita alvos diferentes por etapa e cartas na mão. Mana máxima é independente do número da rodada para permitir efeitos de aceleração. Casos de semântica ainda não comprovada, como certas transferências/cópias diante de substituição de morte ou Escudo de Feitiço, permanecem indisponíveis para duelo automático.

Foram integrados 564 grupos de efeitos: 557 com prévia visual e sete apenas com metadados. A importação decodificou 4.080 referências de clipes (3.435 únicos), 20.133 referências de partículas (19.330 únicas) e preservou 6.807 texturas originais únicas, verificadas por SHA-256. `assets/card-effects/import-summary.json` e os arquivos por grupo preservam proveniência e parâmetros. Existem 4.258 clipes no acervo fonte; dependências sem atribuição comprovada não foram apresentadas como novas animações de cartas.

`card-effects.js` compõe texturas, curvas, materiais e módulos de partículas em Canvas2D. A política `browser-event-adaptation` associa eventos do motor às apresentações de propriedade conhecida e registra separadamente flags e fases originais. Algumas fases locais são adaptações explícitas; o significado de flags Unity não foi presumido a partir de seus nomes. Skins permanecem manuais. Shaders Unity, deformação de modelos e lógica completa das timelines estão fora dessa adaptação. Sete grupos sem recursos visuais suficientes aparecem como metadados, com reprodução desabilitada.

`card-presentation.js` acompanha resultados do motor: feitiços apenas depois da resolução, invocações, ataques, retornos e mortes. Evoluções incluem as disparadas na própria invocação e antes de uma morte posterior na mesma resolução. Cancelamento, menu, página oculta, Efeitos desligados e movimento reduzido são respeitados. O carregamento por scripts locais permite `file://`, com caches limitados a oito grupos, 64 imagens e 24 milhões de pixels.

Todos os **133 vídeos Bink2** preservados foram convertidos e decodificados integralmente: 20.956 quadros, 672,6 segundos e 212.620.817 bytes de vídeo. São 76 vídeos de campeões, 52 skins, quatro genéricos e um evento. Existem 70 associações de campeão para escolha automática; Nunu/Willump e Fiddlesticks permanecem acessíveis pela galeria. Skins, vídeos genéricos e evoluções de terceiro estágio não são escolhas automáticas de nível 2. Garen Rugged preserva o WebM e o som externo anteriores; os outros vídeos são mudos. Manifesto com hashes, frames, duração e ferramentas: `cinematic-library-manifest.json`.

Reprodução: `tools/import_card_effects.py`, `tools/import_all_cinematics.py`, `tools/import_supported_cards.py`. Os importadores leem o acervo e ferramentas portáteis da pasta superior; eles não são necessários para jogar. A verificação REA confirmou inventário e identidade dos snapshots; UnityPy e ferramentas de mídia fizeram as extrações e conversões. Isso não é decompilação nativa nem execução de LoR.

As seções seguintes descrevem a integração histórica da v0.13.

Esta entrega aplica o conjunto útil ao duelo existente dos downloads preservados em 15/10. A revisão REA anterior confirmou o inventário e a identidade dos pacotes; parsers de formato e ferramentas de mídia fizeram as conversões. Não foi executado o cliente Riot nem anexado um processo a ele.

## Arenas

Doze arenas estão disponíveis: as oito anteriores, Shurima, Targon, Bandópolis e Zaun. As quatro novas usam texturas do cliente atual; o modo de geometria usa texturas atuais em todas as doze. A seleção automática agora reconhece Shurima, Targon e Bandópolis. Piltover e Zaun compartilham uma região nos dados das cartas: o automático continua escolhendo Piltover; Zaun pode ser escolhida manualmente.

`tools/import_arena_geometry.py` empacota **24 malhas estáticas / 54.982 triângulos**, preservando UVs e texturas. Para dez arenas, resolve os transforms Base, BaseUI e PlaySurface presentes nos prefabs selecionados. Para Ionia e Ilhas das Sombras, o recorte não contém o prefab principal: aplica somente a malha Base com sua transformação local, sem inventar uma hierarquia. A inversão X do export OBJ é compensada para a câmera; a projeção ortográfica e o enquadramento são adaptados ao campo DOM.

`arena-scene.js` desenha dois lados independentes em um canvas WebGL, apenas quando há entrada/troca de arena ou redimensionamento. Carrega recursos sob demanda e mantém até quatro arenas na GPU. O seletor **Visual do campo** oferece geometria original e modo leve por texturas; indisponibilidade/perda de WebGL mantém a representação leve. Os overlays interativos e as posições das cartas continuam no DOM.

O manifesto `assets/arenas/current/sources.json` registra cada malha, textura, transform, quantidade de vértices/triângulos e hashes dos exports/pacotes. A textura não foi redesenhada. Shaders Unity, luzes, partículas, interações dos adornos e todos os 322 modelos não foram reproduzidos; algumas peças decorativas e encaixes permanecem ausentes ou adaptados.

## Curvas e mídia

- **Cinco AnimationClips / 133 tracks** entram no runtime: bloqueio, revelação, criação, morte comum e morte de campeão. O gesto de bloqueio usa o canal nativo de recuo; as mortes usam translações/quaternions reais sobre recortes DOM; a invocação de campeão usa convergência de fragmentos e a curva de revelação. Amplitude, polígonos, opacidade e duração foram adaptados. Os 24 clipes foram decodificados e inventariados; isso não significa que todos rodem no navegador. Evidência: `CURRENT_CURVES.md`.
- **12 arranjos de música regional + 9 efeitos originais**, identificados por perfis/eventos/estados e convertidos para OGG. A música acompanha a arena do jogador; mantém pausa, volume e mute. Os sons têm controle separado. São arranjos renderizados previamente, sem executar a mixagem dinâmica completa Wwise. Evidência: `AUDIO_CLIENTE_ATUAL.md`.
- **Uma cinemática de Garen Rugged**, VP9 WebM de 5 segundos; desde v0.28, com som original Wwise reproduzido separadamente. Disponível pela opção explícita **Evolução de Garen → Vídeo original · Garen Rugged (skin)**. O retrato continua sendo o padrão; Darius não recebe esse vídeo. Pular/Escape, cancelamento e movimento reduzido são respeitados. Erro no vídeo volta à apresentação de retrato. Os outros 132 BK2 permanecem fora da distribuição. Evidência: `CURRENT_VIDEO.md`.

O conjunto de regras/cartas não foi ampliado por esta integração: meshes, curvas e áudio não fornecem automaticamente habilidades executáveis.

## Verificação

- 50 testes existentes de regras, composição e seleção de arenas.
- `tests/arena-geometry.cjs`: hashes, desenho real WebGL das doze arenas, reentrada após cache, duas regiões, modo leve e fallback sem WebGL.
- `tests/arena-themes.cjs`: doze escolhas, seleção automática, retomada, seis bloqueios e cinco larguras.
- `tests/current-motion.cjs`, `tests/current_motion_import_test.py`, `tests/current-motion-browser.cjs`: decodificação, identidade, curvas e aceitação pelo navegador.
- `tests/current-audio.cjs`: 21 hashes, decodificação das doze músicas, gesto de play, mute e interrupção.
- `tests/native-assets-integration.cjs`: música/SFX no jogo, criação nativa de campeão e vídeo na evolução obtida por combate, fim, skip e movimento reduzido.
- Regressões de fidelidade, efeitos, campeões e Elixir/música no Chrome offline.

Os testes usam sessões isoladas e não alteram o salvamento pessoal aberto pelo usuário. O ZIP distribui apenas recursos para o jogo, fontes/manifestos e scripts/testes, sem ferramentas de pesquisa nem instaladores.
