# Investigação e reconstrução das animações de LoR — v0.3

O resultado implementa revelação da carta completa, transformação em marcador, pouso, golpes por par, atualização de dano no impacto, fragmentação e compra com revelação antes da mão. As regras continuam sendo o recorte local documentado no README.

## Fontes e autoridade

Foi aplicada a skill `C:/Users/Usuario/Skills/reverse-engineer-anything/SKILL.md`. REA 6.5.0 foi executado pela CLI pública, sem registrar MCP ou modificar configurações do Codex. O diagnóstico encontrou ausência de registro e de providers nativos configurados nesta sessão.

A tentativa de inspecionar `cliente_PC/live/Game/LoR_Data/sharedassets0.assets` retornou `unsupported_target / unsupported binary format`, registrada em `rea-unity-inspection.json`. Isso é limitação do formato nesta operação, não prova de ausência de animações.

Foi criado um snapshot explícito de 23 fontes selecionadas do acervo, e o REA fez sua inspeção de arquivo ZIP com o provider `rea-artifact-graph`. Evidence: **ev_7f24183180aca69ffae597df000f1f7335918abdd9a3156c0518b357f17cfe4f**. SHA-256 do snapshot: **d298f6393472c47bd8532bdec83ca1ba5d67f9b7a182c9180765a975f78b721b**. Envelope completo em `rea-motion-inventory.json`. Essa Evidence estabelece inventário e identidade do snapshot; não decompila shaders nem executa as animações.

Os valores de animação foram lidos nos textos serializados já extraídos, por um parser local e revisão independente. Isso é leitura estática orientada pela skill, separada da Evidence do REA. Os registros com caminhos, linhas e SHA-256 ficam em `local-motion-records.json` e no relatório `animation-evidence-worker.md`.

## Valores observados e uso no jogo

Todos os caminhos desta tabela ficam sob `communitydragon_historico/arquivos/`, no acervo pai.

| Referência | Observação estática | Uso nesta reconstrução |
|---|---|---|
| `_longpaths/e731bc5545868d9667572a1cd1581792b0a1bf696164ba7b50ebe22f91d2dcb7/SummonReveal_Unit_Activate_Timeline.txt:34` | m_FixedDuration=0.833333333333333; cinco referências a tracks | Janela de referência de 833 ms para revelação e deslocamento; pouso separado é adaptado |
| `_longpaths/880c9bef1cc780812e46637b48053bae8d2716e4bca9b07f2e65e64c4d0e388e/SummonReveal_Hand_Activate_Timeline.txt:26` | m_FixedDuration=.0833333333333333, DurationMode=1 | Referência mínima para pausa de revelação; não interpretada como duração total da compra |
| `_longpaths/8f4f230f5d330593c077f629fac2f1792a3ebb82b645870fc3677b0093c28fd0/CardDraw_Local_FromDeck_CardEffect_Activate_Timeline.txt:34` | m_FixedDuration=1 | Janela de referência de um segundo para compra/revelação; sem somar automaticamente durations de tracks |
| `assets/assetlibrary/spells/generic/damage/overrides/Damage.txt:803` | Cast habilitado com StartTime=0; Missile=.1; Impact=.2 | Camadas separadas de cast, projétil e impacto; interpretação desses offsets em milissegundos no relógio local é uma adaptação |
| `assets/assetlibrary/cardprofiles/defaults/CardSoundProfile.txt:302` | Eventos distintos de transform_to_pog, pog_drop_and_land, death_marked_dying/death_exit e buff_cast/projectile/impact | Organização de apresentação por fases; sons continuam sintetizados, sem alegar reprodução dos waveforms originais |
| `assets/assetlibrary/cardeffects/cardcreationdeath/` | Texturas originais de brilho e crack, copiadas sem alteração | Brilho de revelação e flash/crack de quebra; recorte, blending e dispersão dos fragmentos são reconstruídos |

As 19 imagens completas das cartas são PNGs PT-BR do Data Dragon já presentes no acervo, copiados sem edição. O campo usa a arte e atributos atuais do motor, para que a vida após dano não seja substituída pela imagem impressa do valor inicial.

## O que permanece inferência ou desconhecido

- O índice CommunityDragon é histórico, com datas de maio/2020. Não comprova paridade com o cliente 7-10-14.
- Os PPtr dos tracks não foram resolvidos entre os containers históricos originais. `m_FixedDuration` não necessariamente é a duração efetiva, e `EditorSettings.m_Framerate=60` não comprova framerate de execução.
- Nenhuma curva, transformação ou sequência executada de strike normal foi recuperada. Recuo, deslocamento, retorno, distância, ordem visual por par e fragmentos CSS são escolhas explícitas de reconstrução.
- Os offsets de Buff encontrados não têm domínio resolvido e diferem dos de Damage. Esta versão usa uma convenção comum de apresentação local; não afirma que todo feitiço possui a mesma timeline original.
- O cliente original não foi iniciado. Não há captura de gameplay original para validar equivalência pixel a pixel ou duração exata. O motor deste protótipo foi executado e testado separadamente.

## Verificação do protótipo

- Testes do motor: determinismo, limites, ações ilegais, dano, bloqueio e retorno de eventos por par; 100 partidas simuladas.
- Chrome sem rede: partida, ataque, bloqueio, salvamento e recarga; movimento reduzido e efeitos desligados.
- Testes de apresentação: fases da revelação, PNG completo, movimento físico de dois atacantes distintos, impactos por par, morte somente após resultado do motor, compra até a mão e interrupção pelo menu.
- Captura local em `test-results/lor-animacoes-v0.3.webm`; é execução do protótipo, não filmagem do cliente LoR.

O recorte entregue é mais próximo das fases e recursos encontrados no acervo, sem prometer reprodução integral das animações originais.
