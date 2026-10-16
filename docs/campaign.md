# Campanha de Runeterra

## Caminhos e PWA para celular

`campaign-routes.js` desenha os caminhos dos encontros de cada região a partir de `requires` e `requiresAny` do motor atual. Estrada e rio convergem na elite; o opcional não bloqueia o chefe. Nós exibem XP, decks conquistáveis e conclusão. São botões de navegação aos detalhes: uma etapa bloqueada continua permitindo consultar os requisitos, sem iniciar um duelo. Os controles têm área mínima de toque de 44 px e foco por teclado. Não existe outra fonte de desbloqueios ou de recompensa no desenho; as chaves de progresso e os IDs dos encontros permanecem os mesmos.

As prévias de liderança regional ficam em `assets/campaign/portraits/` e ocupam 228 KB no total. `node tools/prepare_campaign_art.cjs`, com `sharp` disponível no ambiente de ferramentas, gera dez WebPs limitados a 640 × 480 a partir das artes locais. `sources.json` registra fontes, dimensões e hashes; os originais não são alterados. Após gerar imagens, execute `python tools/build_pwa.py`. Todas as prévias, emblemas, mapa e caminhos entram no núcleo offline.

O service worker preserva a ativação normal após fechar as janelas antigas. Cada cache essencial contém um registro de hashes, usado para reutilizar recursos inalterados na atualização seguinte. Versões anteriores sem esse registro fazem uma primeira preparação completa. Falha no preparo remove somente o cache novo incompleto, mantém a versão anterior e oferece tentar novamente. A barra acompanha a quantidade de arquivos preparados. Reutilizar um recurso não implica mudar o salvamento ou o perfil da campanha.

Validação adicional: `node --test tests/pwa-worker.test.cjs`, `node tests/pwa-update.cjs`, `node tests/campaign-routes.cjs` e `node tests/pwa.cjs`. Os cenários móveis testam os dez capítulos offline, incluindo as imagens regionais, batalha, resultado com XP, desbloqueio e perfil persistido. O resultado preparado no teste verifica integração, não balanceamento. O cenário de atualização usa versões de teste isoladas e verifica falha/retentativa, ausência de recarga forçada e preservação do perfil.

## Decks e Aliança entre Regiões

A campanha começa com três listas próprias, de uma região cada: Agressivo · Avanço de Noxus, Defensivo · Guarda de Demacia e Controle · Névoa das Ilhas. Podem enfrentar qualquer região. As listas iniciais não incluem campeões; derrotar um chefe conquista a lista completa daquela liderança regional, além do título e XP.

Cada região concede dois decks completos de 40 cartas: vencer a elite libera o deck intermediário, sem a liderança do chefe; vencer o chefe libera seu deck principal. Patrulha, rotas, encontro opcional e desafio avançado concedem XP e progresso, sem cartas avulsas ou outros decks. Repetir uma fase não duplica recompensas. São 23 decks ao conquistar todas as elites e chefes: três iniciais e vinte regionais.

Vencer um chefe conclui o percurso principal da região, sem exigir rotas alternativas ou desafios opcionais. A Aliança entre Regiões é liberada ao vencer um chefe e três encontros distintos de outra região, em qualquer ordem. Antes disso, decks da campanha usam uma região; depois, até duas. A montagem utiliza exclusivamente as cartas presentes nos decks conquistados, com até três cópias por carta conforme as regras normais.

O seletor oferece os três decks iniciais, os decks intermediários e de chefes conquistados e decks personalizados que cumpram essas regras. O editor aberto pelo mapa filtra as cartas desses decks e valida também presets/importações antes de salvar. O início do encontro revalida o deck, inclusive ao repetir uma partida. O duelo livre mantém sua coleção e biblioteca completas.

Desbloqueios são derivados das vitórias do perfil v1, sem outro armazenamento nem controle de cartas avulsas. Importação e salvamentos antigos recebem automaticamente os decks correspondentes às elites e chefes já vencidos. Cartas antes liberadas individualmente passam a depender dos decks conquistados; decks personalizados continuam salvos, mas precisam atender à coleção atual para iniciar outro encontro. Uma partida antiga já iniciada pode ser retomada.

