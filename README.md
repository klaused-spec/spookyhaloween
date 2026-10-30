# A Sentinela — versão 3

Uma anfitriã de Halloween com três personagens: Luana, a fantasma; Caio, o vampiro; e Pedro, o zelador. Eles conversam com os convidados, perguntam seus nomes e, quando alguém se apresenta, podem usar o nome numa micro-história fictícia de susto com humor. As pegadinhas são leves: sem ameaças, violência gráfica, gritos ou sons repentinos e altos.

## Requisitos

- Node.js 18 ou superior.
- Um recurso Azure OpenAI com um deployment de modelo de chat.
- Um recurso Azure Speech com chave e região para a voz neural.
- Navegador com suporte a microfone e conexão HTTPS (ou `localhost`). Também existe modo de texto.

## Configuração

1. Copie `.env.example` para `.env` e preencha as credenciais do Azure OpenAI e Azure Speech. O estilo da conversa fica em `HALLOWEEN_PROMPT`; ajuste de voz por personagem pode ser feito em `AZURE_SPEECH_VOICE_LUANA`, `AZURE_SPEECH_VOICE_CAIO` e `AZURE_SPEECH_VOICE_PEDRO`.
2. Instale as dependências:

   ```powershell
   npm install
   ```

3. Inicie o servidor:

   ```powershell
   .\iniciar.ps1
   ```

   Ou use `npm start`. Abra `http://localhost:3000` e permita o microfone. Em celular, o app precisa estar servido por HTTPS.

## Publicação em subcaminho

`APP_BASE_PATH` permite servir esta versão em um caminho como `/versao3`. Configure essa variável no ambiente do processo Node.js e encaminhe tanto as requisições da página quanto `/api/*` e `/vendor/*` para o mesmo processo. Deixe vazia para servir na raiz do domínio.

No Hostinger, a implantação Node.js de uma branch substitui o conteúdo da aplicação associada ao site. Não implante outra branch sobre a aplicação de produção para tentar criar uma segunda versão. Para manter `main`, `versao1`, `versao2` e `versao3` simultaneamente no mesmo domínio, cada processo precisa de uma implantação independente e o servidor web precisa encaminhar cada subcaminho ao processo correspondente; confirme no hPanel se seu plano permite essa configuração antes de publicar. A aplicação atual do domínio está configurada como Node.js na raiz.

O nome e as falas ficam apenas no histórico da sessão no navegador e são enviados à Azure OpenAI para gerar respostas; não são gravados numa memória persistente pelo app. O áudio vai para Azure Speech. O `.env` contém credenciais: não o envie ao Git nem compartilhe.
