# Referência em vídeo e animações da v0.12

Fonte enviada pelo usuário: `C:/Users/Usuario/Videos/2026-10-15 11-02-24.mp4`. Duração lida pelo decodificador do Chrome: 386,216667 segundos; resolução: 2560 × 1440. Identidade do arquivo e observações em `video-reference.json`. O vídeo pessoal e seus quadros de análise não são distribuídos no ZIP.

Foram inspecionados quadros gerais em 5, 30, 60, 90, 120, 180, 240 e 300 segundos e amostras próximas de 31–38,6 e 58–63,4 segundos. Os quadros mostram diferenças importantes entre cartas verticais na reserva e horizontais no combate, destaque azul na defesa, destaque quente na preparação do ataque, botão circular azul/cinza, cristais com volume e valores flutuantes de dano/cura. A passagem de 37,2–38,6 s mostra a confirmação e o resultado de um combate, com alteração dos Nexus. A amostragem não determina a curva exata nem a duração total de cada golpe.

## Implementação

`combat-motion.js` reconstrói preparação, interceptação do bloqueador, colisão, breve pausa no contato, recuo, fragmentação de mortos e retorno dos sobreviventes. Usa os pares e os resultados emitidos pelo motor, sem recalcular regras. Golpes abertos usam um rastro até o Nexus e atrasam o número exibido até a chegada. Sobrepujar e bloqueios preservados após a morte do defensor seguem os resultados do motor. Os tempos adaptados estão em `lor-motion-profile.js`, separados dos campos históricos extraídos; não são apresentados como medições exatas do vídeo.

`arena-chrome.js` anima as mudanças do botão, token, mana e decks. O bot compra somente um verso: a apresentação não revela sua carta. `video-motion.css` adiciona luz de contato e acabamento dos marcadores durante o movimento.

`nexus-view.js` renderiza duas malhas originais com suas texturas atuais em WebGL. `tools/import_nexus_models.py` lê os OBJ/PNG extraídos anteriormente com UnityPy da instalação atual, triangula as faces, normaliza a escala e embute os dados em `nexus-data.js` para funcionar por `file://`. Fontes e SHA-256 em `assets/arenas/nexus-sources.json`: cristal azul com 878 triângulos; vermelho com 864. A iluminação, escala, orientação e os movimentos são adaptações locais; os shaders Unity não são executados. Dois canvases persistentes são reutilizados quando o campo é atualizado; a renderização pausa no menu, página oculta e movimento reduzido. Sem WebGL, os cristais CSS são mantidos.

## Evidência e limites

A skill REA orientou a investigação anterior dos recursos do cliente. O REA verificou identidade/inventário do snapshot, enquanto UnityPy realizou a extração Unity; a análise deste vídeo utilizou o decodificador do Chrome e inspeção visual. Não foi feita decompilação de vídeo nem recuperação automática das curvas do cliente. O tabuleiro continua composto em 2D; os cristais são modelos 3D isolados. Áudio e regras não foram ampliados nesta entrega.

`tests/video-motion.cjs` verifica em Chrome offline os dois sentidos do combate, deslocamento de atacante e bloqueador, vida do Nexus antes da chegada do rastro, retorno, desenho real dos dois modelos, reutilização dos canvases, cancelamento no menu e movimento reduzido. Capturas e demonstração geradas ficam em `test-results/`; são evidência do protótipo, separadas da gravação original.

## Correção do enquadramento — v0.15

A comparação visual com `ref-30.png` identificou que o yaw positivo forte da v0.14 expunha a haste traseira, enquanto o vídeo mostra a face da gema à esquerda e o suporte atrás. O yaw agora é negativo e moderado, com projeção XY uniforme e canvas quadrado. A orientação não oscila nem muda ao receber dano. `tests/video-motion.cjs` mede a proporção e o preenchimento da silhueta renderizada para impedir o retorno da forma alongada. Captura local: `test-results/nexus-v15.png`.
