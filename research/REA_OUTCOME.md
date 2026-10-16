# Fim de duelo com recursos originais do LoR

Pedido: substituir a apresentação desenhada no protótipo pela animação do LoR real.

## Recursos recuperados

Os contêineres do cliente PC de 2026-10-15 contêm o rig `Victory_Banner_RG`, o rig `Defeat_Banner_RG`, texturas de vitória/derrota/empate, a animação `Victory_Banner` e timelines de ativação. O mesmo clipe de 0,600000143 segundo é referenciado pelos três resultados. A timeline inicia o banner aos 2,35 segundos em vitória/empate e aos 1,85 segundos na derrota.

As rupturas usam os clipes `Take 001`, com 2,366666794 segundos: 54 fragmentos para o Nexus vermelho e 65 para o azul. Cada fragmento conserva malha, UV, transformação e textura original.

`native-outcome-data.js` contém as geometrias dos banners, bindings rígidos dos ossos e matrizes amostradas das curvas cúbicas da Unity. Também inclui o cristal e seus suportes, separados no prefab. `native-nexus-end-data.js` contém as geometrias dos fragmentos e suas matrizes. Dados numéricos são Float32 em base64; não são vídeos gravados nem curvas de easing inventadas. IDs, hashes dos bundles/texturas e tempos ficam em `native-outcome-sources.json` e `native-nexus-end-sources.json`.

`native-outcome.js` projeta os modelos em WebGL. A fragmentação de 54/65 partes é deformada na CPU para não exceder o limite de uniforms de aparelhos móveis. O banner usa seis matrizes na GPU. Os loops terminam ao final dos clipes; pular, sair, desligar efeitos, movimento reduzido e ocultar a página cancelam o trabalho e liberam os contextos. Sem WebGL, o banner utiliza um PNG renderizado da pose final do próprio modelo original.

## Limites de fidelidade

Esta implementação reutiliza as animações e os recursos originais, mas não executa o runtime Unity. A câmera é ajustada ao layout web, o material é projetado sem o cubemap/HDR original e os shaders de erosão, iluminação e sistemas de partículas Unity não foram reproduzidos. Texto, controles e apresentação de recompensas pertencem ao protótipo. Portanto, os movimentos importados são originais, mas o resultado completo não deve ser descrito como reprodução visual 100% idêntica ao cliente.

A ferramenta REA não estava conectada. `rea doctor --client codex --json` identificou registro ausente/desatualizado; nenhuma configuração foi alterada. A inspeção e extração foram feitas por UnityPy sobre os arquivos locais com hashes verificados, não por uma nova sessão de evidência REA.

## Reprodução

Na raiz do acervo, execute `scripts_reproducao/extract_outcome.py`. Na pasta do jogo, execute `tools/import_native_outcome.py`, `tools/import_native_nexus_end.py` e `node tools/bake-native-outcome.cjs`. Os importadores usam as bibliotecas UnityPy/NumPy e o decodificador de curvas já existentes no acervo. O jogo publicado não depende dessas ferramentas.

Verificação: `node --test tests/native-outcome.test.cjs` valida IDs, durações, integridade das texturas, fragmentos e bindings. `node tests/result-screen.cjs` verifica o uso efetivo dos clipes no navegador, resultados, cancelamentos, quatro layouts e fallback sem WebGL. `node tests/campaign-progression.cjs` verifica a integração com recompensas e retorno ao mapa.
