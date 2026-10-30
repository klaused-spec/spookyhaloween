# A Sentinela — versão simples

Uma personagem sussurrante para festas de Halloween, feita para funcionar no navegador de um celular. Luana chama os convidados, descobre seus nomes, suas comidas favoritas de Halloween e suas brincadeiras preferidas, e usa essas anotações como memória nas próximas conversas.

## Requisitos

- Node.js 18 ou superior.
- Um recurso Azure OpenAI com um deployment de modelo de chat.
- Um recurso Azure Speech com chave e região para a voz neural.
- Um navegador com suporte a microfone e conexão HTTPS (ou `localhost`). O reconhecimento contínuo de fala usa o recurso Azure Speech; o modo de texto também está disponível.

## Configuração

1. Copie `.env.example` para `.env` e preencha os dados do Azure OpenAI e Azure Speech. A missão da personagem e os ajustes simples de voz também ficam no `.env`; reinicie o servidor depois de editá-los.
2. Instale as dependências do app:

   ```powershell
   npm install
   ```

3. No PowerShell, inicie o aplicativo com o script:

   ```powershell
   .\iniciar.ps1
   ```

   O servidor carrega as variáveis do `.env` sem exibir seus valores; o script também faz essa leitura antes de iniciar. Isso permite iniciar pelo script ou com `npm start`. Para encerrar, pressione `Ctrl+C`.

4. Abra `http://localhost:3000` no computador em que o servidor está rodando e toque em **Começar a conversa**. O Chrome considera `localhost` um endereço seguro e deve pedir acesso ao microfone. Se o acesso estiver bloqueado, abra `chrome://settings/content/microphone`, permita que os sites solicitem acesso e confira se o microfone correto está selecionado; depois, volte ao app e recarregue a página.
5. Para usar em outro celular, hospede o servidor em um endereço acessível ao aparelho com HTTPS. No celular, abra esse endereço no navegador e toque em **Começar a conversa**; quando surgir o pedido de acesso ao microfone, escolha **Permitir**. Em Android/Chrome, se o acesso já foi bloqueado, toque no ícone à esquerda do endereço do site → **Permissões** → **Microfone** → **Permitir**. No iPhone, abra **Ajustes → Apps → Safari → Microfone** e selecione **Permitir** ou **Perguntar**; volte ao site e autorize quando solicitado. Os nomes dos menus podem variar conforme a versão do sistema. O próprio app também mostra estas instruções na opção **Como liberar o microfone?**.

Luana é a única personagem e fala em sussurros curtos. Ela insiste com gentileza para descobrir o nome, a comida favorita de Halloween e a brincadeira favorita de cada convidado; de vez em quando, faz um susto brincalhão. Quando ninguém fala por 15 segundos, ela chama outra pessoa ou pergunta o que ainda falta saber. As anotações são salvas em `data/guest-memory.json` no servidor, permanecem após reiniciar o app e são carregadas como contexto nas conversas seguintes. Use **Apagar anotações salvas** para removê-las. O arquivo não entra no Git; em hospedagens que apagam arquivos durante um novo deploy, faça backup ou configure `HALLOWEEN_MEMORY_FILE` para um volume persistente. Como qualquer pessoa com acesso ao app pode ver ou apagar a memória, use-o apenas em um ambiente confiável. Nomes e gostos salvos também são enviados à Azure OpenAI como contexto. A voz neural usa os ajustes de pitch, velocidade e sussurro definidos no `.env`.

O reconhecimento de fala usa a Azure Speech em modo contínuo: depois da permissão inicial, mantém uma sessão de microfone aberta durante a conversa. O servidor entrega ao navegador apenas um token temporário de reconhecimento; a chave Speech permanece no servidor e o token é renovado durante sessões longas. Se a geração de áudio falhar, o app tenta usar a voz do navegador. O `.env` contém credenciais: não o envie ao controle de versão nem compartilhe. O áudio vai para Azure Speech; a transcrição, a conversa e as anotações salvas vão para Azure OpenAI.

## Publicação em subcaminho

Configure `APP_BASE_PATH=/versao2` para servir esta versão em um subcaminho. Deixe a variável vazia para servir na raiz do domínio. O servidor e os arquivos do navegador usam o prefixo para as páginas, recursos estáticos e rotas de API.

Um subcaminho exige que o servidor web encaminhe as requisições para o processo Node.js correto. Na hospedagem atual, o Hostinger usa uma aplicação Node.js do Passenger montada em `/`; implantar outra branch no mesmo site substitui a aplicação existente. Configure o roteamento no Hostinger antes de tentar servir várias branches no mesmo domínio.
