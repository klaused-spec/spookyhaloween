# A Sentinela — Halloween

Uma turma de personagens assustadores para festas de Halloween, feita para funcionar no navegador de um celular. Eles conversam em português com os convidados, em sussurros curtos, com perguntas provocadoras e risadas macabras.

## Requisitos

- Node.js 18 ou superior.
- Um recurso Azure OpenAI com um deployment de modelo de chat.
- Um recurso Azure Speech com chave e região para a voz neural.
- Um navegador com suporte a microfone e conexão HTTPS (ou `localhost`). O reconhecimento contínuo de fala usa o recurso Azure Speech; o modo de texto também está disponível.

## Configuração

1. Copie `.env.example` para `.env` e preencha os dados do Azure OpenAI e Azure Speech. Os prompts, contextos, personalidades, perguntas de ociosidade, respostas de fallback e ajustes de voz ficam no `.env` e podem ser editados ali, sem alterar o código. Os valores iniciais de pitch e velocidade são um teste mais grave e lento; reinicie o servidor para aplicá-los. A região do recurso Speech, como `swedencentral`, fica em `AZURE_SPEECH_REGION`.
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

Luana, a fantasma, Caio, o vampiro, e Pedro, o zelador, falam diretamente com os convidados, com respostas curtas que reagem ao que cada pessoa acabou de dizer e uma pergunta relacionada para continuar a conversa. Se o reconhecimento vier confuso, pedem para repetir em vez de inventar um sentido. Há sussurros e risadas ocasionais, sem narração. Se ninguém interagir por 15 segundos, um personagem tenta puxar conversa com uma pergunta diferente. Todas as vozes neurais usam o estilo de sussurro; no navegador, a voz alternativa usa volume e velocidade reduzidos. As vozes MAI 2.1 de Luana e Caio estão marcadas pela Azure como **Preview**, então a disponibilidade pode variar.

O reconhecimento de fala usa a Azure Speech em modo contínuo: depois da permissão inicial, mantém uma sessão de microfone aberta durante a conversa, inclusive enquanto os personagens falam. O servidor entrega ao navegador apenas um token temporário de reconhecimento; a chave Speech permanece no servidor e o token é renovado durante sessões longas. Se a geração de áudio do recurso Speech falhar, o app tenta usar a voz do navegador. O arquivo `.env` não deve ser enviado ao controle de versão nem compartilhado. O áudio é enviado à Azure Speech para reconhecimento; o texto reconhecido é enviado à Azure OpenAI, e as falas são enviadas à Azure Speech para síntese. O histórico fica apenas na memória da página e é descartado ao recarregá-la.
