# Evidência estática de animações — worker REA

Data: 14/10/2026. Alvo: somente os exports já presentes em `communitydragon_historico` e `assets_extraidos`. Nenhum cliente executado, nenhum download e nenhuma ferramenta instalada. Método: leitura dos campos serializados, sem atribuir comportamento observado a nomes de arquivos. Caminhos abaixo são relativos a `C:/Users/Usuario/Documents/LoR_base_TCG/`.

## Proveniência e limites

- `communitydragon_historico/LEIA-ME_historico.md:3`: o índice histórico declara datas de maio/2020, coletado em 13/10/2026; não há equivalência comprovada com a instalação atual.
- `communitydragon_historico/LEIA-ME_historico.md:32`: PPtr são referências locais ao texto exportado; não foram resolvidos entre containers originais. Um PathID igual em containers diferentes não confirma o mesmo objeto. IDs de 64 bits devem permanecer strings, sem conversão para Number de JavaScript.
- Textos do CommunityDragon registram campos da Unity. `m_FixedDuration`, `m_DurationMode` e `m_EditorSettings.m_Framerate` são observações de valores armazenados. Sem os tracks e código, não estabelecem duração efetiva, ordem de execução ou framerate do gameplay.
- `assets_extraidos/summary.json:2–3`: extração por UnityPy 1.25.4; `stats` informa 8 AnimationClip e 1.537 MonoBehaviour. `assets_extraidos/components_resolved.json` distingue `coverage: base_fields_only` e `full` por componente. Classes/names de scripts não recuperam seus corpos ou curvas.

## Perfis default inspecionados

Base comum de caminhos: `communitydragon_historico/arquivos/assets/assetlibrary/cardprofiles/defaults/`.

### CardAnimationProfile.txt

- Linhas 10–16: um `AdditionalAnimationSets` do tipo `BaconFsmTemplateSet`, FileID 3, PathID `6273001841897411578`.
- Linhas 17–20: `PersonalAnimations.Entries` tem 22 itens.
- Linhas 23–44 e 47–68: dois itens `Enabled=1`, `ContentEnabled=2`, `AnimationDefinitionType.TypeHashCode=1597058504`, `BaconAnimationPointer` FileID 3, com requisitos JSON `ForPlayer=0` e `ForPlayer=1`. A correspondência numérica a jogador local/oponente não foi decodificada aqui.
- Linhas 76–92: `PlayableAnimationAsset` FileID 3, PathID `4712896051198258464`, com requisito `VariableNameAsString="Enum: Creation Context"`, `ComparisonCreationContext=2`. O enum numérico não foi decodificado.
- Linhas 171–173 e 195–197: requisitos por cartas `01SI030T2` e `01SI030`; não representam regra universal de invocação.
- Linhas 338–345 e 367–374: requisito literal `TriggerName="ChampionSpellShuffle"`, separado por `ForPlayer`.
- Linhas 417, 441, 465, 489 e 518: requisitos literais Capture, CostReduce, DeepBuff e DrawFromEnemyDeck.
- Linhas 524–530: `AttachableAnimations` e `CardTransitionOverrides` têm arrays vazios.

**Limite:** há seleção de conteúdo, referências a FSM/animation assets e requisitos, mas nenhum valor de trajetória, duração de ataque, easing ou escala neste arquivo. `TypeHashCode` e `ContentEnabled` não foram associados a implementações de classes/enum; não inferir a fase visual só pelo hash.

### CardVfxProfile.txt

- Linhas 10–13: `VfxContent.Entries` vazio.
- Linhas 14–17: dois `CardEffectOverridesSet.Entries`.
- Linhas 24–40: primeiro CardEffectType FileID 22 / PathID `-6374094977862362185`; Effect FileID 28 / PathID `-4639584385545965077`; HardRefAsset nulo; `RequiresAttackToken=0`, `Priority=0`, requisitos vazios.
- Linhas 47–63: segundo CardEffectType FileID 22 / PathID `-3419430782156217272`; Effect FileID 29 / PathID `5562825707994989487`; demais valores semelhantes.
- Linhas 64–67: `AttachableCardEffectSet.Entries` vazio.

**Limite:** esses PPtr não identificam textura, emitter ou shader por si. Um default com array vazio não prova ausência de VFX no jogo: os dois overrides e outros perfis/conjuntos ainda existem.

### CardSoundProfile.txt

- Linha 10: `BankName="Card_Neutralprofile_NeutralProfile"`.
- Linhas 11–14: 20 itens PersonalSFX. Eventos registrados, cada um com Weight=50:

