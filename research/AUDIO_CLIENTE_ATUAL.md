# Áudio dos downloads locais de 15/10/2026

Foram integrados arquivos OGG próprios para o navegador, recuperados dos pacotes locais preservados. Não é mais necessário usar a música do patcher como única opção.

O conjunto tem **12 arranjos regionais**, totalizando aproximadamente **136 minutos**, e **11 efeitos**, em cerca de **108,5 MB**. A faixa corresponde à arena do jogador: Summoner's Rift, Demacia, Noxus, Ionia, Freljord, Piltover, Águas de Sentina, Ilhas das Sombras, Shurima, Targon, Bandópolis e Zaun.

## Evidências da identificação

1. O parser lê os índices AKPK de `stage0.pck`, `stage1.pck` e dos dois pacotes de português. Valida limites e mantém SHA-256 do pacote e de cada registro. Foram inventariados **530 bancos, 10.518 registros de mídia e 20.677 registros externos**. Isso não significa 31.725 sons diferentes.
2. Os nomes das arenas vêm de `Assets/AssetLibrary/PlaymatProfiles/*_PlaymatProfile.asset`, dentro dos bundles Unity atuais. Cada perfil fornece o evento real `AudioEventOnInitialization`, por exemplo `Play_HUD_Demacia`.
3. O hash FNV-1 desse nome encontra o objeto Event no banco Wwise. Sua ação SetState seleciona um valor do grupo **1830552893**. Demacia seleciona **1148685586**, Freljord **378437374**, Noxus **1320912697** etc. Nenhuma faixa recebeu nome regional por semelhança auditiva.
4. O evento `Play_GameMusic` (**3586746077**, nome recuperado de um componente Unity em `alwaysloaded.bbq`) leva à árvore musical nos bancos **3051094379 / 3051094378**. O wwiser gera o arranjo TXTP correspondente ao estado regional. Foi escolhido o ramo regional **3075839197=733168346**; o nome semântico original desse estado não foi recuperado. O manifesto retém essa decisão e as referências de mídia.
5. O vgmstream decodifica o TXTP, incluindo a sequência/camadas suportadas. O FFmpeg converte o WAV para Vorbis OGG. São gravados hashes do TXTP, do OGG e das mídias fontes; os WAVs de trabalho permanecem fora do jogo distribuído.

O manifesto completo está em `assets/audio/current/sources.json`; o índice dos pacotes e os arquivos de trabalho ficam em `../pesquisa/revisao_downloads_2026-10-15/audio-work/`.

## Efeitos disponíveis

| Chave | Evento comprovado no cliente |
| --- | --- |
| `draw` | `Play_CARD_draw_to_center_player` |
| `draw-enemy` | `Play_CARD_draw_to_center_opponent` |
| `summon-enemy` | `Play_CARD_summon_reveal_center_opponent` |
| `turn` | `Play_UI_your_turn` |
| `mana` | `Play_UI_mana_consume` |
| `spell-mana` | `Play_UI_mana_spell_mana_consume` |
| `barrier` | `Play_KW_barrier_activate` |
| `button` | `Play_UI_client_gold_button_select` |
| `attack-token` | `Play_UI_attack_token_flare` |
| `hit` | `Play_IMP_damage_unit_hit` |
| `nexus-hit` | `Play_IMP_damage_face_hit` |

### Impactos de combate — v0.23

Os dois eventos foram encontrados no bundle atual `cb/9f5a0d803b34877418924fbb1ffb9d.bbq`. O componente Unity de unidade tem path ID `1077337870943468925`; os de Nexus, `-486834847455794929` e `9210847983490067918`. Hashes do bundle e bytes dos componentes estão em `sources.json`. FNV-1 resolve os nomes para os eventos **325857231** e **4103507610** no banco **3290525096**.

O TXTP preserva o ramo selecionado de três variantes de impacto e uma camada compartilhada de mídia **148152740**, atrasada 100 ms na unidade e 50 ms no Nexus. Exportou-se uma variante fixa por evento, com suas camadas, sem recriar a aleatoriedade do Wwise no navegador. Durações: **1,865 s** e **2,333 s**; picos decodificados do OGG próximos de **-5,7 / -5,9 dB**, com ganho de exportação registrado. A reprodução no duelo usa volume 0,6 e respeita o botão Som, inicialmente desligado.