As recompensas reutilizam as listas dos encontros e os recursos locais existentes, sem novos arquivos de imagem, áudio ou vídeo.

Verificação: `node --test tests/*.test.cjs`, `node tests/campaign-progression.cjs` e `node tests/campaign-browser.cjs` (Playwright/Chrome). O teste de progressão usa resultados preparados para verificar a integração de recompensas; não mede dificuldade ou balanceamento dos decks.

## Fronteiras e movimento do mapa

Pedido: animações inspiradas no atlas oficial, especialmente fronteiras ao passar o mouse. Direção: realce geográfico rápido (180 ms, curva `cubic-bezier(.22,1,.36,1)`), símbolos iluminados e uma transição de 200 ms no painel, com foco em continuidade visual e respostas rápidas. Nada move o mapa ao selecionar um marcador.

`tools/import_campaign_territories.py` preserva nove PNGs oficiais de território e analisa seus canais alpha para gerar `campaign-map-data.js`, com contornos SVG simplificados em aproximadamente 2,8 pixels da textura original. A importação usa Pillow no runtime de ferramentas; o jogo não depende dele. URLs, hashes e limites ficam em `assets/campaign/sources.json`. Piltover/Zaun não possui máscara territorial no atlas e recebe um halo de cidade, sem fronteira política inventada.

`campaign-map.js` / `campaign-map.css` desenham os vetores sobre a mesma superfície transformada do mapa, sem interceptar eventos. Não há camadas raster de 2048 px no runtime nem leitura de Canvas sujeita ao CORS de `file://`. Hover nos emblemas, destinos e interiores geográficos ativa apenas uma prévia. Sair restaura a região selecionada. Testes cobrem os cliques, arrastos e zoom existentes. Uma passagem do ponteiro é processada por quadro, sem loop permanente; o trabalho pendente e a animação do painel são cancelados ao fechar o mapa.

Teclado usa realce imediato. Movimento reduzido, Efeitos desligados e página oculta cancelam as transições. Toque usa a seleção permanente, sem depender de hover. Todos os dados vetoriais e estilos entram no núcleo PWA automaticamente via scripts/links do HTML; os PNGs originais ficam como evidência de importação, sem download obrigatório pelo jogo.

Correção v0.32.1: o grupo de zoom/Recentrar foi movido para fora do mapa. Em 1742 px, ele cobria o nome das Ilhas das Sombras e recebia o clique. Seleção pelo marcador agora informa explicitamente a origem e não chama o deslocamento automático; a lista de destinos continua revelando regiões fora do enquadramento. `tests/campaign-map-interaction.cjs` reproduz a sobreposição anterior e verifica clique/toque, pequenos movimentos do ponteiro, teclado, arrasto do fundo, zoom e recentralização.

Direção inicial: mapa livre com níveis recomendados, progresso permanente, exploração e batalhas difíceis. A coleção da campanha agora segue os desbloqueios descritos acima. Primeira entrega: Demacia, Noxus e Freljord.

## Expansão v0.32

Pedido: implementar os outros capítulos e exibir o símbolo de cada região. Dez regiões do atlas passam a ter sete encontros cada (70 no total). Ionia, Piltover e Zaun, Águas de Sentina, Shurima, Targon, Ixtal e Ilhas das Sombras acrescentam 49 encontros com títulos e lideranças próprias. Ixtal enfrenta uma expedição noxiana; não existe uma região de cartas Ixtal neste catálogo. As outras nove regiões usam cartas da própria região.

Os dez emblemas são os PNGs originais do mapa oficial, preservados sem edição em `assets/campaign/regions/`. `python tools/import_campaign_symbols.py` importa e verifica os arquivos; `assets/campaign/sources.json` registra URLs, dimensões e SHA-256. Mapa, lista de destinos e painel regional exibem o emblema. Uma marca de conclusão é acrescentada sobre o símbolo sem substituí-lo. Todos entram no núcleo offline do PWA.

`CAMPAIGN_DATA.decks` contém seis listas exclusivas dos adversários da campanha e não modifica a biblioteca do usuário. Chefes das novas regiões usam unidades com habilidades já automatizadas: Yone/Minah, Dragão Quimtec, Lariette, Raz, Rumul, Farron e Ledros. `openingCard` generaliza a garantia de mão inicial; `champion` continua compatível com os três capítulos antigos. A liderança não começa no campo e mantém custo/habilidades reais.

