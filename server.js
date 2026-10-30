const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const publicDirectory = path.join(__dirname, "public");
const port = Number(process.env.PORT || 3000);
const appBasePath = process.env.APP_BASE_PATH?.trim().replace(/\/+$/, "") || "";
if (appBasePath && !/^\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(appBasePath)) {
  throw new Error("APP_BASE_PATH deve ser um caminho como /versao1 ou ficar vazio.");
}
const MAX_REPLY_LENGTH = 100;
const characters = [
  {
    id: "luana",
    name: "LUANA · A FANTASMA",
    voice: "pt-BR-Luana:MAI-Voice-2.1-Flash",
    style: "whispering",
    pitch: "-13%",
    personality: "fantasma que sussurra perguntas pessoais com curiosidade arrepiante",
  },
  {
    id: "caio",
    name: "CAIO · O VAMPIRO",
    voice: "pt-BR-Caio:MAI-Voice-2.1-Flash",
    style: "whispering",
    pitch: "-17%",
    personality: "vampiro que sussurra com humor macabro e curiosidade insistente",
  },
  {
    id: "pedro",
    name: "PEDRO · O ZELADOR",
    voice: "pt-BR-AntonioNeural",
    style: "whispering",
    pitch: "-10%",
    personality: "zelador sinistro, seco e persistente, que fala como se guardasse um segredo",
  },
];
const charactersById = new Map(characters.map((character) => [character.id, character]));
const idleQuestions = [
  "Ei... qual é o seu nome? Hehehe...",
  "Você veio pela festa... ou pelo susto?",
  "Já provou asas de barata crocantes? Hehehe...",
  "Ei... não vai me deixar falando sozinho, vai? Como se chama?",
  "O que trouxe você até esta festa estranha?",
  "Uuuuuh... de que veio fantasiado?",
  "Tem coragem de ouvir minha risada? Hehehe...",
];
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(data));
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 48_000) {
        reject(new Error("A solicitação excede o limite permitido."));
        request.destroy();
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function escapeXml(text) {
  return text.replace(/[<>&"']/g, (character) => {
    const entities = {
      '"': "&quot;",
      "'": "&apos;",
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
    };
    return entities[character];
  });
}

async function handleSpeech(request, response) {
  const speechKey = process.env.AZURE_SPEECH_KEY;
  const speechRegion = process.env.AZURE_SPEECH_REGION;

  if (!speechKey || !speechRegion) {
    sendJson(response, 503, {
      error: "Configure a chave e a região do recurso Azure Speech no servidor.",
    });
    return;
  }

  let payload;
  try {
    payload = JSON.parse(await readRequestBody(request));
  } catch (error) {
    sendJson(response, 400, {
      error: error instanceof SyntaxError ? "O texto para leitura é inválido." : error.message,
    });
    return;
  }

  const lines = Array.isArray(payload.lines)
    ? payload.lines
    : typeof payload.text === "string"
      ? [{ characterId: "luana", text: payload.text }]
      : [];
  if (lines.length !== 1) {
    sendJson(response, 400, { error: "Envie uma fala por vez para a síntese de voz." });
    return;
  }

  const speechSegments = [];
  for (const line of lines) {
    const character = charactersById.get(line?.characterId);
    if (
      !character ||
      typeof line.text !== "string" ||
      line.text.trim().length === 0 ||
      line.text.length > 240
    ) {
      sendJson(response, 400, { error: "Uma das falas ou vozes é inválida." });
      return;
    }

    speechSegments.push(
      `<voice name="${character.voice}"><mstts:express-as style="${character.style}" styledegree="1.2"><prosody rate="-10%" pitch="${character.pitch}">${escapeXml(line.text.trim())}</prosody></mstts:express-as></voice>`,
    );
  }

  const speechUrl = `https://${encodeURIComponent(speechRegion)}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const ssml = [
    '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="pt-BR">',
    speechSegments.join('<break time="350ms"/>'),
    "</speak>",
  ].join("");

  let speechResponse;
  try {
    speechResponse = await fetch(speechUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/ssml+xml",
        "Ocp-Apim-Subscription-Key": speechKey,
        "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
        "User-Agent": "A-Sentinela-Halloween",
      },
      body: ssml,
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    console.error("Falha ao conectar à Azure Speech:", error.message);
    sendJson(response, 502, {
      error: "Não consegui alcançar a voz da Azure. Vou tentar a voz do navegador.",
    });
    return;
  }

  if (!speechResponse.ok) {
    console.error(`Azure Speech respondeu com status ${speechResponse.status}.`);
    sendJson(response, 502, {
      error: "A Azure Speech não conseguiu gerar o áudio. Vou tentar a voz do navegador.",
    });
    return;
  }

  const audio = Buffer.from(await speechResponse.arrayBuffer());
  if (audio.length === 0) {
    sendJson(response, 502, { error: "A Azure Speech retornou um áudio vazio." });
    return;
  }

  response.writeHead(200, {
    "Content-Type": "audio/mpeg",
    "Content-Length": audio.length,
    "Cache-Control": "no-store",
  });
  response.end(audio);
}

async function handleSpeechToken(response) {
  const speechKey = process.env.AZURE_SPEECH_KEY;
  const speechRegion = process.env.AZURE_SPEECH_REGION;

  if (!speechKey || !speechRegion) {
    sendJson(response, 503, {
      error: "Configure a chave e a região do recurso Azure Speech no servidor.",
    });
    return;
  }

  if (!/^[a-z0-9-]+$/i.test(speechRegion)) {
    sendJson(response, 500, { error: "A região do recurso Azure Speech é inválida." });
    return;
  }

  let tokenResponse;
  try {
    tokenResponse = await fetch(
      `https://${speechRegion}.api.cognitive.microsoft.com/sts/v1.0/issueToken`,
      {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": speechKey,
          "Content-Length": "0",
        },
        signal: AbortSignal.timeout(10_000),
      },
    );
  } catch (error) {
    console.error("Falha ao obter token de reconhecimento Azure Speech:", error.message);
    sendJson(response, 502, { error: "Não consegui conectar à escuta do Azure Speech." });
    return;
  }

  if (!tokenResponse.ok) {
    console.error(`Azure Speech token respondeu com status ${tokenResponse.status}.`);
    sendJson(response, 502, { error: "A Azure Speech não autorizou o reconhecimento de voz." });
    return;
  }

  const authorizationToken = (await tokenResponse.text()).trim();
  if (!authorizationToken) {
    sendJson(response, 502, { error: "Azure Speech retornou um token vazio." });
    return;
  }

  sendJson(response, 200, { authorizationToken, region: speechRegion });
}

