# Cinemática Bink2 convertida

Atualização v0.29: os 133 vídeos preservados já estão convertidos e disponíveis na galeria. Este documento registra o caso inicial de Garen Rugged e a recuperação de seu som externo. O inventário completo e a verificação atual estão em `cinematic-library-manifest.json` e `INTEGRACAO_CLIENTE_ATUAL.md`. Os demais vídeos permanecem mudos.

Em 15/10/2026 foi convertida uma das 133 cinemáticas preservadas: `Skin_Garen_Rugged_LevelUp_HQ.bk2`. É especificamente a skin **Garen Rugged**. Não representa a animação padrão de Garen e deve aparecer somente mediante escolha explícita com esse nome.

Fonte: 6.250.964 bytes, SHA-256 `3724161857a3fa2c5ff06a59d59ff5c4ec7435f57af940794fed8b8a8c72e379`. Cabeçalho `KB2j`, 150 quadros, 2340×1080, 30 fps, duração 5 segundos. A inspeção FFmpeg identifica apenas vídeo, sem faixa de áudio.

## Conversão observada

O FFmpeg 7.1 portátil não implementa o decoder Bink2: a execução real retorna `Bink 2 video is not implemented`. A exportação MP4 direta do RAD também falhou (código 8006, arquivo vazio). Nenhum desses resultados foi tratado como vídeo válido.

O [RAD Video Tools oficial](https://www.radgametools.com/bnkdown.htm) foi adquirido em arquivo local (`radtools.7z`, SHA-1 `dace86bb00b755fea8a0002538fad79e3faebdd6`). O instalador NSIS contido foi **extraído estaticamente**, usando 7-Zip portátil extraído também estaticamente da distribuição oficial. Nenhum instalador foi executado, nenhum registro de sistema foi alterado, nenhuma licença foi aceita pelo usuário automaticamente.

Foi executado apenas `RADVideo64.exe BinkConv <fonte> <frame.png> /S1 /E150 /Z0 /N-1`, com janela oculta. A ferramenta escreveu todos os 150 PNG RGB. Seu processo retém o diálogo de progresso após concluir; foi encerrado somente o processo iniciado para essa tarefa, depois de existirem os 150 quadros completos. Por isso o código de saída registrado é não zero e não serve como evidência de sucesso: a evidência está nos quadros completos e na decodificação posterior do WebM.

O FFmpeg codificou os quadros como VP9, 1280×590, 30 fps, sem áudio, CRF 30. Saída: `assets/video/garen-rugged-level-up.webm` (1.926.202 bytes). O manifesto `current-video-manifest.json` preserva hashes de origem, saída e ferramentas. O script `tools/import_current_video.py` reproduz a conversão com caminhos explícitos para as ferramentas já extraídas; não baixa nem instala software.

Verificação no Chrome headless, carregando a página local `file://`: duração 5 s, dimensão 1280×590, `readyState=4`, reprodução avançou a 2,263074 s e decodificou 67 quadros, `video.error=null`. A captura `test-results/current-video-garen-rugged.png` foi inspecionada visualmente e mostra a cinemática, sem quadro vazio. A leitura dos pixels por canvas foi recusada pela política `file://`; essa tentativa não foi tratada como evidência de imagem. A captura do navegador confirma o quadro decodificado.

## Áudio e encerramento corrigidos — v0.28

O vídeo foi decodificado novamente com FFmpeg: 150 quadros, 5 segundos, nenhum erro. O BK2 também informa 150 quadros/5 segundos e nenhuma faixa sonora. A sensação de corte não resulta de quadros faltando na conversão.

O bundle `dd/ac402b5670ba0094bd3634406501a2.bbq` contém a timeline `Rugged_LevelUp_Video_CardEffec_Activate_Timeline`. Sua trilha `Garen Rugged lvl`, ativa, publica `Play_CH_RiftQuest_Garen_ChampLvlUp` no instante zero. O clipe de evento tem path ID `-2869184587956577363`; a trilha de voz separada está marcada como muda. O evento Wwise **2176040566**, banco **3290525097**, referencia a mídia **797481960** em `stage1.pck`. O importador `scripts_reproducao/import_current_audio.py`, na pasta superior ao jogo, agora recupera essa referência e exporta `assets/audio/current/sfx-garen-rugged-level-up.ogg`, com duração integral de **12,48 s** (há silêncio final na fonte). Hashes, offsets, referência Unity, TXTP e ganho estão em `assets/audio/current/sources.json`.

O player inicia esse som na primeira reprodução do vídeo usando `RegionalAudio`, respeitando Som desligado. Sua cauda continua após o fim do vídeo e é interrompida por pular/Escape, cancelamento, menu ou página oculta. O encerramento visual aguarda `ended`, aplica uma saída de 180 ms e retorna à mesa. O limite antigo de 9 segundos corridos foi substituído por 15 segundos apenas para carregamento/travadas.

A skin original também tem prefabs Unity de entrada/saída fora do BK2, incluindo `Rugged_LevelUp_OutroPlaymat_Effect`; o perfil HQ inicia esse efeito em 4,7 s. Esses efeitos não estão reconstruídos no protótipo. A saída suave local não é apresentada como reprodução dessa parte nativa.

## Limites

- Somente uma cinemática foi convertida e verificada; não há alegação de conversão dos outros 132 vídeos.
- Não há áudio embutido nessa fonte; o som original agora é reproduzido separadamente.
- Os PNG são RGB, sem canal alpha: usar como cinemática retangular com enquadramento, sem prometer transparência original.
- Os executáveis de pesquisa ficam fora do jogo e do pacote de distribuição.
- A integração deve manter a apresentação padrão e oferecer essa skin por nome; falhas de carregamento devem voltar à apresentação padrão.