| Linha | Evento literal |
|---|---|
| 71 | Play_CARD_death_marked_dying |
| 92 | Play_CARD_death_exit |
| 113 | Play_CARD_creation_shards |
| 155 | Play_CARD_land_on_board_stack |
| 176 | Play_CARD_land_on_board_backrow |
| 197 | Play_CARD_slide_backrow |
| 260 | Play_CARD_summon_spell_reveal_center |
| 302 | Play_CARD_transform_to_pog |
| 323 | Play_CARD_pog_drop_and_land |
| 344 | Play_CARD_pog_transform_to_card |
| 365 | Play_SP_buff_generic_cast |
| 386 | Play_SP_buff_generic_projectile |
| 407 | Play_SP_buff_generic_impact |

**Limite:** são nomes de eventos configurados, sem waveform, duração, envelope, frequência, volume ou resolução da referência `SoundMomentEnum`. Weight=50 não é volume. Esses dados permitem manter camadas/eventos distintos numa reconstrução, mas não copiar o som por síntese fiel.

## Parâmetros serializados de Timeline

Base: `communitydragon_historico/arquivos/`. Todos os seguintes mostram `m_Framerate=60` no campo **EditorSettings**, e `m_Version=0`.

| Arquivo | Campos e linhas |
|---|---|
| `_longpaths/e731bc5545868d9667572a1cd1581792b0a1bf696164ba7b50ebe22f91d2dcb7/SummonReveal_Unit_Activate_Timeline.txt` | m_Name linha 9; 5 tracks 11–33; m_FixedDuration=0.833333333333333 em 34; framerate em 36; m_DurationMode=0 em 37 |
| `_longpaths/880c9bef1cc780812e46637b48053bae8d2716e4bca9b07f2e65e64c4d0e388e/SummonReveal_Hand_Activate_Timeline.txt` | m_FixedDuration=0.0833333333333333 em 26; m_DurationMode=1 em 29 |
| `_longpaths/8f4f230f5d330593c077f629fac2f1792a3ebb82b645870fc3677b0093c28fd0/CardDraw_Local_FromDeck_CardEffect_Activate_Timeline.txt` | m_Name em 9; 5 tracks 11–33; m_FixedDuration=1 em 34; m_DurationMode=0 em 37 |
| `_longpaths/cf5e07edbd40773bc0b650a9f64d59816e6410cb54287e808718eb0c2fddff98/CardDraw_Local_FromDrawToHand_CardEffect_Activate_Timeline.txt` | m_Name em 9; 4 tracks 11–29; m_FixedDuration=1 em 30; m_DurationMode=1 em 33 |
| `_longpaths/871ef2ac84c8d257d8155455817266f62f90b6b4170c7d2a21d8e168f052a36c/CardDraw_Opponent_FromDeck_CardEffect_Activate_Timeline.txt` | m_FixedDuration=0.416666666666667 em 30; m_DurationMode=1 em 33 |
| `_longpaths/2806be1d7b6db81ce8c5ba5a930beb97c0a6e755c6a77dc3c344f5cc125ecaf5/CardDraw_Opponent_FromDrawToHand_CardEffect_Activate_Timeline.txt` | m_FixedDuration=0.683333333333333 em 30; m_DurationMode=1 em 33 |
| `assets/prefabs/table/turnpass/timelines/TurnPass_Effect_Activate_Timeline.txt` | m_FixedDuration=1.35 em 30; m_DurationMode=0 em 33 |
| `assets/prefabs/table/turnpass/timelines/PlayerPassed_Deactivate_Timeline.txt` | m_FixedDuration=0.266666666666667 em 26; m_DurationMode=1 em 29 |
| `assets/assetlibrary/cardeffects/combatblock/prefabs/Combat_Block_CardEffect_Activate_Timeline.txt` | 1 track 11–17; m_FixedDuration=0 em 18; m_DurationMode=0 em 21 |

**Limite fundamental:** a duração armazenada igual a zero não prova animação instantânea. Os tracks são PPtr, não contêm o conteúdo ou seus clips nestes textos. Não somar os dois tempos de CardDraw como duração total de uma compra sem prova de encadeamento. Nenhuma curva de movimentação básica ou sequência de strike normal foi recuperada neste escopo.

## Fases concretas nos overrides de feitiço

Base: `communitydragon_historico/arquivos/assets/assetlibrary/spells/generic/`.

### damage/overrides/Damage.txt

- Linhas 10–12: `BaseAnimation` PPtr FileID 1, PathID `-5800790101516475376`.
- `BaconSpellEffectDisplayEntries` tem 4 itens, linha 800. Os nomes abaixo estão **dentro** de entradas habilitadas e com valores concretos, não foram inferidos do filename:

| Entrada | Enabled e Name | StartTime |
|---|---|---|
| Cast | 803–804: 1 / Cast | 807: 0 |
| Playmat | 866–867: 0 / Playmat | 870: 0 |
| Missile | 929–930: 1 / Missile | 933: 0.1 |
| Impact | 992–993: 1 / Impact | 996: 0.2 |