`combat-motion.js` dispara unidade no contato com bloqueador real e Nexus após a chegada do projétil, incluindo o segundo impacto de Sobrepujar. Bloqueador removido não dispara nenhum dos dois. Cancelar a animação interrompe apenas vozes de impacto; desligar Som interrompe todos os efeitos. O modo de movimento reduzido preserva o comportamento anterior, sem sequência sonora de colisão.

**Papel do REA:** a CLI 6.5.0 recusou o AKPK `.pck` como formato não suportado. A extração foi feita pelo parser AKPK, UnityPy, wwiser e vgmstream. Depois, o REA inventariou um ZIP com 14 membros: bundle, banco, sete mídias WEM, dois TXTP, dois OGG e proveniência. A evidência `rea-combat-audio.json`, ID `ev_eb5196bbc6be2544db04617923872518c3cfde35c26c34b7a6f2d0799f169f31`, registra identidades e hashes; não demonstra semântica ou reprodução do som. SHA-256 do ZIP: `b3bc03f9bcc81cf9d23152b4ae91f72ca55f0bb9e4cd85efe05f1adadd4f3a13`. O ZIP permanece em `../pesquisa/revisao_downloads_2026-10-15/audio-work/hit-source-snapshot.zip`.

Reprodução da evidência: `../scripts_reproducao/inspect_combat_audio.py --rea-launcher CAMINHO/rea-agents/scripts/rea.mjs`, depois de executar a importação de áudio. `tests/combat-audio.cjs` falhou antes da integração e passou depois no Chrome offline, com avanço real do áudio, sincronização nos dois sentidos, Sobrepujar, bloqueador removido, mute, cancelamento e movimento reduzido.

Esses nomes estão em componentes do bundle `2b/4f2adf1fb53b93fd68946b7ce147f2.bbq` e/ou `alwaysloaded.bbq`. A identidade das referências Unity e dos bancos está no manifesto. Os efeitos receberam ganho estático para um pico máximo próximo de -6 dB; a correção `web_gain_db` está registrada por arquivo. O controle do jogador continua determinando o volume final.

## Módulo para integração

Carregar `regional-audio-data.js`, `native-sounds-data.js` e `regional-audio.js` antes do código que os utiliza.

- `RegionalAudio.select(theme, audioElement)`: seleciona a trilha e carrega metadados. Não inicia a reprodução; isso preserva o fluxo de ativação/pausa e a política de gesto do navegador.
- `RegionalAudio.sound(key, volume)`: tenta reproduzir um efeito e retorna uma Promise booleana.
- `RegionalAudio.enabled = false` e `RegionalAudio.stop()`: interrompem todas as vozes do módulo. `RegionalAudio.stop(["hit", "nexus-hit"])` interrompe apenas as chaves indicadas. Há limite de seis vozes simultâneas e interrupção quando a página fica oculta.
- `RegionalAudio.themes` e `RegionalAudio.activeSounds`: diagnóstico.

## Reprodução e validação

O script `../scripts_reproducao/import_current_audio.py` aceita `--vgmstream`, `--ffmpeg` e `--wwiser` com caminhos locais. `--skip-music` mantém faixas já importadas e reconstrói apenas as ausentes e o conjunto pequeno de efeitos. Não faz downloads nem altera a instalação original.

Foi usado o [wwiser oficial](https://github.com/bnnm/wwiser), commit `08e937b649bc7007c234bbd59e34a41d5eef3b38`, versão exibida `v20260808`, com os [TXTP do vgmstream](https://github.com/vgmstream/vgmstream). O pacote de origem do wwiser e seu SHA-256 estão preservados em `../pesquisa/revisao_downloads_2026-10-15/audio-tools/source.json`. Vgmstream portátil já existente e FFmpeg 7.1 portátil local; os hashes dos executáveis usados constam no manifesto.

`node tests/current-audio.cjs` valida os 23 hashes, abre as 12 faixas e os 11 efeitos via `file://` no Chrome, compara as durações decodificadas e verifica reprodução por gesto, mute e limpeza. A medição independente do FFmpeg confirmou sinal não silencioso nas faixas regionais (primeiros 30 segundos) e nos dois impactos.

## Limites

O navegador reproduz arranjos previamente renderizados. Não executa o motor Wwise, seus RTPCs, transições dinâmicas entre estados ou todos os filtros/buses. Portanto, o resultado é uma adaptação a partir de fontes reais; não foi validado como mixagem idêntica a cada momento do jogo original. O próprio wwiser aponta limites de simulação. Falas em português e demais mídias foram inventariadas, sem conversão em massa. Os impactos usam os eventos específicos identificados acima. Não se atribuiu um som de invocação do jogador a partir de um evento diferente.
