# A Sentinela — Halloween

Uma anfitriã de voz para festas de Halloween, feita para funcionar no navegador de um celular. Ela conversa em português, pergunta nomes, responde ao que ouve e mantém o papo com humor de terror apropriado para todas as idades.

## Requisitos

- Node.js 18 ou superior.
- Um recurso Azure OpenAI com um deployment de modelo de chat.
- Um recurso Azure Speech com chave e região para a voz neural.
- Um navegador com suporte a microfone e conexão HTTPS (ou `localhost`). O reconhecimento contínuo de fala usa o recurso Azure Speech; o modo de texto também está disponível.

## Configuração

1. Copie `.env.example` para `.env` e preencha os dados do Azure OpenAI e Azure Speech. A voz padrão é `pt-BR-Luana:MAI-Voice-2.1-Flash`, uma voz brasileira com estilos expressivos; o estilo padrão `whispering` pode ser trocado por `softvoice` ou `fearful` em `AZURE_SPEECH_STYLE`. Ajuste `AZURE_SPEECH_VOICE` somente para outra voz que ofereça esses estilos. Use a região do seu recurso Speech, como `swedencentral`, em `AZURE_SPEECH_REGION`.
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
4. Para usar em outro celular, hospede o servidor em um endereço acessível ao aparelho com HTTPS. No celular, abra esse endereço no navegador e toque em **Começar a conversa**; quando surgir o pedido de acesso ao microfone, escolha **Permitir**. Em Android/Chrome, se o acesso já foi bloqueado, toque no ícone à esquerda do endereço do site → **Permissões** → **Microfone** → **Permitir**. No iPhone, abra **Ajustes → Apps → Safari → Microfone** e selecione **Permitir** ou **Perguntar**; volte ao site e autorize quando solicitado. Os nomes dos menus podem variar conforme a versão do sistema. O próprio app também mostra estas instruções na opção **Como liberar o microfone?**.

O app gera a fala com a voz neural brasileira Luana 2.1 da Azure Speech, em estilo sussurrado, com ritmo mais lento e tom mais grave. Essa voz e seus estilos são identificados pela Azure como **Preview**, então a disponibilidade pode variar. O reconhecimento de fala também usa a Azure Speech em modo contínuo: depois da permissão inicial, mantém uma única sessão de microfone aberta durante a conversa, inclusive enquanto a Sentinela fala, para evitar os bipes e as pausas do reconhecimento de voz nativo do navegador. O servidor entrega ao navegador apenas um token temporário de reconhecimento; a chave Speech permanece no servidor e o token é renovado durante sessões longas. Se ninguém falar por 15 segundos, a Sentinela faz um convite breve e leve para retomar a conversa; enquanto ela fala, a contagem fica pausada. Se a geração de áudio do recurso Speech falhar, o app tenta usar a voz do navegador. O arquivo `.env` não deve ser enviado ao controle de versão nem compartilhado. As chaves da Azure são usadas somente pelo servidor. O áudio da conversa é enviado à Azure Speech para reconhecimento; o texto reconhecido é enviado à Azure OpenAI e as respostas são enviadas à Azure Speech para síntese de voz. O histórico fica apenas na memória da página e é descartado ao recarregá-la.
