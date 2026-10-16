# Integração de cartas e apresentações recuperadas

Autorização: aplicar os recursos recuperados e adicionar as cartas ausentes. Preservar execução offline por `file://`, salvamentos existentes, controles de som/efeitos e movimento reduzido.

| Módulo | Responsabilidade | Dependência |
|---|---|---|
| card-rules | Novas cartas com regras explícitas, geração/invocação/alvos e IA | catálogo oficial local |
| card-effects | Importação e reprodução adaptada dos efeitos específicos recuperados | acervo Unity e perfis PPtr |
| cinematic-library | Conversão e identificação dos vídeos Bink2 | ferramentas portáteis existentes |
| presentation-integration | Eventos no duelo, prévias na coleção, galeria e seleção | três módulos anteriores |

Construção: os três módulos de dados independentes podem avançar em paralelo; integração e validação dependem dos contratos finais. O catálogo de consulta já possui 2.512 registros: liberar uma carta para duelo exige implementar suas regras, e nenhum texto oficial será tratado como código executável. Referências estáticas não comprovam reprodução Unity equivalente.

Comandos: `node --test tests/*.test.cjs`, testes Chrome em `tests/*.cjs` com Playwright do runtime, importadores com Python 3.12 do runtime e `python tools/package.py`. Os dados gerados são locais; pacotes de pesquisa e ferramentas portáteis ficam fora da distribuição.

Contratos: `CardEffects.list/has/describe/play/cancel`; `CINEMATIC_LIBRARY` descreve códigos, skins e caminhos dos vídeos; o motor permanece síncrono e a apresentação acompanha os estados e resultados emitidos. Dados pesados carregam sob demanda, sem requisições remotas.

Critérios: efeitos específicos disponíveis na galeria e associados às cartas; novos feitiços/invocações funcionam com alvos, mana, capacidade e resposta; vídeos identificados e reproduzíveis; cancelamento restaura a partida; funcionamento por arquivo local; ausência de erros de console; cobertura das lacunas publicada sem prometer regras não implementadas.

Correção solicitada pelo usuário na v0.30: remover o modo livre separado e integrar cartas/decks em Minha coleção. Todas as 1.647 colecionáveis devem poder compor decks salvos na biblioteca existente; 865 cartas geradas ficam inspecionáveis. Acrescentar decks prontos com as novas cartas, acessíveis pelo menu normal e editor. Duelo automático exige habilidades implementadas; os demais decks ficam identificados com regras pendentes, sem atribuir habilidades falsas às cartas. Preservar biblioteca antiga, salvamentos de duelo, efeitos e execução offline.

Filtro solicitado na entrada: escolher uma carta por nome/código deve limitar a lista de decks às composições que a incluem, preservando decks salvos. Decks pendentes podem ser abertos no editor; zero resultados não pode iniciar uma partida inválida nem impedir retomar o salvamento. Limpar recupera todas as listas. A seleção deve continuar válida após salvar/alterar um deck na coleção. Validar desktop, celular e navegação nativa do campo de busca.
