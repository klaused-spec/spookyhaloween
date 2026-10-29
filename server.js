const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const publicDirectory = path.join(__dirname, "public");
const port = Number(process.env.PORT || 3000);
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
      if (body.length > 16_384) {
        reject(new Error("A mensagem excede o limite permitido."));
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
  const voice = process.env.AZURE_SPEECH_VOICE || "pt-BR-Luana:MAI-Voice-2.1-Flash";
  const style = process.env.AZURE_SPEECH_STYLE || "whispering";
  const supportedStyles = ["fearful", "softvoice", "whispering"];

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

  if (typeof payload.text !== "string" || payload.text.trim().length === 0 || payload.text.length > 1_500) {
    sendJson(response, 400, { error: "O texto para leitura está vazio ou excede o limite." });
    return;
  }

  if (!supportedStyles.includes(style)) {
    sendJson(response, 500, {
      error: "O estilo de voz configurado não é compatível com a voz Luana 2.1.",
    });
    return;
  }

  const speechUrl = `https://${encodeURIComponent(speechRegion)}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const ssml = [
    '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="pt-BR">',
    `<voice name="${escapeXml(voice)}">`,
    `<mstts:express-as style="${style}" styledegree="1.2">`,
    '<prosody rate="-10%" pitch="-8%">',
    escapeXml(payload.text.trim()),
    "</prosody>",
    "</mstts:express-as>",
    "</voice>",
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
    "X-Speech-Voice": voice,
    "X-Speech-Style": style,
  });
  response.end(audio);
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
            content:
              "Você é a Sentinela, anfitriã de voz de uma festa de Halloween. Fale sempre em português brasileiro, com frases curtas e naturais para serem ouvidas em voz alta. Seja divertida, misteriosa, teatral e levemente assustadora — nunca cruel, violenta ou explícita. Seja proativa e persuasiva de um jeito brincalhão: puxe conversa, convide as pessoas a interagir e, quando houver uma pausa, chame alguém com frases espontâneas como 'Ei, você aí… fala comigo!' ou 'Não vai me deixar falando sozinha, vai?'. Dê boas-vindas, pergunte o nome da pessoa com delicadeza se ainda não souber, use o nome com moderação, faça perguntas abertas, reaja ao que ela disser e conte piadas originais de terror quando combinar. Mantenha uma conversa acolhedora e apropriada para todas as idades. Convide, mas não pressione ninguém a responder nem invente fatos sobre a pessoa. Se não quiser dizer o nome, chame-a de visitante misterioso. Responda em uma ou duas frases, termine frequentemente com uma pergunta ou convite e varie as chamadas para que não soem repetitivas.",
          },
          ...(isIdlePrompt
            ? [
                {
                  role: "system",
                  content:
                    "Este turno só acontece após 15 segundos sem ninguém falar. Faça um convite curto, divertido e acolhedor para retomar a conversa, variando o texto. Pode comentar que a festa parece animada e perguntar quem está por aí, como está a festa ou de que fantasia vieram. Não diga que consegue ver ou ouvir as pessoas, não assuste de verdade e não insista: faça um único convite leve e espere.",
                },
              ]
            : []),
          ...messages,
          ...(isIdlePrompt
            ? [
                {
                  role: "user",
                  content: "Já passou um momento em silêncio na festa. Puxe conversa agora com um convite breve.",
                },
              ]
            : []),
        ],
        max_tokens: 120,
        temperature: 0.9,
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
  sendJson(response, 200, { reply: answer.trim() });
}

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  if (requestUrl.pathname === "/api/chat" && request.method === "POST") {
    await handleChat(request, response);
    return;
  }

  if (requestUrl.pathname === "/api/speech" && request.method === "POST") {
    await handleSpeech(request, response);
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
