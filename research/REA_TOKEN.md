# Marcador de ataque e defesa — recursos e curvas recuperados

O pedido foi substituir o escudo genérico mostrado na captura pelo visual e movimento encontrados no cliente LoR preservado no acervo. A implementação usa malhas e textura atuais, cinco AnimationClips e a folha original de chamas. O cliente Riot não foi executado ou anexado nesta investigação.

## Evidência REA

Foi usada a skill `C:/Users/Usuario/Skills/reverse-engineer-anything/SKILL.md` e a CLI REA 6.5.0. O diagnóstico identificou ausência de registro MCP e de engines nativas nesta sessão. A investigação prosseguiu pela CLI, sem alterar a configuração do usuário ou instalar engines.

`inspect-artifact` verificou o snapshot ZIP dos exports e seu inventário. Evidence: **ev_9d7cdbcab755bcb4cd2e28b40b27f53c4b2a247c5e1ed07e3924b29f39c7797d**. Snapshot SHA-256: **bcea0160bc197407560b7f4c962ac77cfab50b99ecf933e7efe28ec483b8cc05**. Resultado completo: `rea-token-inventory.json`.

Essa Evidence estabelece identidade e inventário do snapshot. A leitura Unity, a resolução de referências, a decodificação das curvas e a renderização foram feitas pelos parsers e scripts locais, não pelo REA. Os exports preservam binários brutos, JSONs, OBJ e PNG. `assets/arenas/token/sources.json` vincula cada recurso distribuído aos hashes dos exports, pacote e caminho Unity.

## Recursos observados

O índice local identificou os grupos `Neutral_Playmat/AttackToken` e `Neutral_Playmat/InitiativeToken`. `scripts_reproducao/extract_attack_token.py` confere os hashes dos oito pacotes selecionados e recupera os objetos e suas dependências locais. O snapshot contém 809 objetos exportados; isso não significa que todos sejam usados no navegador.

Os recursos usados incluem o medalhão `InitiativeToken_MD_mesh`, a espada `AttackToken_MD`, cinco malhas `AttackToken_Fracture_001..005` e a textura `Initiative_Attack_Token_Color_TX_crispmip`. São sete sprites renderizados a partir das malhas, com as UVs originais. O medalhão é a moeda de iniciativa, independente do token de ataque: a primeira implementação o usava incorretamente como defesa. A correção, o escudo e a passagem entre os encaixes da moldura estão documentados em `REA_INITIATIVE.md`.

O FSM de `AttackTokenRoot`, objeto `-4423452921449445539` do pacote `2b/4f2adf1fb53b93fd68946b7ce147f2.bbq`, contém os estados `Available`, `DeclaringAttack`, `AttackComitted`, `Unavailable`, `Rally` e os triggers `Idle` e `Punch`. Isso estabelece as relações serializadas entre estados e movimentos, sem comprovar a apresentação completa do cliente em execução.

## Curvas aplicadas

| Movimento | Intervalo do AnimationClip | Aplicação |
|---|---:|---|
| Idle | 2,000 s | Espera da espada enquanto existe token de ataque |
| Punch | 0,800 s | Entrada na preparação de ataque |
| Ignite | 0,267 s | Conclusão da montagem da espada |
| Ativação | 1,117 s | Cinco fragmentos convergindo, mais trajetória do conjunto |
| Indisponível | 0,417 s | Cinco fragmentos se dispersando ao gastar o token |

`tools/import_attack_token.py` reutiliza o decodificador de coeficientes cúbicos streamed/dense e preserva tempos de chave mais amostras de 60 Hz. Paths dos ossos vêm dos Avatares; paths das timelines são resolvidos por CRC32 contra a hierarquia de Transforms exportada. Todos os canais selecionados têm paths resolvidos e valores finitos. WAAPI usa interpolação linear entre amostras, sem um easing global adicional. As durações acima são dos próprios clipes; não são medidas de uma partida do cliente.

O ângulo de 50 graus está serializado no canal `Position` das timelines de declaração e indisponibilidade. A inversão X do OBJ e a orientação Y do DOM são compensadas na projeção.

A folha de chamas tem 36 quadros, confirmados pelo `UVModule` 6 × 6 do ParticleSystem `-4423452921485605215`. O lifetime nativo varia entre 0,75 e 1,25 s. O navegador usa um ciclo determinístico de 1 s, no meio desse intervalo. A máscara original é copiada sem alteração de bytes; cor, opacidade e posicionamento são adaptados.

## Limites e integração

O navegador não executa shaders, iluminação, o simulador de partículas Unity ou o FSM original. Usa projeção ortográfica dos meshes em PNG e anima seus transforms no DOM. A erosão do material é substituída por opacidade, e as chamas são um único flipbook, sem reproduzir a emissão aleatória completa. A camada visual distingue ataque disponível, preparação, defesa e token consumido; as regras, cliques e salvamentos continuam no motor existente.

As animações param ao desligar efeitos, ativar movimento reduzido, ocultar a página, terminar o duelo ou voltar ao menu. As imagens continuam visíveis sem WebGL no runtime; WebGL só é necessário na ferramenta de bake.

## Reprodução e validação

1. Python 3.12 com UnityPy local: `scripts_reproducao/extract_attack_token.py`.
2. `python jogo_offline/tools/import_attack_token.py`.
3. Com Playwright e Chrome: `node jogo_offline/tools/render_attack_token.cjs`.
4. `node jogo_offline/tests/attack-token.cjs` verifica hashes, curvas, montagem, espera, preparação e consumo por cliques reais, cancelamento, efeitos desligados, movimento reduzido e quatro larguras offline.
5. `node jogo_offline/tools/preview_attack_token.cjs` grava uma prévia ampliada e isolada com o mesmo módulo de produção. Ela não é uma gravação do cliente Riot.

Também passaram os 54 testes unitários existentes e `tests/click-hud.cjs`, que cobre ataques, bloqueios, confirmação, mana e layout.
