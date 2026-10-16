# Nexus — revisão visual v0.24

O recorte enviado pelo usuário foi comparado ao quadro de 30 s da gravação local já registrada em `video-reference.json` (`test-results/ref-30.png`). A referência mostra cristal orientado à esquerda, suporte dourado atrás e uma base curta de vida. Na apresentação anterior, a vista quase frontal e a placa longa deixavam o conjunto semelhante a um ícone sobre um botão.

## Recursos preservados

Continuam sendo usadas as malhas `blue_crystal_-6176179175671571015.obj` e `Red_crystal_479733317668410737.obj`, com suas texturas BlueCrystal/RedCrystal. Identidades e hashes permanecem em `assets/arenas/nexus-sources.json`. Os arquivos fontes estão em `../assets_extraidos_atualizados_2026-10-15/arenas/summonersrift/`. Não foi necessário abrir outra sessão REA: os recursos e a referência já estavam disponíveis.

## Adaptações da apresentação

- Câmera ortográfica com yaw -0,56 rad no azul e -0,44 rad no vermelho. O shader oculta a porção da haste traseira abaixo de -0,55 em coordenadas normalizadas: na referência, essa parte fica escondida pelo conjunto de suporte/vida. O arquivo da malha não foi alterado.
- Iluminação e correção de cor próprias para leitura dos cristais; não são o shader Unity original nem uma reprodução numericamente idêntica da captura.
- `nexus-hud.css` compõe o cristal e um número legível sobre `assets/arenas/nexus-health-frame.svg`. A moldura é SVG próprio baseado na referência, não um recurso extraído do cliente. O centro do divisor usa tons de latão mais escuros.
- Dois canvases persistentes continuam sendo reutilizados a cada atualização. O movimento reduzido preserva a apresentação estática.
- `nexus-fallback-data.js` incorpora dois PNGs do mesmo renderizador. Esses recursos aparecem sem WebGL e após perda de contexto, e fornecem os pixels da fragmentação no encerramento.

## Reprodução

Com Playwright e Chrome disponíveis, executar `node tools/render_nexus_fallbacks.cjs` sempre que `nexus-view.js` ou os dados da malha mudarem. A ferramenta grava os PNGs em `assets/arenas/nexus/`, incorpora as imagens no script offline e mantém SHA-256 do renderizador, das malhas/fontes e dos resultados em `assets/arenas/nexus/sources.json`.

## Validação

`tests/nexus-hud.cjs` falhou com a base anterior e passou com a revisão. Verifica tamanho compacto, números reais, nome acessível, ausência de sobreposição com o nome do jogador, desktop/celular, reutilização dos canvases, fallback sem GPU, perda de contexto e fragmentação com pixels do recurso nativo. Capturas e medidas em `test-results/nexus-v24*`.

`tests/video-motion.cjs` mantém a exigência anterior de silhueta compacta e preenchimento superior a 58%, além de verificar ataque, defesa, dano, cancelamento e movimento reduzido. `tests/duel-outcome.cjs` cobre vitória/derrota reais, empate, dimensões e interrupções. Os 32 testes de regras/composição também passaram.

O detector mecânico da Impeccable não pôde ser executado: a instalação da skill não contém `scripts/detector/engines/browser/detect-url.mjs`. A revisão usou inspeção das capturas, medidas e testes no Chrome offline. Não houve reparo ou alteração na instalação da skill.
