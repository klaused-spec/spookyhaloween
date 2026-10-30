# A Sentinela — Halloween

Uma turma de personagens assustadores para festas de Halloween, feita para funcionar no navegador de um celular. Eles conversam em português com os convidados, em sussurros curtos, com perguntas provocadoras e risadas macabras.

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

Luana, a fantasma, Caio, o vampiro, e Pedro, o zelador, falam diretamente com os convidados, com perguntas curtas, sussurros e risadas ocasionais. A conversa se concentra nas pessoas da festa, sem narração. Se ninguém interagir por 15 segundos, um personagem tenta puxar conversa com uma pergunta diferente. Todas as vozes neurais usam o estilo de sussurro; no navegador, a voz alternativa usa volume e velocidade reduzidos. As vozes MAI 2.1 de Luana e Caio estão marcadas pela Azure como **Preview**, então a disponibilidade pode variar.

O reconhecimento de fala usa a Azure Speech em modo contínuo: depois da permissão inicial, mantém uma sessão de microfone aberta durante a conversa, inclusive enquanto os personagens falam. O servidor entrega ao navegador apenas um token temporário de reconhecimento; a chave Speech permanece no servidor e o token é renovado durante sessões longas. Se a geração de áudio do recurso Speech falhar, o app tenta usar a voz do navegador. O arquivo `.env` não deve ser enviado ao controle de versão nem compartilhado. O áudio é enviado à Azure Speech para reconhecimento; o texto reconhecido é enviado à Azure OpenAI, e as falas são enviadas à Azure Speech para síntese. O histórico fica apenas na memória da página e é descartado ao recarregá-la.

## Publicação em subcaminho

Configure `APP_BASE_PATH=/versao1` para servir esta versão em um subcaminho. Deixe a variável vazia para servir na raiz do domínio. O servidor e os arquivos do navegador usam o prefixo para as páginas, recursos estáticos e rotas de API.

Um subcaminho exige que o servidor web encaminhe as requisições para o processo Node.js correto. Na hospedagem atual, o Hostinger usa uma aplicação Node.js do Passenger montada em `/`; implantar outra branch no mesmo site substitui a aplicação existente. Configure o roteamento no Hostinger antes de tentar servir várias branches no mesmo domínio.
