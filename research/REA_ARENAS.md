# Arenas — fontes observadas e reconstrução da v0.11

Pedido: aproximar o duelo das cinco capturas do LoR fornecidas pelo usuário e oferecer arenas ligadas ao deck. As capturas mostram bases de pedra, área central para combate, Nexus à esquerda, ação circular azul/cinza à direita, marcadores verticais na reserva e horizontais no combate. Elas não estabelecem curvas ou durações de animação.

## Investigação

Foi aplicada a skill `C:/Users/Usuario/Skills/reverse-engineer-anything/SKILL.md`. A CLI REA 6.5.0 estava disponível via `npx -y rea-agents@latest`. O diagnóstico encontrou ausência de registro MCP e providers de decompilação; a investigação seguiu pela CLI e pelos exports locais existentes, sem alterar configuração ou iniciar/anexar ao cliente original.

O snapshot `arena-source-snapshot.zip` contém 11 PNGs originais e o manifesto de origem. SHA-256 do snapshot: **8138005d36d2d115941c336cb1ff2e2c4a2226f2d385bcda5ea3466d545dece4**. REA `inspect-artifact` verificou o inventário ZIP com o provider `rea-artifact-graph`. Evidence: **ev_a11dd5d9585cec43990002728f97a4e13e14a1a2a6afcdfc3a8c28958a555f5f**. Resultado completo em `rea-arena-inventory.json`.

Essa Evidence comprova identidade e inventário do snapshot. A classificação visual e as coordenadas de atlas foram feitas por inspeção das imagens exportadas com ferramentas locais; não são resultado de decompilação REA. A skill orientou a investigação, e os hashes ligam os recursos copiados ao acervo histórico.

## Recursos usados

Todos os caminhos abaixo são relativos a `communitydragon_historico/arquivos/assets/assetlibrary/` no acervo pai. Os PNGs foram copiados sem alteração. O manifesto `assets/arenas/sources.json` registra caminho completo relativo ao acervo, dimensões e SHA-256 de cada arquivo.

| Recurso | Fonte | Dimensões |
|---|---|---|
| Floresta | playmats/summonersrift/models/SummonersRift_TX_Color.png | 2048 × 2048 |
| Demacia | playmats/demacia/models/Demacia_Playmat_TX_Color.png | 2048 × 2048 |
| Noxus | playmats/noxus/models/Noxus_Playmat_TX_Color.png | 2048 × 2048 |
| Ionia | playmats/ionia/models/Ionia_TX_Color.png | 2048 × 2048 |
| Freljord | playmats/freljord/models/Freljord_TX_Color.png | 2048 × 2048 |
| Piltover | playmats/piltover/models/Piltover_Playmat_TX_Color.png | 2048 × 2048 |
| Águas de Sentina | playmats/bilgewater/models/Bilgewater_TX_Color.png | 2048 × 2048 |
| Ilhas das Sombras | playmats/shadowisles/models/ShawdowIsles_TX_Color.png | 2048 × 2048 |
| Botão azul/verde/cinza | playmats/summonersrift/materials/textures/bigbutton/OneButton_Albedo_nomip.png | 512 × 512 |
| Atlas de interface de referência | playmats/neutral_playmat/models/Playmat_Neutral_UI_Color.png | 1024 × 1024 |
| Verso de carta | cardbacks/textures/Summuners_rift_card_back_crispMip.png | 256 × 512 |

Os ícones `collection_board_*` também foram examinados: são prévias de coleção que já contêm elementos de interface. A implementação usa os atlas de modelos, com a parte plana do piso projetada por CSS e duplicada verticalmente para os dois lados. Coordenadas adaptadas por arena ficam em `arena-view.js`. Elas não representam UVs ou câmeras originais recuperadas.

## Decisões de implementação

- Oito opções de arena, prévia no menu, preferência persistida e tema preservado no salvamento. O modo automático decide cada metade pelo campeão principal e, em seguida, região predominante; a seleção manual aplica o mesmo tema aos dois lados. Regiões sem textura nesta seleção usam Floresta.
- Reserva vertical e combate horizontal, pares alinhados por número e posição. Animação de avanço/retorno de 260 ms é uma escolha de reconstrução, respeitando movimento reduzido e efeitos desligados.
- O azul/cinza do botão e o verso são recursos originais. Moldura do botão, Nexus facetados e luzes são SVG/CSS reconstruídos. Não foram extraídas malhas, shaders ou scripts de cena Unity para execução no navegador.
- Conflito de hover/foco/seleção corrigido: essas regras antigas substituíam `transform`, removendo o deslocamento de combate e fazendo o clique atingir outro ponto. O campo preserva a transformação e calcula as linhas depois da disposição das cartas. Redimensionar atualiza as linhas.

## Validação e limites

Testes verificam fontes sem alteração por SHA-256, seleção automática/manual e oito temas. Chrome offline verificou seis bloqueios pela interface, hover estável, alinhamento dos pares, retomada e cinco larguras. As capturas em `test-results` são do protótipo. Testes existentes de campeão, duelo, animações, resposta de feitiços, Oráculo, Elixir, música e editor continuaram passando.

O acervo é histórico (2020); as capturas fornecidas são referência visual atual. O resultado aproxima a disposição e usa recursos originais disponíveis, mas não recupera a cena 3D atual nem comprova equivalência de animações ou pixels com o cliente atual. Uma textura de modelo sem sua malha não recupera a geometria.
