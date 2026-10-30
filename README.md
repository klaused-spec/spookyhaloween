# A Sentinela — três versões, um aplicativo

Um único servidor e uma única aplicação oferecem três experiências por rota:

- `/` e `/versao2/`: Luana sussurra, coleta nome, comida favorita de Halloween e brincadeira; salva essas anotações no servidor e usa-as como contexto nas próximas conversas.
- `/versao1/`: Luana, Caio e Pedro conversam, alternando quem responde.
- `/versao3/`: os três moradores fazem sustos leves e histórias fictícias de humor usando o nome que o convidado informou.

Use os links no topo da página para alternar entre as versões. Não é preciso criar aplicações, subdomínios ou processos Node.js separados.

O botão **Ativar luzes da abóbora** habilita cores fortes e lentas na tela enquanto a voz toca. O efeito começa desligado e, em aparelhos configurados para movimento reduzido, vira uma iluminação estática. Evite ativá-lo se luzes piscantes incomodam você.

## Requisitos

- Node.js 18 ou superior.
- Um recurso Azure OpenAI com um deployment de modelo de chat.
- Um recurso Azure Speech com chave e região para a voz neural.
- Um navegador com suporte a microfone e conexão HTTPS (ou `localhost`). O reconhecimento contínuo de fala usa o recurso Azure Speech; o modo de texto também está disponível.

## Configuração

1. Copie `.env.example` para `.env` e preencha os dados do Azure OpenAI e Azure Speech. Os prompts de cada experiência e os ajustes simples de voz também ficam no `.env`; reinicie o servidor depois de editá-los.
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

Na experiência simples, as anotações são salvas em `data/guest-memory.json`, permanecem após reiniciar o app e são carregadas como contexto. Use **Apagar anotações salvas** para removê-las. O arquivo não entra no Git; em hospedagens que apagam arquivos durante um novo deploy, faça backup ou configure `HALLOWEEN_MEMORY_FILE` para um volume persistente. Qualquer pessoa com acesso ao app simples pode ver ou apagar a memória. Nomes e gostos salvos também são enviados à Azure OpenAI. Nas versões de personagens, o nome permanece apenas no histórico da página. A voz neural usa os ajustes definidos no `.env`.

O reconhecimento de fala usa a Azure Speech em modo contínuo: depois da permissão inicial, mantém uma sessão de microfone aberta durante a conversa. O servidor entrega ao navegador apenas um token temporário de reconhecimento; a chave Speech permanece no servidor e o token é renovado durante sessões longas. Se a geração de áudio falhar, o app tenta usar a voz do navegador. O `.env` contém credenciais: não o envie ao controle de versão nem compartilhe. O áudio vai para Azure Speech; a transcrição, a conversa e as anotações salvas vão para Azure OpenAI.

As rotas das três versões são atendidas pelo mesmo processo Node.js iniciado em `/`. O Hostinger já publica a branch `main` nesse processo; depois do push, a configuração atual de auto-deploy atualiza esse mesmo app sem criar sites ou serviços separados.
