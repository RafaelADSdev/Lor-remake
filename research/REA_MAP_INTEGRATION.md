# Integração do mapa e do HUD — 15/10/2026

## Resultado

O piso ampliado havia escondido as bases originais sem reposicionar as engrenagens. As laterais agora combinam o piso opaco com a arte PNG original: seu alfa preserva as peças do mapa, e uma máscara gradual mantém somente as bordas, sem restaurar os recortes escuros reservados ao HUD. As molduras de Nexus, ação e reserva usam componentes geométricos originais com seus UVs e material.

## Evidência REA e limites

Skill aplicada: `C:/Users/Usuario/Skills/reverse-engineer-anything/SKILL.md`.

REA 6.5.0 foi usado pela CLI. O diagnóstico em `rea-map-integration-doctor.json` mostra ausência de registro MCP e providers de decompilação. Não foi alterada configuração nem iniciado o cliente original. O inventário do snapshot foi executado com `rea inspect-artifact research/map-hud-sources.zip --json`.

- Evidence: `ev_98115b2d5f7b1b6a9df27d82f704713ae58a34cdc9cbe82b095045226ab582f8`.
- Snapshot SHA-256: `5967f248d729265111c25383a2ba6c13876af34b6bb81ca2c471e3e11a396b4d`.
- Resultado completo: `rea-map-hud-inventory.json`.
- Identidade dos 16 recursos: `map-hud-source-manifest.json`.

Essa Evidence estabelece identidade e inventário do snapshot. A leitura dos containers Unity, referências de material, malhas e UVs foi feita com UnityPy pelos scripts locais; não é decompilação produzida pelo REA. O encaixe e a projeção 2D são adaptações da interface, sem alegação de reprodução exata da câmera ou do shader do cliente.

## Recursos recuperados

Bundle original: `cliente_PC_downloads_2026-10-15/live/PatcherData/PatchableFiles/AssetBundles/2b/4f2adf1fb53b93fd68946b7ce147f2.bbq`. SHA-256: `24639eb04ad3ef08b63483f45ef8b1ffb90e455a6024f34043235fb7e30ca7d1`.

| Recurso | Path ID | Aplicação |
| --- | --- | --- |
| UI_tray | -3627666283186503513 | Moldura da ação e suportes vermelho/azul dos Nexus |
| Spell_mana_tray | 3245518248069910686 | Encaixes da reserva de mana |
| neutral_hud_mat | 2326968707358492394 | Material compartilhado |
| Playmat_Neutral_UI_Color | -6221100036570150784 | Textura original, SHA-256 `f7d5631f1e5bc2cbf27a998a138ccac0073e56339f935389bdc7e5aecda8856b` |

Os componentes foram separados por conectividade de posições, mantendo os triângulos e UVs completos. O importador registra referências e transformações em `assets/arenas/hud/sources.json`. O renderizador projeta XY com X refletido para manter Nexus à esquerda e ação à direita. `sprites.json` liga os PNGs a hashes de malha, material e renderizador. Os sprites de jogo são incorporados em `sprites.js` para abrir offline e continuar disponíveis sem WebGL.

A hipótese de material incorreto no BaseUI de Piltover foi verificada e descartada: a instância `Base_UI` do prefab usa `Piltover_Playmat_MAT`, como a Base. O material `BaconDefaultDiffuse` encontrado no objeto importado do FBX não é o material dessa instância da cena.

## Reprodução e validação

1. Execute `tools/import_map_hud.py` com o Python do ambiente e as dependências UnityPy locais.
2. Execute `node tools/render_map_hud.cjs` com Playwright e Chrome.
3. Execute `node tests/map-integration.cjs`, `node tests/nexus-hud.cjs`, `node tests/click-hud.cjs` e `node tests/arena-ambient.cjs`.

Chrome offline confirmou três temas em desktop/celular, duas molduras de mapa reutilizadas, cartas visíveis e botão de ação acessível. A suíte de Nexus também verifica fallback sem GPU e perda de contexto. A suíte de ambientação percorre os doze temas, lados independentes, movimento reduzido e campo central livre. Capturas finais: `test-results/map-integrated-piltover-1600.png` e `map-integrated-ionia-390.png`.
