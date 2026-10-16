# Runeterra · Arena offline — v0.32

Abra **JOGAR.cmd** ou **index.html**. Não requer internet, conta, Riot Client, Node ou Python para jogar. Todo o jogo e as artes estão nesta pasta. Você pode copiá-la para outro computador.

## Campanha de Runeterra — v0.32

O fim do duelo usa malhas, texturas e movimentos originais dos banners e da ruptura do Nexus do LoR. A reprodução web adapta câmera e materiais; iluminação, erosão e partículas Unity ainda têm diferenças. Sem WebGL, o banner usa a pose final original como imagem. **Pular animação**, efeitos desligados e movimento reduzido continuam disponíveis. Fontes e limites em `research/REA_OUTCOME.md`.

Os botões dos dois modos ficam alinhados na mesma linha e com a mesma altura no computador. **Mais**, no menu superior, reúne **Minha coleção** e **Explorar animações**; treino e continuação da partida salva ficam dentro de **Preparar duelo**.

Na entrada, escolha **Explorar campanha** (ou **Continuar campanha**, após a primeira vitória). A tela inicial apresenta Campanha e Duelo livre lado a lado, com mapa e campeão. **Preparar duelo** abre a seleção de deck e adversário; **Voltar aos modos** retorna ao menu. No celular, os modos ficam empilhados. O painel da campanha mostra seu nível e encontros concluídos. Os efeitos sonoros começam ativados por padrão; o botão **Som** guarda sua preferência para as próximas visitas. A música mantém seu controle independente.