A chave/versão do perfil permanece v1; IDs e recompensas anteriores são estáveis. Teste específico preserva 85 XP e recordes de um backup antigo, com novos capítulos acessíveis. A construção de decks respeita três cópias mesmo nos catálogos menores; faltando unidades para substituir o líder, usa feitiços regionais implementados.

A lista de destinos pode ser deslizada, o mapa revela o destino selecionado e os botões mantêm foco após a atualização. Verificação amplia `tests/campaign.test.cjs`, `tests/campaign-browser.cjs` e `tests/pwa.cjs`, incluindo emblemas e os dez capítulos no primeiro acesso offline em Chromium e WebKit. O contrato abaixo registra a primeira versão e permanece aplicável à progressão.

## Contrato da primeira versão

- Qualquer uma das três regiões pode ser visitada no nível 1. A sequência de encontros é local à região; caminhos alternativos convergem em uma elite e um chefe. Há um encontro opcional e um desafio após o chefe por região.
- XP é concedido somente na primeira vitória em cada encontro. O nível deriva das conclusões, com 100 XP por nível. Maestria mede encontros concluídos; derrotas e replays nunca apagam conquistas.
- Recompensas permanentes: XP, maestria e títulos regionais. Não bloquear cartas existentes nem conceder atributos globais ao jogador. Melhorias mecânicas podem ser acrescentadas em outra entrega após balanceamento.
- Encontros usam somente cartas automatizadas e decks legais de 40 cartas. Chefes têm uma regra inicial explícita (carta de campeão na mão e/ou mana de feitiço), salva com o duelo. Não mudar as regras do duelo normal.
- Partida da campanha usa o salvamento de duelo existente, com metadados do encontro. Abrir o mapa não substitui um duelo; iniciar outro encontro informa quando há partida em andamento e exige uma escolha concreta.
- Progresso em chave separada, validado ao carregar e com exportação/importação JSON. Erros de armazenamento ficam visíveis; conclusão registrada antes da apresentação de vitória, para suportar recarregamento.
- Mapa: textura e posições do mapa oficial da Riot, preservadas localmente para uso offline; outras regiões aparecem como capítulos ainda indisponíveis, sem encontros fictícios.

## Estrutura e ordem

1. `campaign-data.js`: regiões, encontros, decks e regras iniciais.
2. `campaign.js`: validação, desbloqueios, XP, maestria, resultados e preparação do duelo; módulo puro compatível com Node e navegador.
3. `campaign-ui.js` / `campaign.css`: atlas, detalhes, seleção de deck, backups e navegação.
4. `app.js` / `index.html`: entrada da campanha, retorno ao mapa, salvamento e resultado.

Interface segue os tokens existentes (azul petróleo, dourado, Beaufort). Mapa ocupa a área principal; painel lateral exibe região, encontros e ação. Em telas estreitas, painel abaixo do mapa. Botões nativos, foco visível, diálogo nativo, movimento reduzido e alvos de toque de 44 px.

## Verificação

Na campanha, os dois lados da arena seguem a região geográfica do encontro, independentemente dos decks ou da preferência do duelo livre. A regra é reaplicada ao retomar salvamentos antigos. Piltover/Zaun usa Piltover; Ixtal usa a floresta existente (`rift`) enquanto não houver arte própria. A preferência do duelo livre permanece salva. `node tests/campaign-arena.cjs` verifica as dez regiões, imagens offline, retomada antiga e preservação da escolha manual fora da campanha.

`node --test tests/campaign.test.cjs` para desbloqueios, recompensas idempotentes, entradas corrompidas, derrota, decks e conclusão de duelos pelo bot.

`node --test tests/*.test.cjs` para regressão do motor. `node tests/campaign-browser.cjs` com Playwright do runtime e Chrome isolado para fluxo offline, retomada, resultado, backups e layouts. `python tools/build_pwa.py` após alterações de recursos.

Sem dependências novas, alterações de biblioteca de decks ou publicação externa. Código em JavaScript IIFE como os módulos existentes, dados declarativos e testes em `tests/`.
