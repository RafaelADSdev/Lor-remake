# Segmentos originais de mana — 15/10/2026

## Correção

Os dez segmentos de cada lado usavam retângulos distribuídos por um arco aproximado. As molduras já eram nativas, mas esses retângulos ultrapassavam seus encaixes. Agora os segmentos usam o quad, os UVs, as texturas de cheio/vazio e as vinte transformações do prefab original. O centro e a escala da moldura seguem os bounds e a transformação do mesh `Big_Button` para compartilhar a mesma projeção com a mana.

## Fontes

Bundle: `cliente_PC_downloads_2026-10-15/live/PatcherData/PatchableFiles/AssetBundles/2b/4f2adf1fb53b93fd68946b7ce147f2.bbq`, SHA-256 `24639eb04ad3ef08b63483f45ef8b1ffb90e455a6024f34043235fb7e30ca7d1`.

| Recurso | Path ID |
| --- | --- |
| Mana_Pip_mesh | -3724746956541237646 |
| ManaPip_Unit_Full, textura | -1123416505057766833 |
| ManaPib_Unit_Empty, textura | -5385792518978713569 |
| ManaPip_Unit_Full, material | -6334937908531854551 |
| Big_Button, mesh | -2845255290947377499 |

`tools/import_mana_pips.py` lê esses recursos com UnityPy e recupera as cadeias de transformação das instâncias `ManaPip_Full_override_1` a `_10`, sob `TableSimplified`. A aplicação afim dos UVs é verificada contra os quatro vértices de cada quad, com erro inferior a 0,0001 unidade. As texturas são incorporadas em `assets/arenas/hud/mana-pips.js`; o SVG recorta cada imagem pelo polígono UV original. Identidade dos arquivos e cadeias completas ficam em `mana-pips-sources.json`.

O material original tem `_Slope` HDR RGB aproximadamente `(0,218; 0,612; 11,212)`. A interface aplica uma tonalização azul em SVG, com adaptação para sRGB. Ela não executa o shader HDR, bloom ou as partículas originais. Os valores e a disponibilidade de mana continuam vindo do motor local.

## REA

Foi reutilizada a CLI REA 6.5.0 já disponível. `inspect-artifact` verificou o snapshot `research/mana-pip-sources.zip`; resultado integral em `rea-mana-pip-inventory.json`.

- Evidence: `ev_d549fc01569c6f7ad2c906bd635c2bdfba9d3819882908f8d96ad86af5d4aaba`.
- Snapshot SHA-256: `ab906e4b1b7cae093b5a72dbf2c9a9cb230deac0a9762edcb443c6c88e12ad8f`.

Essa Evidence estabelece inventário e identidade dos exports. A leitura Unity e a inspeção das transformações foram feitas com ferramentas locais; não são decompilação REA nem observação do cliente em execução.

## Validação

`node tests/native-mana.cjs` verifica recursos por SHA-256, vinte segmentos nos limites da moldura, mana cheia/gasta nas rodadas 1/5/10, lados independentes, rótulos acessíveis, botão clicável e quatro tamanhos de janela, offline. `node tests/click-hud.cjs` confirma ataques e bloqueios. Prévia: `test-results/mana-native-detail.png`.
