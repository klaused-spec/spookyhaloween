# A Sentinela — Halloween

Uma anfitriã de voz para festas de Halloween, feita para funcionar no navegador de um celular. Ela conversa em português, pergunta nomes, responde ao que ouve e mantém o papo com humor de terror apropriado para todas as idades.

## Requisitos

- Node.js 18 ou superior.
- Um recurso Azure OpenAI com um deployment de modelo de chat.
- Um recurso Azure Speech com chave e região para a voz neural.
- Um navegador com suporte a microfone e conexão HTTPS (ou `localhost`). O reconhecimento contínuo de fala usa o recurso Azure Speech; o modo de texto também está disponível.

## Configuração

1. Copie `.env.example` para `.env` e preencha os dados do Azure OpenAI e Azure Speech. O app usa três vozes expressivas brasileiras, configuradas por personagem no servidor, e a região do seu recurso Speech, como `swedencentral`, em `AZURE_SPEECH_REGION`.
2. Instale as dependências do app:

   ```powershell
   npm install
   ```

3. No PowerShell, inicie o aplicativo com o script:

   ```powershell
   .\iniciar.ps1
   ```

   O script carrega as variáveis do `.env` sem exibir seus valores e inicia o servidor. Para encerrar, pressione `Ctrl+C`.

4. Abra `http://localhost:3000` no computador em que o servidor está rodando e toque em **Começar a conversa**. O Chrome considera `localhost` um endereço seguro e deve pedir acesso ao microfone. Se o acesso estiver bloqueado, abra `chrome://settings/content/microphone`, permita que os sites solicitem acesso e confira se o microfone correto está selecionado; depois, volte ao app e recarregue a página.
5. Para usar em outro celular, hospede o servidor em um endereço acessível ao aparelho com HTTPS. No celular, abra esse endereço no navegador e toque em **Começar a conversa**; quando surgir o pedido de acesso ao microfone, escolha **Permitir**. Em Android/Chrome, se o acesso já foi bloqueado, toque no ícone à esquerda do endereço do site → **Permissões** → **Microfone** → **Permitir**. No iPhone, abra **Ajustes → Apps → Safari → Microfone** e selecione **Permitir** ou **Perguntar**; volte ao site e autorize quando solicitado. Os nomes dos menus podem variar conforme a versão do sistema. O próprio app também mostra estas instruções na opção **Como liberar o microfone?**.

Luana, a fantasma, Caio, o vampiro, e Pedro, o zelador, alternam as falas com vozes e personalidades próprias. A cada quatro rodadas, aproximadamente, um deles pode responder ao outro em uma troca breve. As vozes neurais brasileiras MAI 2.1 e os estilos expressivos usados no app estão marcados pela Azure como **Preview**, então sua disponibilidade pode variar.

O resumo de *O fantasma de Romenís Harow* já vem incluído no app e é carregado automaticamente como inspiração. Não é preciso selecionar arquivo nem configurar nada ao publicar. Se quiser usar outro texto, abra **História da festa**, substitua o resumo ou carregue um arquivo `.txt` ou `.md` (até 2 MB). O texto fica somente na página; o resumo é consultado nas novas pistas, que contam acontecimentos e personagens do livro com outras palavras após 15 segundos sem interação. Os personagens chamam os convidados diretamente e encerram cada pista com uma pergunta de suspense sobre a história, sem pedir que ajudem na busca. Sem texto de inspiração, fazem uma pergunta casual sobre a festa ou sobre os convidados. O conteúdo enviado ao Azure não é salvo pelo app.

O reconhecimento de fala usa a Azure Speech em modo contínuo: depois da permissão inicial, mantém uma sessão de microfone aberta durante a conversa, inclusive enquanto os personagens falam. O servidor entrega ao navegador apenas um token temporário de reconhecimento; a chave Speech permanece no servidor e o token é renovado durante sessões longas. Se ninguém falar por 15 segundos e não houver texto de inspiração, os personagens fazem um convite breve para retomar a conversa; se houver um livro, contam a próxima pista da história. Se a geração de áudio do recurso Speech falhar, o app tenta usar a voz do navegador. O arquivo `.env` não deve ser enviado ao controle de versão nem compartilhado. O áudio é enviado à Azure Speech para reconhecimento; o texto reconhecido é enviado à Azure OpenAI, e as falas são enviadas à Azure Speech para síntese. O histórico fica apenas na memória da página e é descartado ao recarregá-la.