async function handleChat(request, response) {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || "2024-10-21";

  if (!endpoint || !apiKey || !deployment) {
    sendJson(response, 503, {
      error: "Configure o endpoint, a chave e o deployment da Azure no servidor.",
    });
    return;
  }

  let payload;
  try {
    payload = JSON.parse(await readRequestBody(request));
  } catch (error) {
    sendJson(response, 400, {
      error: error instanceof SyntaxError ? "A mensagem enviada é inválida." : error.message,
    });
    return;
  }

  if (!Array.isArray(payload.messages) || payload.messages.length > 20) {
    sendJson(response, 400, { error: "A conversa enviada é inválida." });
    return;
  }

  const isIdlePrompt = payload.idle === true;
  const turnIndex = Number.isSafeInteger(payload.turnIndex) && payload.turnIndex >= 0
    ? payload.turnIndex
    : 0;
  const idleQuestion = idleQuestions[turnIndex % idleQuestions.length];
  const speaker = characters[turnIndex % characters.length];
  const messages = payload.messages.filter(
    (message) =>
      message &&
      ["user", "assistant"].includes(message.role) &&
      typeof message.content === "string" &&
      message.content.length > 0 &&
      message.content.length <= 1_000,
  );
  const lastMessage = messages[messages.length - 1];
  if (!isIdlePrompt && (!lastMessage || lastMessage.role !== "user")) {
    sendJson(response, 400, { error: "Envie uma fala para começar a conversa." });
    return;
  }

  let azureUrl;
  try {
    azureUrl = new URL(
      `/openai/deployments/${encodeURIComponent(deployment)}/chat/completions`,
      endpoint,
    );
    azureUrl.searchParams.set("api-version", apiVersion);
  } catch {
    sendJson(response, 500, { error: "O endpoint da Azure configurado é inválido." });
    return;
  }

  let azureResponse;
  try {
    azureResponse = await fetch(azureUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            content: [
              "Você interpreta um personagem assustador de uma festa de Halloween e fala diretamente com os convidados. Responda em português brasileiro, com pouquíssimas palavras: uma fala curta, de preferência entre 3 e 10 palavras, nunca acima de 100 caracteres.",
              ...characters.map(
                (character) => `${character.name}: ${character.personality}.`,
              ),
              `Nesta rodada, ${speaker.name} fala sozinho. Nunca interprete outro personagem nem crie diálogo entre os moradores. Fale só com o público e responda ao que a pessoa acabou de dizer. Se ainda não souber o nome, pergunte; depois use o nome e faça uma pergunta curta de continuação.`,
              "Seja assustador, brincalhão e insistente de um jeito divertido. Pergunte coisas como o nome da pessoa, por que veio à festa, a fantasia ou se já provou asas de barata crocantes. Faça apenas uma pergunta por fala. Não faça monólogos, poesia, narração, exposição de histórias ou perguntas abstratas. Varie as perguntas e não repita a mesma frase em turnos próximos.",
              "De vez em quando, use uma risadinha maligna ou um susto vocal bem curto, como 'Hehehe...' ou 'Aaaah...!', nunca em toda fala. Tudo é dito em sussurro; não escreva instruções de palco nem grite de verdade. Mantenha o terror brincalhão, sem ameaças reais, humilhação ou violência.",
              isIdlePrompt
                ? `Ninguém respondeu há 15 segundos. Chame a atenção com uma pergunta direta e curta. Faça a pergunta sugerida, ou uma variação natural: ${idleQuestion} Se ainda não responderem, volte a tentar após a próxima pausa, mudando o assunto.`
                : "Converse como anfitrião assustador: reaja à resposta da pessoa, demonstre curiosidade e faça uma pergunta curta para manter o papo. Não pressione se ela disser que não quer conversar.",
              `Retorne somente JSON válido no formato {"lines":[{"text":"fala curta"}]}. Produza exatamente uma fala para ${speaker.name}, com até ${MAX_REPLY_LENGTH} caracteres.`,
            ].join(" "),
          },
          ...messages,
          ...(isIdlePrompt
            ? [
                {
                  role: "user",
                  content: "Fale diretamente com alguém da festa, em poucas palavras. Não narre nada.",
                },
              ]
            : []),
        ],
        response_format: { type: "json_object" },
        max_tokens: 120,
        temperature: 0.85,
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    console.error("Falha ao conectar à Azure OpenAI:", error.message);
    sendJson(response, 502, {
      error: "Não consegui alcançar a névoa da Azure. Tente falar comigo novamente.",
    });
    return;
  }

  if (!azureResponse.ok) {
    console.error(`Azure OpenAI respondeu com status ${azureResponse.status}.`);
    sendJson(response, 502, {
      error: "A Azure OpenAI não conseguiu responder. Confira a configuração do deployment.",
    });
    return;
  }

  let result;
  try {
    result = await azureResponse.json();
  } catch (error) {
    console.error("A resposta da Azure OpenAI não era JSON válido:", error.message);
    sendJson(response, 502, { error: "A resposta recebida da Azure estava inválida." });
    return;
  }

  const answer = result.choices?.[0]?.message?.content;
  if (typeof answer !== "string" || answer.trim().length === 0) {
    sendJson(response, 502, { error: "A Azure OpenAI retornou uma resposta vazia." });
    return;
  }

  let parsedAnswer;
  try {
    parsedAnswer = JSON.parse(answer);
  } catch (error) {
    console.error("A resposta de personagens da Azure não era JSON válido:", error.message);
    sendJson(response, 502, { error: "A resposta dos personagens veio em um formato inválido." });
    return;
  }

  const lines = parsedAnswer.lines;
  const validLines = Array.isArray(lines) &&
    lines.length === 1 &&
    lines.every(
      (line) =>
        line &&
        typeof line.text === "string" &&
        line.text.trim().length > 0 &&
        line.text.trim().length <= MAX_REPLY_LENGTH,
    );
  if (!validLines) {
    const invalidLineLengths = Array.isArray(lines)
      ? lines.map((line) => (typeof line?.text === "string" ? line.text.trim().length : "invalid"))
      : "not-an-array";
    console.error("A resposta do personagem tinha formato ou tamanho inválido:", invalidLineLengths);
    sendJson(response, 502, { error: "A resposta dos personagens não seguiu a ordem esperada." });
    return;
  }

  sendJson(response, 200, {
    lines: [{
      characterId: speaker.id,
      text: lines[0].text.trim(),
    }],
  });
}

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  if (appBasePath) {
    if (requestUrl.pathname === appBasePath) {
      response.writeHead(308, { Location: `${appBasePath}/${requestUrl.search}` });
      response.end();
      return;
    }
    if (!requestUrl.pathname.startsWith(`${appBasePath}/`)) {
      sendJson(response, 404, { error: "Rota não encontrada." });
      return;
    }
    requestUrl.pathname = requestUrl.pathname.slice(appBasePath.length);
  }

  if (requestUrl.pathname === "/api/chat" && request.method === "POST") {
    await handleChat(request, response);
    return;
  }

  if (requestUrl.pathname === "/api/speech" && request.method === "POST") {
    await handleSpeech(request, response);
    return;
  }

  if (requestUrl.pathname === "/api/speech/token" && request.method === "POST") {
    await handleSpeechToken(response);
    return;
  }

  if (requestUrl.pathname === "/vendor/speech-sdk.js" && request.method === "GET") {
    const sdkPath = path.join(
      __dirname,
      "node_modules",
      "microsoft-cognitiveservices-speech-sdk",
      "distrib",
      "browser",
      "microsoft.cognitiveservices.speech.sdk.bundle.js",
    );
    fs.readFile(sdkPath, (error, content) => {
      if (error) {
        console.error("Não foi possível carregar o SDK Azure Speech:", error.message);
        sendJson(response, 500, { error: "O SDK de voz não está disponível." });
        return;
      }
      response.writeHead(200, {
        "Content-Type": "text/javascript; charset=utf-8",
        "Cache-Control": "public, max-age=86400",
      });
      response.end(content);
    });
    return;
  }

  if (requestUrl.pathname.startsWith("/api/")) {
    sendJson(response, 404, { error: "Rota não encontrada." });
    return;
  }

  const requestedPath = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
  const filePath = path.resolve(publicDirectory, `.${requestedPath}`);
  if (!filePath.startsWith(`${publicDirectory}${path.sep}`)) {
    response.writeHead(403);
    response.end("Acesso negado.");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404);
      response.end("Página não encontrada.");
      return;
    }
    response.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    response.end(content);
  });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Sentinela do Halloween disponível na porta ${port}.`);
});
