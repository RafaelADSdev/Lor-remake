# Tela inicial

A tela inicial é uma superfície de operação: apresenta a campanha e permite preparar um duelo. Mantém a identidade existente de Runeterra, com fundo azul-marinho escuro, detalhes dourados, títulos em Beaufort e artes do acervo local.

## Hierarquia e navegação

A entrada apresenta dois modos ilustrados: campanha com o mapa oficial já disponível em `assets/campaign/runeterra-map.jpg` e duelo livre com a arte do campeão selecionado. As sobreposições escuras sustentam a leitura. “Explorar campanha” recebe o destaque dourado; muda para “Continuar campanha” quando há encontros concluídos. A linha de progresso vem do perfil real: nível e encontros concluídos, com aviso para exportar quando o armazenamento falha.

“Preparar duelo” troca a seleção de modos pela configuração da partida e coloca o foco no seletor de deck. “Voltar aos modos” restaura os dois painéis e devolve o foco ao botão de preparação. A campanha abre sua própria seção e recebe foco no título; voltar à arena devolve o foco à ação de campanha. Busca por carta, escolha de deck e adversário, continuação de partida salva e treino ficam na configuração do duelo. A personalização também aparece nessa etapa.

Coleção e animações ficam no menu nativo “Mais”, no cabeçalho. O menu fecha após selecionar uma ação ou com Escape; Escape devolve o foco ao resumo. Os grandes atalhos inferiores foram removidos para manter a seleção dos dois modos como foco da entrada. A instalação offline permanece abaixo dos painéis.

## Composição responsiva

No desktop, os dois modos ficam lado a lado: mapa à esquerda e campeão à direita. A campanha tem uma coluna ligeiramente maior. Acima de 800 px, as cópias usam linhas compartilhadas de altura para título, descrição e ação; os dois botões principais alinham pelo topo e têm 60 px de altura. Na configuração do duelo, o formulário ocupa a esquerda e a arte do campeão a direita. Abaixo de 1100 px, a composição simplifica a apresentação das cartas do deck.

Até 800 px, os painéis de modos se empilham, campanha antes de duelo, e a legenda do mapa desaparece. Até 700 px, a configuração do duelo apresenta primeiro o campeão, seguido do formulário; personalização usa uma coluna. O cabeçalho permite quebra de linha em telas estreitas, e o menu “Mais” se ancora à esquerda até 620 px. As capturas finais revisadas cobrem a seleção de modos em 1440 e 390 px e a configuração do duelo em 390 px. O texto claro de “Preparar duelo” permanece legível sobre o fundo escuro.

## Áudio e acessibilidade

Os efeitos sonoros começam ativados em perfis sem preferência salva. O controle guarda a escolha em `lor-sound-enabled`; o valor `false` mantém o som desligado após recarregar. O texto, o rótulo acessível e `aria-pressed` refletem a preferência atual. A música mantém seu controle independente.

Os controles mantêm rótulos, foco visível e títulos de seção. O mapa decorativo da tela inicial é ignorado por leitores de tela. A apresentação respeita a preferência de movimento reduzido e o controle de efeitos existente. A validação automatizada verifica navegação e estado do áudio; não comprova reprodução audível nem substitui testes com leitor de tela.
