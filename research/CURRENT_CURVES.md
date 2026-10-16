# Curvas do cliente atualizado — aplicação no navegador

## Evidência e escopo

Fonte: as 24 exportações `AnimationClip` já extraídas de `assets_extraidos_atualizados_2026-10-15/combat/`. O índice original associa cada JSON e binário ao caminho Unity, pacote `.bbq` e SHA-256. O importador confere novamente os hashes antes de gerar qualquer recurso.

`current-motion-inventory.json` registra os 24 clipes com SHA do JSON, SHA e caminho do pacote, quantidade de bindings/canais, `m_StartTime`, `m_StopTime` e taxa de amostragem. A leitura local por formato é separada da análise de inventário REA anterior. Não executei o cliente Unity e não atribuo a REA a decodificação destas curvas.

**Resultado observado:** todos os 24 clipes têm canais recuperáveis, e todos foram decodificados e validados quanto a valores finitos. Cinco clipes, com 133 transformações, foram exportados para uso browser:

| Recurso | Transformações | Intervalo do próprio AnimationClip |
| --- | ---: | ---: |
| Bloqueio, `CobmatBlock_AN_Card` | 3 | 0–0,300000012 s |
| Revelação, `unit-summon-reveal_GEO` | 1 | 0–0,500000000 s |
| Criação, `CardCreation_Crystals` | 29 | 0–0,800000072 s |
| Morte comum, primeira variação de pilha | 42 | 0–0,700000048 s |
| Morte de campeão genérica | 58 | 0–3,700000286 s |

Esses intervalos vêm de `m_MuscleClip.m_StartTime/m_StopTime`, e **não** de `m_FixedDuration`. São durações internas de clipes, sem provar a duração da ação completa vista no jogo, que pode combinar timelines, atrasos, curvas e outros componentes.

## Recuperação

1. `m_StreamedClip.data` contém palavras uint32 little-endian: tempo float32, contagem de chaves, índice e quatro coeficientes float32 por chave.
2. Cada segmento é avaliado como `((a*dt+b)*dt+c)*dt+d`, com `dt = tempo - tempo_da_chave`. Os quadros sentinela em infinito não viram amostras reproduzidas.
3. `m_DenseClip.m_SampleArray` contém escalares em ordem quadro/canal. O importador usa início, taxa e contagem para interpolação linear.
4. Os canais constantes são concatenados depois de streamed e dense. O total precisa coincidir com as dimensões dos bindings: Transform posição/escala/Euler 3, quaternion 4, propriedades escalares 1.
5. Os Avatares exportados fornecem `m_TOS`. Assim, os caminhos de bloqueio e fragmentos têm nomes recuperados, em vez de nomes inventados a partir dos hashes.
6. São preservados os tempos nativos das chaves e amostragem adicional de 60 Hz. Os frames WAAPI lineares são uma aproximação amostrada do polinômio, não uma nova curva de easing escolhida visualmente.

## API de integração

Carregar `current-motion-data.js` e `current-motion.js` antes de `motion-v3.js`/`combat-motion.js`.

O módulo apenas retorna quadros, sem iniciar animações nem timers. Usar o helper `animate()` existente mantém cancelamento, efeitos desligados e movimento reduzido sob responsabilidade do fluxo atual.

- `CurrentMotion.blockFrames(width, baseTransform = "")`: recuo alternado real do osso `Export/Bones/Root`. A amplitude é adaptada para 4,5% da largura; usar durante o contato do bloqueador ou no momento de confirmar o bloqueio. `CurrentMotion.duration("block")` retorna cerca de 300 ms.
- `CurrentMotion.revealFrames(width, height)`: movimento e escala da malha de revelação, com Z nativo convertido em elevação 2D. A orientação da malha Unity sobre o plano do tabuleiro não é aplicada ao retrato DOM. Inserir no período em que a carta ampliada já está centralizada, antes de viajar ao campo/mão.
- `CurrentMotion.shardFrames("death", i, width, height, count = 5)`: trajetória e quaternion reais de fragmentos comuns. `i` seleciona um fragmento distribuído no conjunto original; `count` é a quantidade de recortes DOM. Usar nos elementos `.fx-shard` dentro de `fragment()`.
- `CurrentMotion.shardFrames("championDeath", i, width, height, count)`: equivalente para o conjunto nativo de 58 fragmentos do campeão. A duração de 3,7 s pode ser encurtada explicitamente para a apresentação browser.
- `CurrentMotion.shardFrames("creation", i, width, height, count)`: fragmentos convergem às posições finais de criação. Pode ser usado em recortes da imagem ampliada antes da carta aparecer inteira.
- `CurrentMotion.duration(kind)`: duração em milissegundos do próprio clipe.
- `CurrentMotion.source(kind)`: caminho da exportação identificada pelo inventário.

Exemplo, dentro de `fragment()`:

```js
const frames = window.CurrentMotion
  ? CurrentMotion.shardFrames("death", i, item.rect.width, item.rect.height, clips.length)
  : legacyFrames;
return animate(p, frames, T.deathMs, i * 10, "linear").finally(() => p.remove());
```

Não aplicar easing global cúbico às curvas recuperadas: usar `"linear"` para preservar o tempo das amostras. Se a duração for comprimida, a mudança é uma adaptação declarada.

## Limites da reconstrução

As trajetórias e rotações dos fragmentos são reais, mas os polígonos de recorte, projeção perspectiva, conversão de unidades, amplitude, opacidade e duração escolhida pelo jogo offline continuam sendo adaptações. Não há reprodução completa da timeline, luzes, materiais, partículas ou renderizador Unity. Os recortes DOM não são as 42/58 malhas originais.

Os 19 clipes restantes foram decodificados para verificar cobertura e registrados no inventário, porém não foram incluídos no runtime. Isso evita carregar variações redundantes de morte e timelines auxiliares sem uma correspondência validada para seus objetos no DOM.

## Reprodução e validação

```powershell
& C:/Users/Usuario/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe jogo_offline/tools/import_current_motion.py
& C:/Users/Usuario/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe jogo_offline/tests/current_motion_import_test.py
node jogo_offline/tests/current-motion.cjs
$env:NODE_PATH='C:/Users/Usuario/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'
node jogo_offline/tests/current-motion-browser.cjs
```

Os testes Python verificam um polinômio conhecido e canais dense/constantes independentes da apresentação. O teste Node confere os 24 hashes, durações reais, contagem de fragmentos, o recuo alternado do bloqueio, diferentes trajetórias de fragmentos e ausência de valores inválidos nos quadros browser. O teste no Chrome real isolado confirma que os cinco adaptadores são aceitos por WAAPI, produzem matrizes finitas e permitem cancelamento limpo; carregar os módulos não inicia animações em contexto de movimento reduzido. O teste visual integrado permanece responsabilidade dos hooks no fluxo principal.