- Variável `Float: Sequence Delay` em 570, VariableSource=2 em 573, SpecifiedFloat=0 em 576.
- `Float: Release Control Time` em 662, VariableSource=2 em 665, SpecifiedFloat=0.2 em 668.
- `Float: Event Delay` em 708, VariableSource=2 em 711, SpecifiedFloat=0.2 em 714.
- StartOffset e EndOffset de Missile têm x/y/z=0, linhas 982–989; não representam coordenadas finais de tela.

### heal/overrides/Heal.txt

- BaseAnimation FileID 2 / PathID `6212944265473623890`, linhas 10–12.
- Cast Enabled=1 em 757, Name=Cast em 758, StartTime=0 em 761.
- Playmat Enabled=0 em 820, Name em 821.
- Missile Enabled=1 em 883, Name=Missile em 884, StartTime=0.225 em 887.
- Impact Enabled=1 em 946, Name=Impact em 947, StartTime=0.275 em 950.
- Event Delay, Sequence Delay, Release Control Time SpecifiedFloat=0, linhas 576, 622, 668.

### buff/overrides/Buff.txt

- BaseAnimation FileID 1 / PathID `6212944265473623890`, linhas 10–12.
- Cast StartTime=0 em 761; Missile StartTime=0.19 em 887; Impact StartTime=0.1 em 950. Entradas habilitadas nas mesmas linhas de Heal.
- Event Delay, Sequence Delay, Release Control Time SpecifiedFloat=0, linhas 576, 622, 668.

**Limite:** os domínios de StartTime não foram decodificados. Buff tem Impact=.1 e Missile=.19; isso impede afirmar genericamente que StartTime é sempre um timestamp absoluto global ou que o impacto ocorre antes do projétil em execução. São offsets de configuração dependentes da base não resolvida. O PPtr de Heal usa FileID diferente de Buff mesmo com o mesmo PathID; não confirmar identidade dos objetos.

## Combate / enumsettings

- `communitydragon_historico/arquivos/assets/scriptableobjects/cardeffects/CombatCardEffects.txt:10–27` registra 1 CardEffectAsset habilitado, HardRefAsset PathID `3318096084120668766` e Effect PathID `2299573703740137582`, ambos FileID 0. CardEffectType externo FileID 71, PathID `-737758991615347820`. Não há timing ou trajeto neste objeto.
- `communitydragon_historico/arquivos/assets/resources/enumsettings/StrikeUnit.txt:9–13`: Name e Value StrikeUnit; DefaultPriority=100, DefaultCooldown=0, GlobalCooldown=0.
- `communitydragon_historico/arquivos/assets/resources/enumsettings/SummonReveal.txt:9–13`: Name e Value SummonReveal; mesmos valores. Cooldown zero não é duração zero.

## Inferências / decisões de reconstrução (não comportamento observado)

1. Separar animação em eventos de movimento, revelação, pouso, cast, projétil e impacto. Há campos/eventos distintos que suportam essa arquitetura, embora o encadeamento real não esteja recuperado.
2. Usar cerca de 833 ms como referência de revelação de unidade; comparar visualmente e ajustar a implementação local. Isso é uma escolha inspirada em m_FixedDuration, não alegação de duração exata do cliente.
3. Tratar Cast/Missile/Impact de Damage como um perfil candidato de 0 / 100 / 200 ms na reconstrução, documentando a escolha e preservando a liberdade de retiming para legibilidade.
4. Não usar uniformemente o mesmo efeito para dano, buff e heal: eles têm configurações diferentes de fase, e o áudio possui cast/projectile/impact distintos.
5. Nenhuma amplitude de tremor, curva de easing, deslocamento de strike básico, shape de particle emitter, ou volume do som foi estabelecida por este worker. Qualquer número de CSS/WAAPI nesses itens é design da reconstrução e precisa ser rotulado como tal.

Este relatório não prova equivalência de animação com LoR atual; ele fornece âncoras estáticas históricas para melhorar uma implementação offline.

## Identidade dos seis textos principais (SHA-256 local)

| Texto | SHA-256 |
|---|---|
| CardAnimationProfile default | D050B2996A1BC8FC9F945325F9212D736A0848FC2E5F8956F783F6069FF89E45 |
| CardVfxProfile default | D991FC72909C18DA568F0D9A5E51C9DFC6CE45E2A0AA6D1DDD52A1AD47E9E23B |
| CardSoundProfile default | A215B892B7699E550350CAA5EB57E67C6F84377FF48B6B96147286F94499D4F6 |
| Damage generic | B39562F4564829B44B42F1D6AF07F856750BA02FCF109B2322316D1308F6ACF8 |
| Heal generic | 68481581FCDF867DFF5EE4E2973937ED44B568D02BD04873D6826315895E83CD |
| Buff generic | 670F53CA89368FABD02C4F4B0832F532CF3E11A639D34BBBD89E4419DD05904B |