O atlas usa a textura, as posições e os **dez símbolos oficiais das regiões** do [mapa da Riot](https://map.leagueoflegends.com/pt_BR), preservados localmente. Demacia, Noxus, Freljord, Ionia, Piltover e Zaun, Águas de Sentina, Shurima, Targon, Ixtal e Ilhas das Sombras podem ser visitadas desde o nível 1; os níveis recomendados não bloqueiam regiões. Arraste o mapa, use os controles de ampliação ou deslize a lista de destinos abaixo dele. Escolher um destino revela seu emblema no mapa; o símbolo também aparece no painel regional.

Clique no símbolo ou no nome de uma região para selecioná-la sem mover o mapa. Arrastar o fundo continua movendo o atlas; os controles de zoom e **Recentrar** ficam abaixo dele, sem encobrir os emblemas.

Passe o mouse pelo terreno, pelos emblemas ou pela lista de destinos para revelar o contorno territorial e uma prévia com nível recomendado e chefe, sem selecionar a região. O contorno aparece suavemente e o painel faz uma transição curta ao selecionar. No toque, a região selecionada mantém seu realce. **Efeitos desligados** e a preferência de movimento reduzido tornam as mudanças imediatas. Os nove contornos territoriais derivam das máscaras do mapa oficial; Piltover e Zaun usam um halo urbano. A geometria é vetorial, leve e funciona offline.

São **70 encontros**, sete por região: patrulha, duas rotas alternativas, um encontro opcional, elite, chefe e desafio avançado. Uma das duas rotas basta para chegar à elite; vencer o chefe abre o desafio avançado. Chefes começam com sua carta de liderança na mão após a troca inicial e mana de feitiço, conforme a regra exibida no encontro. Essa carta mantém custo e habilidades normais. Os novos capítulos enfrentam Yone, Dragão Quimtec, Xerife Lariette Rose, Raz Sanguescama, Vovô Rumul, Capitão Farron e Comandante Ledros; o desafio avançado de Ionia garante Minah. São cartas já automatizadas, sem atribuir regras de campeão às unidades que não são campeões em LoR.

Ixtal é uma expedição contra tropas noxianas invasoras, com deck de Noxus; a região geográfica não é apresentada como uma região de cartas de LoR. Os seis novos decks da campanha ficam separados da biblioteca pessoal. Os níveis, encontros e a história desta campanha são originais do protótipo.

Cada primeira vitória concede XP; a cada 100 XP você ganha um nível de campanha. Maestria registra os encontros concluídos e vencer um chefe concede um título permanente. Repetir encontros melhora o recorde de rodadas, sem repetir a recompensa. Derrotas e empates não apagam conquistas. Os níveis indicam sua jornada e não concedem atributos extras ao deck. Elites e chefes liberam decks completos; não há recompensas de cartas avulsas.

Na campanha, escolha um deck inicial, um deck conquistado ou um deck salvo que use as cartas dos decks conquistados. **Montar ou editar deck** abre o editor com essa coleção. A aliança libera combinações de até duas regiões; o duelo livre mantém a coleção completa.

O progresso fica em `runeterra-campaign-v1`, separado dos decks e do salvamento de duelo. **Exportar progresso** cria `runeterra-campanha.json`; **Importar progresso** combina conquistas sem apagar vitórias atuais e preserva o melhor recorde. O backup da campanha contém conquistas; exporte seus decks e sua partida separadamente nos controles existentes. Se houver partida em andamento, iniciar outro encontro exige escolher entre continuar, substituir a partida ou cancelar. O resultado registra a recompensa antes da apresentação de vitória e permite **Voltar ao mapa** ou **Repetir encontro**.

O mapa, seus dez emblemas e os módulos da campanha entram no cache essencial do PWA. Progresso e backups v0.31 continuam compatíveis: XP, recordes, títulos e maestria das três regiões iniciais são preservados. As mesmas limitações de armazenamento por navegador/endereço descritas abaixo se aplicam ao progresso. Detalhes da implementação em `docs/campaign.md`.

## PWA para iOS e Android

A campanha agora tem um **diagrama de caminhos** em cada região: patrulha, estrada ou rio, desvio opcional, elite, chefe e desafio avançado. Os nós mostram bloqueios, conclusão, XP e decks como recompensa. Toque ou use o teclado para ir aos detalhes da etapa, sem iniciar uma batalha automaticamente. Os 70 encontros e o progresso atual são preservados.

O preparo offline mostra uma barra de progresso e permite tentar novamente se a conexão falhar. Depois da primeira instalação desta versão, atualizações futuras reaproveitam os arquivos essenciais cujo conteúdo não mudou; uma instalação incompleta não substitui a versão funcionando. O download opcional das artes usa até quatro requisições simultâneas, com pausa e retomada. Imagens já presentes no cache de artes não são duplicadas no cache automático. Os atalhos do aplicativo oferecem **Campanha** e **Duelo**, nos sistemas que exibem atalhos de PWA; `?mode=campaign` e `?mode=duel` também abrem diretamente cada modo.

O mesmo jogo agora pode ser instalado na tela inicial. Publique o conteúdo desta pasta em uma hospedagem estática **HTTPS**, preservando os caminhos de `assets/`. Funciona também em uma subpasta. No iPhone/iPad, abra o endereço no Safari e escolha **Compartilhar → Adicionar à Tela de Início**. No Android, use **Instalar aplicativo** na seção **Instalar e jogar offline**, ou a opção equivalente do navegador. O ZIP/pasta aberto diretamente no celular não registra o PWA; é necessário o endereço HTTPS. Para testar no computador: `python -m http.server 8765 --bind 127.0.0.1` e abra `http://localhost:8765/`.

Espere a mensagem **Campanha e duelo prontos para abrir offline** antes de desconectar. A preparação salva HTML, estilos, scripts, fontes, ícones e fundos essenciais (cerca de 32 MB sem compressão de transporte). Artes visitadas são guardadas em um cache automático limitado a 48 imagens de até 2 MB cada. **Baixar artes para offline** salva também todas as artes usadas pelas cartas jogáveis e pela coleção; o botão mostra o tamanho real. O download é opcional, pode ser pausado e retomado e exige manter o app aberto. Se o sistema suspender o app, toque novamente para continuar. Sem uma arte disponível, as cartas do duelo mostram nome, custo e atributos sobre uma imagem de reserva.

Áudios, vídeos e a galeria completa de efeitos continuam dependendo de conexão; não são baixados pelo PWA. Respostas parciais de mídia não passam pelo cache, para preservar a reprodução com byte ranges no Safari. Partidas e decks continuam salvos no navegador/dispositivo em uso. A instalação, outro navegador ou outro endereço podem ter armazenamento separado. O navegador pode negar persistência ou liberar o cache por falta de espaço; os arquivos exportados continuam sendo o backup portátil dos decks.

Celulares usam **Texturas · modo leve** por padrão, sem inicializar o WebGL da arena. A escolha manual de 3D é respeitada e salva. A interface considera áreas seguras de notch/indicador inferior, altura dinâmica da tela, controles de toque e rolagem em paisagem curta. Toque joga cartas; o **Grimório** continua disponível pelo botão, sem uma prévia de hover interceptar o toque. Áudio começa após interação e pausa quando a página fica oculta.

Atualizações são baixadas em segundo plano e aguardam fechar todas as janelas do app; não recarregam um duelo em andamento. Depois de alterar HTML, CSS, scripts ou artes, execute **`python tools/build_pwa.py`** antes de publicar. O gerador deriva a versão do conteúdo, verifica os arquivos e gera `sw.js` e `pwa-artwork.json`; edite `tools/pwa-worker.js` para mudar o service worker. Publique a pasta atualizada como uma unidade e mantenha `sw.js` com revalidação (`Cache-Control: no-cache`), `.webmanifest` com MIME `application/manifest+json` e compressão Brotli/gzip para JS/CSS/JSON. Não redirecione arquivos ausentes para HTML com status 200.

Validação: `node tests/pwa.cjs` requer Playwright, Chrome e o WebKit do Playwright (`playwright install webkit`). Verifica instalação em subpasta, layouts, download pausado/retomado, toque, partida salva e reabertura offline em Chromium e WebKit com perfil de iPhone. No WebKit, o teste interrompe a conexão do servidor em vez de `setOffline(true)`, devido ao [problema conhecido do Playwright #42775](https://github.com/microsoft/playwright/issues/42775). Isso não substitui a validação final da instalação em aparelhos físicos.

Referências: [instalação de PWA — MDN](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable), [cache de PWA — MDN](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Caching) e [web apps na tela inicial — WebKit](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/).

Em **Personalizar partida → Evolução dos campeões**, escolha **Com animação** ou **Sem animação**. A preferência fica salva; a evolução e seus atributos funcionam nas duas opções. Sem animação pula vídeos, efeitos específicos e apresentação de evolução.

Na tela inicial, **Encontrar decks com uma carta** permite digitar o nome ou código e escolher uma carta da lista. As sugestões incluem apenas cartas presentes nos decks disponíveis para duelo e são atualizadas ao salvar um deck. **Escolha seu deck** passa a mostrar somente listas que contêm essa carta, incluindo os decks de **Meus decks**. **Outros decks** fica em ordem alfabética, inclusive com o filtro ativo. O filtro funciona também com feitiços. **Limpar filtro** recupera a lista completa. Ao digitar diretamente uma carta de deck salvo com regras pendentes, ele aparece separadamente para abrir no editor; uma busca sem decks de duelo impede iniciar uma partida com seleção inválida e mantém a continuação da partida salva disponível.

## Cartas novas em Minha coleção — v0.30

**Minha coleção** abre diretamente as **1.647 colecionáveis**. Todas podem ser adicionadas ao editor e salvas em **Meus decks**, exportadas/importadas em JSON ou código LoR. Outras 865 formas e cartas geradas aparecem no filtro correspondente e são criadas pelas habilidades durante o duelo. O modo livre separado e seus botões foram removidos.

O filtro **Novas cartas para jogar** destaca as cartas adicionadas. O seletor **Decks com as cartas novas** carrega 12 listas prontas, também destacadas em **Novos decks** no menu: Braum/Poros, Anivia/Renascimento, Tryndamere/Mana, Braum/Cicatrizes, Garen/Desafiadores, Dragões, Darius/Trifarianos, Sacrifício/Ressurreição, Gemas/Auxílio, Invocações, Retornos e o trio de campeões do Freljord. Selecione uma lista, clique em **Montar este deck** e depois **Salvar e usar deck** para iniciar o duelo normal.

**Jogar contra o bot** usa **396 cartas colecionáveis com regras automáticas**, 36 subcartas e cinco campeões. A expansão inclui invocação, retorno, atordoamento, Desafiador/Vulnerável, ressurreição, mana adicional e novos feitiços com alvos distintos ou na mão, além de Braum, Anivia e Tryndamere com evoluções e assinaturas. Decks que usam cartas ainda não automatizadas ficam em **Meus decks · Regras pendentes**, com edição e exportação disponíveis. Eles não aparecem como opções de duelo até suas habilidades serem implementadas. A cobertura automática atual fica em `research/datadragon/supported-rules-coverage.json`.

**Explorar animações** reúne 564 grupos de efeitos, **557 com prévia visual e sete com metadados**, e **133 vídeos completos**, com busca e filtro por carta/fase. São 6.807 texturas originais verificadas, 3.435 clipes únicos e 19.330 sistemas de partículas únicos usados na adaptação. Feitiços resolvidos, invocações, ataques, mortes, retornos e evoluções acionam apresentações disponíveis no duelo. Os recursos são carregados sob demanda por arquivos locais, com limites de memória e cancelamento.

Os 133 Bink2 foram convertidos em WebM e conferidos quadro a quadro: 20.956 quadros e 672,6 segundos. O catálogo inclui 76 vídeos de campeões, 52 skins, quatro genéricos e um evento. Setenta campeões têm associação de código para escolha automática quando há regra de evolução; Nunu/Willump e Fiddlesticks ficam na galeria. Skins exigem escolha explícita. Somente Garen Rugged tem som externo recuperado; os demais vídeos são mudos.

Os efeitos são uma adaptação Canvas2D das texturas, curvas, materiais e partículas recuperadas. Shaders Unity, deformação de malhas e timelines completas não foram reproduzidos. Não equivale a executar o cliente original. Detalhes e fontes em `research/INTEGRACAO_CLIENTE_ATUAL.md`; verificações em `VALIDACAO.md`. As seções abaixo registram o histórico de versões anteriores.

## Garen Rugged com som — v0.28

A cinemática agora reproduz o efeito sonoro original da skin, extraído do evento `Play_CH_RiftQuest_Garen_ChampLvlUp`. Ative **Som** no jogo para ouvir. O vídeo contém todos os 150 quadros (5 segundos); o áudio separado termina naturalmente, inclusive a cauda após o vídeo. Pular, Escape, sair da partida ou desligar o som interrompem o áudio.

O encerramento tem uma transição de 180 ms, e o player aguarda o fim real do vídeo mesmo em reprodução lenta. Um limite de 15 segundos protege apenas o carregamento e as travadas. Os efeitos Unity originais de saída para a mesa ainda não foram reconstruídos; a transição local suaviza esse retorno.

## Personalização com transições — v0.27

Abrir **Personalizar partida** apresenta os três controles e a prévia em sequência; a seta gira ao abrir/fechar. Mudar arena, visual do campo ou apresentação do campeão dá uma transição curta na prévia. A seleção é aplicada imediatamente, sem aguardar a animação. Trocas rápidas substituem o movimento anterior.

Efeitos desligados e movimento reduzido impedem as animações. Fechar o painel, ocultar a página ou entrar no duelo cancela a transição da prévia. O painel mantém o comportamento nativo de `details`, inclusive no teclado. Teste de componente em documento sintético, sem abrir o jogo ou seus salvamentos: `node tests/welcome-settings-isolated.cjs` (Chrome e Playwright). A inspeção da aba real `file://` continua indisponível.

## Entrada organizada e animada — v0.26

A tela inicial tem título em duas linhas no desktop, configuração mais larga, botão **Jogar contra o bot** e atalhos alinhados para coleção e treino. O texto e o treino acompanham o campeão do deck selecionado. O indicador **Duelo contra bot** usa duas espadas e uma linha fina, substituindo a caixa anterior.

Entradas curtas de 320–460 ms apresentam o indicador, os textos e as três cartas em sequência; mudar o deck apresenta suas novas cartas. As setas respondem ao mouse e as cartas se levantam discretamente. Não há animação contínua ou espera para clicar. O controle **Efeitos** e a preferência de movimento reduzido desativam os movimentos.

Verificação em documento sintético sem abrir a página do jogo, recursos ou salvamentos: oito larguras de 320 a 2529 px, personalização aberta/fechada, ausência de rolagem horizontal, botões/seletores com pelo menos 44 px, título desktop em duas linhas e animações reais das espadas, linha, texto e cartas. Efeitos desligados e movimento reduzido cancelaram as animações. A inspeção da aba real `file://` continua indisponível; essas verificações não equivalem a uma captura do jogo completo.

## Mapa e controles integrados

As peças laterais originais voltam a apoiar visualmente os Nexus, a ação e as engrenagens, com transição suave para o piso e sem restaurar as faixas escuras. A moldura da ação, os encaixes da reserva e os suportes dos Nexus usam malhas, UVs e textura extraídos do cliente. Cartas e controles mantêm suas posições e funções.

O fluxo REA verificou o inventário e a identidade do acervo; a extração Unity e a projeção adaptada estão documentadas em `research/REA_MAP_INTEGRATION.md`. Reprodução: `tools/import_map_hud.py` e `node tools/render_map_hud.cjs`. Validação offline: `node tests/map-integration.cjs`.

Os segmentos azuis de mana também usam texturas, UVs e posições do prefab original, alinhados aos encaixes da moldura. Estados cheio/vazio acompanham a mana do motor. Fontes e limites da tonalização: `research/REA_MANA.md`. Reprodução: `tools/import_mana_pips.py`. Teste: `node tests/native-mana.cjs`.

## Marcador de ataque e defesa

Você e o bot têm indicadores de ataque e defesa fixos nos dois encaixes circulares da moldura da ação. A espada e o escudo ficam dentro desses círculos; o alvo de clique de preparar ataque acompanha o encaixe inferior. Ganhar o token monta cinco fragmentos; enquanto disponível, a espada original se move com o clipe nativo de espera e o flipbook de chamas. Preparar o ataque aciona `Punch`; gastar o token dispersa os fragmentos e exibe o escudo, cujo contorno vem do acervo e acabamento é adaptado.

A moeda passa entre os encaixes somente quando uma nova rodada troca o lado atacante, usando a curva original de um segundo, com giro, profundidade e escala. Passar uma ação, jogar carta, atacar, bloquear, responder e Mobilizar durante a mesma rodada não repetem o voo. Seu rosto corresponde ao lado que recebe o ataque: espada quando tem ataque disponível, escudo caso contrário. Essa composição é uma adaptação solicitada para o protótipo; o medalhão cinza de cartas recuperado do acervo não aparece na passagem. Ao terminar, os símbolos fixos continuam visíveis e a borda clara indica quem tem a iniciativa de ação. Efeitos desligados e movimento reduzido mantêm os indicadores estáticos. Fontes, investigação REA e adaptações: `research/REA_TOKEN.md` e `research/REA_INITIATIVE.md`. Testes: `node tests/attack-token.cjs` e `node tests/initiative-token.cjs`.

## Nexus mais próximo da referência — v0.24

Os cristais mantêm as malhas e texturas originais do cliente, agora vistos de perfil em três quartos, com mais contraste e cores de rubi/safira. A vida fica em uma pequena moldura de pedra e latão junto ao suporte, substituindo a placa longa. O acabamento da divisória ficou mais discreto. No celular, o nome do jogador permanece separado do cristal.

Sem WebGL ou após perda do contexto, entram imagens dos mesmos modelos renderizados, incorporadas para abrir offline. A explosão do Nexus também usa esses pixels quando a GPU não está disponível. Câmera, luz, recorte da haste traseira e moldura são adaptações visuais à referência; não executam o shader original do cliente.

Teste: `node tests/nexus-hud.cjs`. Prévia em `test-results/nexus-v24-detail.png`; fontes e reprodução em `research/NEXUS_HUD.md`.

## Som dos impactos — v0.23

Ative **Som** no duelo para ouvir os impactos originais recuperados do cliente local: colisão entre cartas e golpe no Nexus. Cada áudio começa no contato da animação; Sobrepujar produz um impacto na carta e outro quando o projétil chega ao Nexus. Bloqueador removido não produz impacto falso. Desligar Som interrompe os efeitos; cancelar a animação interrompe os sons de combate. Música continua com controle próprio. Movimento reduzido mantém a apresentação imediata existente, sem sons de colisão.

Origem e limites da extração em `research/AUDIO_CLIENTE_ATUAL.md`. Verificações: `node tests/combat-audio.cjs` e `node tests/current-audio.cjs`, com Chrome e Playwright.

## Cartas e leitura do duelo

A mão fica inteiramente dentro da janela, com cartas maiores e espaçamento que acompanha até dez cartas. Passe o cursor ou use o foco do teclado para ampliar uma carta. A inspeção mostra o retrato completo com custo, atributos e texto; permanece aberta enquanto o cursor estiver na carta ou no painel, onde é possível rolar os detalhes. A faixa central destaca rodada, ação e token de ataque com texto maior e fundo de alto contraste.

Verificação: `node tests/card-legibility.cjs`, com Playwright e Chrome. Cobre mãos com cinco e dez cartas em tamanhos de celular, tablet e desktop, inspeção persistente e funcionamento offline. Ataques e bloqueios: `node tests/click-hud.cjs`.

## Tela inicial

As listas de decks e adversários identificam os decks gerados pelas cartas principais e regiões, com o estilo de jogo ao final. Os nomes aparecem também no duelo. Partidas antigas recuperam nomes pelo deck registrado ou pelas cartas preservadas no salvamento; nomes personalizados são mantidos. Verificação: `node tests/deck-names.cjs` e `node --test tests/deck-names.test.cjs`.

A entrada destaca a arte original do campeão e três cartas do deck selecionado, incluindo decks personalizados. Escolha seu deck e adversário junto ao botão de iniciar. **Personalize seu duelo** expande a seleção de arena, visual do campo, evolução de Garen e prévia do mapa. Coleção, treino e continuação da partida salva continuam disponíveis. O layout se adapta ao celular e usa somente os recursos locais.

Verificação da entrada: `node tests/welcome.cjs`, com Playwright e Chrome no ambiente de desenvolvimento. Cobre troca de campeão, configurações, coleção, início, continuação, treino e sete larguras de 320 a 2529 pixels sem requisições à rede. Capturas em `test-results/inicio-desktop.png` e `test-results/inicio-mobile.png`.

## Dimensões explícitas do campo — v0.22

Após o relato de tela vazia, o campo deixou de depender de altura automática com `aspect-ratio`. A área disponível do duelo agora fornece largura e altura explícitas para o contêiner, mantendo 8:5 e centralizando a arena. O cálculo acompanha a altura real do cabeçalho. A folha de cenário é carregada depois do acabamento do duelo para evitar conflito entre regras de dimensionamento.

`node tests/arena-layout-isolated.cjs` verifica um documento sintético contendo apenas a estrutura de layout e o CSS: seis resoluções, duas alturas de cabeçalho, redimensionamento e ocultar/reabrir. Confere tamanho visível, proporção, centralização e encaixe sem cortes. Não abre o jogo, a aba do usuário nem qualquer salvamento; todos os pedidos de recursos são bloqueados. A reprodução visual na aba real continua pendente devido à restrição de inspeção de `file://`.

## Proporção em monitores grandes — v0.21

Em janelas com mais de 1100 pixels de largura, o campo inteiro mantém a proporção 8:5 das duas imagens nativas de 1600 × 500. A arena cabe na largura e altura disponíveis, centralizada com faixas laterais ou espaço acima/abaixo quando necessário. Cartas, Nexus, animações e controles continuam no mesmo contêiner, alinhados com o mapa. Isso evita deformar o piso e as engrenagens em monitores largos. O layout compacto continua disponível nas janelas menores.

Alteração restrita ao layout CSS; sem mudança nas regras ou nos salvamentos. A proporção foi conferida com as dimensões reais dos doze recursos e cálculos de encaixe em resoluções comuns e ultrawide; a visualização na aba `file://` continua sem confirmação por restrição de inspeção do navegador.

## Fundo incorporado e camadas — v0.20

Como o fundo continuou preto no navegador do usuário após a v0.18, a exibição foi alterada: os doze mapas agora são imagens opacas incorporadas em scripts locais e exibidas por elementos `img`. Ficam acima do canvas 3D e abaixo das animações ambientais. Assim, a camada visível não depende de URLs de imagem no CSS nem do conteúdo preservado pelo WebGL. As duas metades continuam acompanhando os decks; prévia, linha central e destaques de combate usam a mesma disposição.

As imagens foram geradas dos fundos nativos já renderizados, com JPEG de alta qualidade e composição opaca. Para recriar: `python tools/embed_arena_backgrounds.py`. Fontes e hashes estão em `assets/arenas/backgrounds/sources.json`.

Validação desta versão: 54 testes Node passaram; Pillow decodificou e comparou os doze recursos incorporados com suas fontes. A inspeção da aba real foi bloqueada pela política do navegador para `file://`; portanto, o resultado visual no navegador do usuário ainda precisa ser confirmado. A prévia `test-results/recurso-mapa-piltover-v20.jpg` mostra somente o recurso gerado, não uma captura do jogo.

## Explosão do Nexus e resultado — v0.19

O Nexus derrotado acumula energia por cerca de meio segundo e se rompe em 14 estilhaços feitos dos pixels do próprio cristal. Duas ondas de choque e partículas acompanham a ruptura, na cor do Nexus destruído. Em empate, os dois cristais explodem. Em seguida, o emblema abre as asas, os raios surgem ao fundo e entram o título, o texto e os botões de resultado. A sequência é uma criação para este protótipo, inspirada na referência visual fornecida; não reproduz um vídeo ou timeline original do cliente.

**Pular animação**, Escape, desligar Efeitos e voltar ao menu continuam funcionando. Movimento reduzido e efeitos desligados mostram o resultado diretamente. Teste offline: `node tests/duel-outcome.cjs`. Capturas em `test-results/nexus-ruptura-v19.png`, `test-results/vitoria-v19.png` e `test-results/derrota-v19.png`.

## Correção do fundo preto — v0.18

O cenário 3D era desenhado apenas ao entrar/redimensionar e seu buffer podia ser descartado depois da apresentação. Ao mesmo tempo, a imagem estática de segurança estava oculta. Agora o WebGL preserva o quadro do mapa e dos Nexus parados, os fundos estáticos ficam disponíveis por baixo e o cenário é conferido após a apresentação. Um quadro vazio/preto, erro de desenho ou perda de contexto faz o jogo usar a imagem estática. A linha central e os destaques de combate ficam acima dessas camadas. As animações ambientais continuam funcionando.

O teste novo `node tests/arena-background.cjs` aguarda o mapa parado, sem redesenhá-lo antes da leitura, e verifica os pixels reais do quadro e da captura composta. O teste anterior de geometria redesenhava imediatamente antes de conferir o buffer, o que não detectava esse descarte. Também foram testados os doze temas, os efeitos desligados, a perda de contexto e falhas simuladas de carregamento/desenho. Scripts e CSS alterados têm versão na URL para atualizar o cache ao recarregar.

## Mapas em movimento — v0.17

As doze arenas têm ambientação própria nos dois lados, conforme o tema de cada deck. Piltover usa a engrenagem original extraída (200 triângulos), renderizada como sprite, com rotação, correntes de energia e vapor. Floresta tem folhas e ondulações de água; Demacia, poeira iluminada; Noxus, brasas; Ionia, pétalas; Freljord, neve; Águas de Sentina, névoa e água; Ilhas das Sombras, espectros e névoa; Shurima, areia; Targon, estrelas; Bandópolis, esporos/vaga-lumes; Zaun, vapor químico e bolhas.

`arena-ambient.js` desenha em um único canvas decorativo, limitado a 24 quadros por segundo, com o espaço das cartas e a linha central preservados por máscara. Não captura cliques. Funciona com geometria 3D, modo leve e sem WebGL. Pausa/limpa ao sair do duelo, encerrar a partida, ocultar a página, desligar **Efeitos** ou ativar movimento reduzido. Respeita a escolha explícita de efeitos completos já existente no jogo.

A colocação, velocidades e efeitos de ambiente são adaptações próprias; não são os scripts/animações Unity originais. O sprite nativo mantém UVs e textura do cliente, com fontes e SHA-256 em `assets/arenas/ambient/sources.json`. Para recriar: `node tools/render_ambient_gear.cjs` no ambiente de desenvolvimento. O dado é embutido em `arena-ambient-data.js` para funcionar offline sem contaminar a leitura do canvas por `file://`.

Teste: `node tests/arena-ambient.cjs`. Prévia local gravada: `test-results/mapa-piltover-v17.webm`.

## Campo, mana e fim do duelo — v0.16

As vinte marcas de mana agora ficam dentro da moldura, e **Confirmar** cabe no orbe. A linha divisória e o botão compartilham o centro exato do campo. A projeção das doze arenas amplia o espaço de combate, com as reservas fora da área central; a mão fica mais baixa enquanto está em repouso.

O modo leve e o fallback sem WebGL usam doze fundos estáticos renderizados das mesmas malhas, UVs e câmera do modo 3D. Não mostram mais recortes dos atlas de textura. Para recriá-los, execute `node tools/render_arena_fallbacks.cjs` no ambiente de desenvolvimento com Playwright e Chrome. Fontes e integridade em `assets/arenas/current/fallback-sources.json`.

Ao terminar um duelo, o Nexus vencido se fragmenta e entra o painel de **Vitória**, **Derrota** ou **Empate**. A fragmentação usa pixels do próprio cristal renderizado. É uma animação própria do protótipo, não um vídeo extraído de encerramento. Há **Pular animação**, Escape, **Jogar novamente** e **Ver campo**. Efeitos desligados/movimento reduzido apresentam o resultado diretamente. Voltar ao menu cancela o encerramento pendente.

Teste dedicado: `node tests/duel-outcome.cjs`; capturas em `test-results/tabuleiro-v16.png`, `test-results/vitoria-v16.png`, `test-results/derrota-v16.png` e `test-results/nexus-ruptura-v16.png`.

## Cristais do Nexus — v0.15

Revisado o quadro de 30 segundos da gravação original. A câmera foi virada para a face voltada à esquerda, com o suporte atrás, e o canvas voltou a ter proporção quadrada para evitar a gema achatada. A vista fica fixa também no impacto e em movimento reduzido. Malhas/texturas originais mantidas; iluminação e câmera continuam adaptadas ao navegador.

## Clique direto e acabamento do duelo — v0.14

Com seu token de ataque e sua ação, **clique numa unidade do campo para colocá-la no ataque**. Clique novamente para recolher. O botão central confirma o grupo escolhido. Ao defender, **clique num aliado para ocupar o primeiro bloqueio livre válido**, respeitando Elusivo, Assustador e Não Bloqueia. Clique novamente para recolher; para trocar o par, selecione o aliado e clique no atacante desejado. A confirmação continua separada da seleção. Alvos de feitiços mantêm prioridade sobre esses gestos.

A vista lateral dos cristais desta versão foi corrigida na v0.15. Mana e reserva de feitiços agora aparecem na moldura do botão central: dez marcas de mana por lado e três círculos de reserva, alimentados pelos valores reais. O botão permanece fixo na linha central enquanto se escolhem cartas. O token de espada também mantém o acesso ao preparo/confirmar ataque; o título e o nome acessível explicam sua ação.

Foi removida a grande moldura azul de reserva ociosa. O impacto foi reduzido ao contato entre as cartas; o rastro até o Nexus ficou menor e chega ao cristal. Dano aparece num marcador vermelho curto, cura num marcador verde. As curvas originais de fragmentação/recuo continuam disponíveis. A moldura do painel é SVG próprio baseado na referência; não é o renderizador original completo.

Teste específico: `node tests/click-hud.cjs`. Verifica clique, recolher, pares legais/manuais, confirmação separada, posição fixa do botão, mana/reserva, vista do Nexus, quatro larguras e movimento reduzido. Capturas em `test-results/painel-clique-v14.png` e `test-results/defesa-clique-v14.png`.

## Cliente atualizado integrado — v0.13

Há **12 arenas**, incluindo Shurima, Targon, Bandópolis e Zaun. **Visual do campo → Geometria original · 3D** usa 24 malhas estáticas com UVs/texturas do cliente atual; os dois lados acompanham os respectivos decks. **Texturas · modo leve** e o fallback sem WebGL continuam disponíveis. A seleção automática reconhece as novas regiões; Zaun é uma escolha manual, pois compartilha região com Piltover nos dados.

Cinco clipes nativos fornecem curvas de bloqueio, revelação, criação e fragmentação, com escala e duração adaptadas ao navegador. **12 músicas regionais originais** acompanham a arena do jogador, e nove efeitos identificados são usados em compra, mana, barreira, turno, token e botões. Música e Som têm controles independentes; a faixa antiga do patcher permanece somente como recurso legado.

O menu **Evolução de Garen → Vídeo original · Garen Rugged (skin)** ativa uma cinemática original de cinco segundos, com o efeito sonoro original separado seguindo o controle **Som**. É a skin Rugged; o retrato do deck continua sendo o padrão. É possível pular pelo botão ou Escape. Efeitos desligados e movimento reduzido impedem a cinemática. Darius conserva a apresentação de retrato.

Foram aplicados os recursos compatíveis com o duelo atual; não há execução da cena Unity completa, de todos os 322 modelos, da mixagem dinâmica Wwise ou dos outros 132 vídeos. Detalhes, fontes, limites e testes em `research/INTEGRACAO_CLIENTE_ATUAL.md`.

## Animações a partir da gravação — v0.12

A gravação enviada em 15/10 orientou a nova sequência de combate: preparação do golpe, avanço do atacante e do bloqueador, clarão no contato, dano exibido no impacto, recuo e retorno dos sobreviventes para a base. Um golpe aberto lança um rastro até o Nexus; Sobrepujar mantém o dano excedente e um bloqueio cujo defensor morreu não mostra um acerto falso no Nexus. As regras continuam no motor, separadas da apresentação.

Os dois cristais agora usam malhas e texturas originais extraídas do cliente atualizado, renderizadas em WebGL, com movimento suave e reação ao dano. São reutilizados entre atualizações do campo; sem WebGL, a representação CSS permanece disponível. O botão circular recebe reflexo e brilho nas mudanças de ação; espada e escudo distinguem o token, os decks têm camadas e reagem à compra, e os indicadores de mana respondem ao gasto e à reposição.

**Efeitos: desligados** interrompe os movimentos; a preferência de movimento reduzido mantém os cristais estáticos e a vida é atualizada diretamente. Voltar ao menu cancela a apresentação. A gravação foi usada como referência visual: os tempos e efeitos de combate são uma reconstrução para navegador, sem reprodução das curvas e shaders exatos do cliente. Evidências e limites: `research/ANIMACOES_VIDEO.md`; hashes das malhas/texturas: `assets/arenas/nexus-sources.json`. A gravação pessoal não foi incluída no pacote.

Verificação: `node tests/video-motion.cjs`, com Chrome e Playwright. A suíte cobre movimento dos dois participantes nos dois sentidos, dano após o projétil, retorno, cristais originais renderizados, reutilização dos dois contextos WebGL, cancelamento, movimento reduzido e funcionamento offline.

## Arenas e disposição do campo — v0.11

No menu, **Arena → Automática · acompanhar os decks** escolhe cada metade do tabuleiro pelo campeão principal do respectivo deck e depois pela região predominante. A preferência de campeão é contada por cópias; empates são resolvidos pelo número de cartas e nome da região. Regiões sem textura disponível usam Floresta de Runeterra. Há oito escolhas manuais: Floresta de Runeterra, Demacia, Noxus, Ionia, Freljord, Piltover, Águas de Sentina e Ilhas das Sombras. A escolha manual vale para ambos os lados. O menu mostra uma prévia; a escolha fica salva para a próxima partida. Continuar mantém as arenas da partida salva.

O campo usa texturas originais do acervo histórico, projetadas em duas metades. Unidades na base usam marcadores verticais; atacantes e bloqueadores avançam para o centro e passam a marcadores horizontais. Os pares numerados ficam na mesma coluna. O botão de ação usa o atlas azul/cinza original, e os versos também vieram do acervo. A moldura do botão e a iluminação foram reconstruídas em SVG/CSS. Os cristais CSS da v0.11 foram substituídos pelas malhas locais na v0.12. O campo respeita a preferência de movimento reduzido.

Foi corrigido um conflito de CSS em que passar o mouse ou selecionar uma carta substituía seu deslocamento no campo: a carta saltava, desalinhava os bloqueios e o clique podia acertar o espaço vazio. A posição de combate agora é preservada em hover, foco e seleção. As linhas dos pares são calculadas depois de posicionar as cartas e atualizam ao redimensionar a janela.

A skill REA foi usada via CLI para verificar o snapshot de recursos. Fontes e SHA-256: assets/arenas/sources.json. Evidência e limites: research/REA_ARENAS.md. O tabuleiro permanece uma projeção 2D com texturas históricas; a v0.12 acrescenta os cristais em WebGL, sem executar a cena Unity completa. A imagem arena-v2.png continua usada na entrada, e o duelo usa o novo tabuleiro.

## Cartas do Data Dragon

A v0.10 sincroniza 11 conjuntos da fonte oficial [Data Dragon da Riot](https://developer.riotgames.com/docs/lor#data-dragon). O snapshot contém 2.512 registros, dos quais 1.647 são colecionáveis. A coleção jogável tem **77 cartas**, com nove regiões; as demais não são liberadas automaticamente porque dados e artes não implementam as regras.

Novas cartas incluem Disparo Místico, Vingança, A Ruína, Avalanche, Poção de Vida, Ritual de Renovação, Elixir de Ferro, Fúria da Batalha, Lampejo Congelado e Perseguição Implacável. As novas unidades usam apenas palavras-chave suportadas; Sintonia foi adicionada. Os filtros de regiões e contadores são derivados da coleção disponível. Há dois decks adicionais de 40 cartas: **Freljord e Ionia · Gelo e Ímpeto** e **Ilhas das Sombras e Noxus · Cerco Sombrio**.

Para atualizar os dados, execute `python tools/sync_datadragon.py` e depois `python tools/import_cards.py` e `python tools/build_official_catalog.py` (Pillow necessário somente para gerar miniaturas). A sincronização usa JSONs públicos sem chave de API. URLs e SHA-256 ficam em `research/datadragon/sources.json`; cobertura em `coverage.json`. A seleção de regras está explícita em `tools/expand_cards.py`. O importador usa artes locais da mesma versão ou baixa as faltantes via HTTPS e registra a origem em `assets/datadragon-assets.json`. O jogo continua sem fazer requisições à Riot durante o duelo.

Verificação da expansão: `node --test tests/expanded-cards.test.cjs` e `node tests/expanded-browser.cjs`. Os testes incluem efeitos específicos, artes presentes, nove regiões, novos decks, alvo aliado/Nexus e 100 partidas com o catálogo adicional.

## Adversários e catálogo completo

A v0.10 inclui **315 decks para enfrentar**: quatro listas iniciais e **311 composições geradas localmente** com as regras implementadas. Os decks gerados estão identificados por região e estilo (Pressão, Controle ou Equilíbrio). São listas válidas de 40 cartas, com pelo menos 20 unidades, até três cópias, seis campeões e duas regiões; não representam decks oficiais nem listas competitivas da Riot. Também podem ser escolhidos como seu deck no menu.

Na coleção, o filtro **Mostrar** alterna entre as 77 cartas jogáveis, **1.647 colecionáveis oficiais** e **2.512 registros**, incluindo 865 formas/cartas geradas. Todas têm miniaturas locais; o catálogo completo é paginado e permite buscar, filtrar e inspecionar cartas. Cartas ainda sem regras ficam marcadas como Consulta e não entram nos decks de duelo.

Foram adicionados Roubo de Vida, Barreira e Efêmero, além de dez cartas jogáveis, incluindo Refúgio Espiritual, Ripostar, Barreira Prismática e Marca das Ilhas.

**Importar código LoR** lê códigos no formato oficial (versões 1–5), mostra a lista e informa quais cópias ainda não têm regras. Decks válidos e totalmente implementados podem ir ao editor; os demais podem ser guardados como referência (até 200). Há dois exemplos publicados pela Riot, disponíveis no seletor. **Exportar código LoR** gera um código para a composição válida atual. O formato não carrega o nome do deck.

O [Data Dragon](https://developer.riotgames.com/docs/lor#data-dragon) fornece dados e artes; não oferece uma biblioteca de todos os decks competitivos. Os dois exemplos de códigos vêm da documentação e do [repositório oficial LoRDeckCodes](https://github.com/RiotGames/LoRDeckCodes). Nenhuma chave ou conta é necessária para esses dados públicos.

## Entender ataque e defesa

A faixa central identifica quem ataca e quem defende. **ATACA 1** e **BLOQUEIA 1** formam um par; os números ligam o atacante ao seu bloqueador. As cartas que não participam aparecem como **RESERVA**; durante a escolha da defesa, aliados ainda não usados aparecem como **DISPONÍVEL**. Um atacante aberto recebe **SEM BLOQUEIO → NEXUS**. O resumo conta os atacantes e bloqueios; efeitos como Sobrepujar ainda podem atingir o Nexus mesmo com bloqueio, consulte o Oráculo para a previsão.

Quando o bot ataca, clicar em um aliado já o coloca num bloqueio livre válido. Para mudar o par, clique no atacante desejado depois de selecionar o aliado. A instrução informa o aliado escolhido e o próximo passo. Ao atacar, aguarde o bot escolher os bloqueios e confira os pares antes de resolver o combate. Preparar um ataque mostra **VAI ATACAR**; isso ainda não confirma a ação. Passar o cursor ou focar uma carta numerada destaca o par. Durante o combate o Grimório abre apenas pelo botão, para não cobrir o campo automaticamente.

## Elixir, animações e música

Elixir da Ira custa 1 de mana e dá +3 de ataque a um aliado nesta rodada. Clique no Elixir e depois em um aliado destacado, ou arraste a carta diretamente sobre esse aliado. É preciso ter uma unidade no campo. Súbitos também funcionam enquanto você seleciona atacantes; o Elixir preserva os atacantes selecionados e a iniciativa. A animação mostra a carta, um trajeto vermelho até o alvo e o aumento de ataque no impacto.

O botão **Música** é separado de **Som** (efeitos originais identificados e efeitos sintéticos restantes). A música começa ao entrar/continuar um duelo, acompanha sua arena e pausa no menu ou quando a página fica oculta. Volume e preferência de música são salvos. Caso o navegador bloqueie a reprodução, use **Iniciar música**. A v0.13 usa os arranjos regionais recuperados; a antiga mídia 216316022 do banco `MU_Patcher_stage0.bnk` (74,182 segundos) permanece como recurso legado do patcher.

O movimento reduzido do sistema é respeitado por padrão. Para optar por animações completas, clique em **Efeitos: reduzidos**; o botão passa a **Efeitos: ativados**. Clique novamente para desligar. A escolha explícita é salva no navegador. As animações ainda são reconstruções 2D, sem as cinemáticas originais.

Importação reproduzível do áudio já decodificado: `python tools/import_audio.py`. Origem, hashes e referências do banco ficam em `assets/audio/source.json`. Regressão do Elixir e reprodução/controles de música: `node tests/elixir-audio.cjs`, com Playwright e Chrome disponíveis.

Escolha seu deck e deixe Adversário em Aleatório para sortear entre 315 decks. O sorteio evita o último adversário e um deck idêntico ao seu; também é possível escolher um adversário fixo. Continuar uma partida preserva o adversário já sorteado. Os decks de Garen/Darius têm 40 cartas e três cópias do campeão; os dois decks adicionais usam seguidores e feitiços. “Coleção e montar deck” permite editar e salvar um deck com as 77 cartas colecionáveis implementadas: 40 cartas, até três cópias por carta, seis campeões e duas regiões.

## Composição de decks

Abra **Coleção e montar deck** no menu. Use **Novo** para começar vazio ou **Usar deck do menu** para partir da lista selecionada. Busque pelo nome/habilidade e filtre região, tipo e custo. Os botões +/− ajustam as cópias; a lista à direita também permite remover cartas. Selecione a arte para ver detalhes. A curva conta todas as cópias e agrupa custos de 7 ou mais.

Dê um nome e escolha **Salvar e usar deck** quando completar 40 cartas. A biblioteca guarda até 50 decks, disponíveis em **Meus decks** e no seletor principal. Editar uma lista carregada atualiza esse deck; **Novo** cria outra lista. O nome escolhido acompanha o deck na partida. Alterações incompletas ficam como rascunho e são recuperadas ao reabrir o editor, inclusive após recarregar a página. O deck personalizado da versão anterior continua disponível.

**Exportar deck** baixa um JSON que **Importar arquivo** consegue ler e validar. Esse arquivo JSON é próprio do protótipo. Os botões separados Importar código LoR e Exportar código LoR trabalham com o formato oficial de códigos de deck. Arquivos inválidos não substituem a composição atual. O salvamento é local ao navegador; exporte as listas para transportá-las para outra pasta/computador. A coleção oferece as 77 cartas implementadas, sem um sistema de desbloqueio de cartas.

No duelo normal, escolha quais das quatro cartas iniciais deseja trocar e confirme. As substitutas são compradas antes de devolver as cartas marcadas ao deck; depois, a rodada 1 compra uma carta para cada lado. Arraste unidades do campo para a faixa central/lado inimigo e confirme em **Atacar**, ou use a seleção por clique.

Para testar um campeão imediatamente, selecione **Treinar invocação de Garen/Darius**. O treino garante o campeão na mão e começa com mana suficiente. Clique na carta ou arraste-a para o seu campo. No duelo normal, Garen custa 5 e Darius custa 6 de mana; é necessário comprá-los e alcançar esse custo. Partidas antigas continuam com seu deck antigo: inicie uma nova partida para usar os campeões.

## O que funciona

- v0.6: composição visual, filtros, inspeção, lista ordenada por mana, curva, biblioteca de decks com nome, recuperação de rascunho e importação/exportação JSON.
- v0.5: escolha da mão inicial, sequência visível de feitiços e janela de resposta. Rápidos/Lentos aguardam resposta; Rápidos e Súbitos podem responder. A sequência resolve da esquerda para a direita, começando pelo último feitiço preparado. Unidades/Lentos ficam indisponíveis durante respostas e combate.
- Bloqueios confirmados abrem uma resposta para o atacante antes dos golpes. Um bloqueador removido mantém o ataque bloqueado; Sobrepujar atravessa esse espaço. O bot também usa feitiços no combate e nas respostas.
- Olho do Oráculo: prevê vida dos Nexus e perdas de unidades usando o estado público e os bloqueios escolhidos, sem alterar a partida. A previsão supõe que ninguém adicione outra resposta.
- Primeira-Espada recebe +2|+2 somente na rodada do ataque. Súbitos preservam iniciativa e seguem a regra moderna de passagem após Súbito.
- Garen e Darius jogáveis, destaque dourado no campo, evolução para nível 2 e apresentação animada com suas artes locais.
- Garen evolui após dois golpes; possui Regeneração e, evoluído, Mobilizar no início da rodada. Seu efeito de invocação fortalece os outros aliados nesta rodada conforme o snapshot importado.
- Darius evolui com o Nexus inimigo em 10 ou menos de vida e mantém Sobrepujar.
- Cópias de um campeão na mão viram seu feitiço enquanto ele está no campo. Julgamento de Garen exige um aliado em combate; Dizimar de Darius causa dano ao Nexus. Os feitiços de campeão embaralham uma cópia no deck.
- Feitiços Súbitos conservam a ação. Durante o bloqueio, o defensor pode usar feitiços Rápidos/Súbitos; preparar um Rápido confirma os bloqueios atuais e abre a resposta adversária.
- Arena ilustrada de pedra e bronze, fontes locais do acervo e cartas na mão em leque.
- Animações de invocação, compra, feitiços, avanço dos atacantes, destruição e dano ao Nexus.
- v0.3: imagens completas das cartas na mão e na revelação, transformação em marcador de unidade, golpes por par, dano exibido no impacto e fragmentação com texturas do acervo. Parâmetros históricos e escolhas de reconstrução estão separados em `lor-motion-profile.js`.
- Controles “Efeitos”, “Som” e “Música”: impactos e efeitos nativos identificados, efeitos sintéticos restantes e músicas regionais locais. Respeita movimento reduzido por padrão, com opção explícita por efeitos completos.
- Grimório para detalhes, histórico e exportação do salvamento.

- Nexus de 20 de vida, compra, mão de até 10 cartas e campo de até 6 unidades.
- Mana até 10 e reserva de até 3 para feitiços; duas ações de passar iniciam a rodada seguinte.
- Ataque alternado, seleção de atacantes e bloqueadores, dano persistente e derrota por deck vazio.
- Robusto, Elusivo, Assustador, Não pode bloquear e Sobrepujar.
- Efeitos específicos de Sabotadora, Granadeiro, Aríete, Primeira-Espada, Shiraza e os feitiços implementados do catálogo.
- Bot local com compra de unidades, feitiços e seleção de bloqueadores. Ele conhece apenas sua mão e o campo para escolher ações.
- Salvamento automático no navegador e continuação pelo menu. Exportação JSON para guardar a partida.

## Limites deste recorte

É um motor próprio inspirado em LoR; não executa o cliente original nem recupera seu servidor. Todas as colecionáveis podem compor decks salvos na coleção. O duelo automático tem cobertura explícita em `research/datadragon/supported-rules-coverage.json`, incluindo Desafiador e cinco campeões. Não implementa campanha de aventuras, substituição de unidade com o campo cheio ou todas as habilidades do catálogo. Cada Rápido é confirmado separadamente, em vez de preparar várias cartas antes de um único envio. O primeiro ataque é sempre do jogador. O combate combina animações locais, cristais isolados em WebGL e recursos nativos adaptados; evoluções usam vídeos ou efeitos próprios quando disponíveis.

Partidas salvas nas versões anteriores mantêm suas regras antigas para permitir continuação. Inicie uma partida nova para ativar escolha da mão e respostas da v0.5. A API `Engine.create` mantém o modo antigo para testes de compatibilidade; o jogo usa `{faithful: true}` para criar duelos novos.

O salvamento depende do armazenamento permitido pelo navegador para arquivos locais. Se indisponível, o jogo avisa. O JSON exportado é um backup para inspeção; esta versão continua partidas pelo salvamento automático, não importa arquivos JSON. Mover a pasta ou usar outro navegador pode exigir uma partida nova.

## Desenvolvimento e fontes

Motor: `engine.js`, sem DOM e com RNG determinístico; combate e sequência retornam rastros para a apresentação. Campeões: `champions.js`; coleção: `collection.js`. Interface: `app.js`, `duel-ui.js`, `duel-ui.css`, `style.css`, `arena.css`, `lor-motion.css`, `champions.css`, `index.html`. Apresentação animada: `motion-v3.js`, `combat-motion.js`, `arena-chrome.js` e `champion-presentation.js`, com Web Animations API; o bot aguarda a conclusão. Os Nexus usam `nexus-data.js` e `nexus-view.js`. Conteúdo: `cards.js` e `assets/`. A ilustração `arena-v2.png` foi gerada para este protótipo; não é um tabuleiro 3D extraído do LoR. Fontes Beaufort e Univers copiadas do acervo local. Importação reproduzível: `python tools/import_cards.py`, a partir do acervo vizinho `datadragon_oficial/extraidos/latest_set1-pt_br`. Os nomes foram corrigidos manualmente porque o JSON extraído contém caracteres corrompidos. Custos, atributos e palavras-chave vêm do snapshot local; efeitos são implementados explicitamente.

Investigação de animações: `research/REA_ANIMACOES.md`, `research/animation-evidence-worker.md`, registros locais com hashes e inventário REA do snapshot de fontes. O REA não decodifica estes containers Unity diretamente; a investigação usa os exports Unity/CommunityDragon preservados. Dados históricos de 2020 não comprovam equivalência ao cliente atual. Curvas e texturas nativas são usadas onde identificadas; trajetórias e composição adaptam a apresentação ao navegador. Sons nativos recuperados coexistem com sons locais. A cena Unity completa não foi reconstruída.

Regras verificadas na documentação oficial da Riot: [velocidades de feitiços](https://support.riotgames.com/en-us/legends-of-runeterra/gameplay/types-of-spell-cards-and-how-they-work) e [rodadas, ataques e bloqueadores removidos](https://support.riotgames.com/en-us/legends-of-runeterra/gameplay/round-faq). Esses textos orientam o motor; não comprovam equivalência integral ao cliente.

Testes do motor e composição: `node --test tests/engine.test.cjs tests/champions.test.cjs tests/faithful.test.cjs tests/deck-tools.test.cjs`. A composição usa `collection.js`, `deck-tools.js` e `deck-builder.css`. Para abrir por HTTP durante desenvolvimento: `python -m http.server 8765 --bind 127.0.0.1` nesta pasta.

Testes de navegador: `node tests/browser.cjs`, `node tests/deck-builder.cjs`, `node tests/duel-ui.cjs`, `node tests/champions-browser.cjs`, `node tests/motion.cjs` e `node tests/fidelity.cjs`, com Playwright disponível e Chrome instalado. O último grava vídeo e requer o FFmpeg do Playwright; esse vídeo é uma gravação do protótipo em teste. Empacotamento: `python tools/package.py`, que produz um manifesto SHA-256 e verifica o CRC do ZIP.

Artes, nomes e personagens pertencem à Riot Games, preservados aqui como referência local. Protótipo de estudo não oficial. A autoria do motor não implica direitos sobre os recursos para publicação comercial.

## Progressão dos decks na campanha

Comece com três decks: agressivo de Noxus, defensivo de Demacia e controle das Ilhas das Sombras. Qualquer deck liberado pode enfrentar qualquer região. Vença a elite para conquistar o deck intermediário e o chefe para conquistar o deck principal: dois decks completos por região, sem cartas avulsas como recompensa.

Vença um chefe e três fases distintas de outra região para liberar **Aliança entre Regiões** e combinar cartas dos decks conquistados de até duas regiões. Repetir fases não conta novamente. O editor aberto pelo mapa mostra apenas cartas desses decks; o duelo livre continua com a coleção completa. Progresso antigo e importado recebe os decks correspondentes automaticamente. As listas reutilizam cartas e recursos já presentes no jogo.
