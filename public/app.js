const talkButton = document.querySelector("#talk-button");
const buttonLabel = document.querySelector("#button-label");
const statusLine = document.querySelector("#status-line");
const statusText = document.querySelector("#status-text");
const conversation = document.querySelector(".conversation");
const textToggle = document.querySelector("#text-toggle");
const textForm = document.querySelector("#text-form");
const textInput = document.querySelector("#text-input");
const microphoneHelp = document.querySelector(".microphone-help");

const IDLE_TIMEOUT_MS = 15_000;
const characters = {
  luana: { name: "LUANA · A FANTASMA", pitch: 0.72 },
  caio: { name: "CAIO · O VAMPIRO", pitch: 0.55 },
  pedro: { name: "PEDRO · O ZELADOR", pitch: 0.9 },
};
const messages = [];
let assistantTurnCount = 0;
let recognition;
let speechConfig;
let microphoneStream;
let sessionActive = false;
let sessionGeneration = 0;
let isSpeaking = false;
let isWaitingForReply = false;
let idleTimer;
let recognitionRetryTimer;
let tokenRefreshTimer;
let recognitionRetryCount = 0;
let currentAudio;
let audioObjectUrl;
let finishCurrentAudio;
let speechRequestId = 0;

function setStatus(text, active = false) {
  statusText.textContent = text;
  statusLine.classList.toggle("is-active", active);
}

function clearIdleTimer() {
  window.clearTimeout(idleTimer);
  idleTimer = undefined;
}

function scheduleIdlePrompt() {
  clearIdleTimer();
  if (!sessionActive || isSpeaking || isWaitingForReply) return;

  idleTimer = window.setTimeout(() => {
    idleTimer = undefined;
    if (sessionActive && !isSpeaking && !isWaitingForReply) {
      requestReply({ idle: true });
    }
  }, IDLE_TIMEOUT_MS);
}

function showListeningStatus() {
  if (sessionActive && !isSpeaking && !isWaitingForReply) {
    setStatus("Estou ouvindo…", true);
  }
}

async function fetchSpeechAuthorization() {
  const response = await fetch("/api/speech/token", { method: "POST" });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || "Não consegui iniciar a escuta do Azure Speech.");
  }
  return result;
}

function addMessage(role, text, characterId) {
  const message = document.createElement("article");
  message.className = `message ${role === "user" ? "user-message" : "assistant-message"}`;
  if (role === "assistant" && characters[characterId]) {
    message.classList.add(`character-${characterId}`);
  }

  const label = document.createElement("span");
  label.className = "message-label";
  label.textContent = role === "user" ? "VOCÊ" : characters[characterId]?.name || "A SENTINELA";

  const content = document.createElement("p");
  content.textContent = text;
  message.append(label, content);
  conversation.append(message);
  conversation.scrollTop = conversation.scrollHeight;
}

function stopRecognition() {
  window.clearTimeout(recognitionRetryTimer);
  recognitionRetryTimer = undefined;

  const activeRecognizer = recognition;
  recognition = undefined;
  speechConfig = undefined;
  if (!activeRecognizer) return;

  const closeRecognizer = () => {
    activeRecognizer.close().catch((error) => {
      console.error("Não foi possível liberar o reconhecimento de voz:", error);
    });
  };
  try {
    activeRecognizer.stopContinuousRecognitionAsync(
      closeRecognizer,
      (error) => {
        console.error("Não foi possível encerrar o reconhecimento de voz:", error);
        closeRecognizer();
      },
    );
  } catch (error) {
    console.error("Não foi possível encerrar o reconhecimento de voz:", error);
    closeRecognizer();
  }
}

function scheduleRecognitionReconnect(error, generation) {
  if (!sessionActive || generation !== sessionGeneration || recognitionRetryTimer) return;
  stopRecognition();
  recognitionRetryCount++;
  const delay = Math.min(1_000 * 2 ** (recognitionRetryCount - 1), 15_000);
  console.error("A escuta foi interrompida; tentando reconectar:", error);
  setStatus("A escuta falhou por um instante. Reconectando…");
  recognitionRetryTimer = window.setTimeout(() => {
    recognitionRetryTimer = undefined;
    startAzureRecognition(generation);
  }, delay);
}

function scheduleTokenRefresh(generation) {
  window.clearTimeout(tokenRefreshTimer);
  tokenRefreshTimer = window.setTimeout(async () => {
    if (!sessionActive || generation !== sessionGeneration) return;
    try {
      const { authorizationToken } = await fetchSpeechAuthorization();
      if (!sessionActive || generation !== sessionGeneration) return;
      if (speechConfig) speechConfig.authorizationToken = authorizationToken;
      if (recognition) recognition.authorizationToken = authorizationToken;
      scheduleTokenRefresh(generation);
    } catch (error) {
      console.error("Não foi possível renovar o token da escuta:", error);
      setStatus("Problema ao renovar a conexão de voz. Tentando novamente…");
      tokenRefreshTimer = window.setTimeout(() => scheduleTokenRefresh(generation), 60_000);
    }
  }, 8 * 60_000);
}

async function startAzureRecognition(generation = sessionGeneration) {
  if (
    !sessionActive ||
    generation !== sessionGeneration ||
    recognition ||
    recognitionRetryTimer
  ) return;
  if (!window.SpeechSDK) {
    stopSession();
    setStatus("O SDK de voz não carregou. Verifique a conexão e recarregue a página.");
    return;
  }

  setStatus("Conectando à escuta contínua…");
  try {
    const { authorizationToken, region } = await fetchSpeechAuthorization();
    if (!sessionActive || generation !== sessionGeneration) return;

    speechConfig = window.SpeechSDK.SpeechConfig.fromAuthorizationToken(
      authorizationToken,
      region,
    );
    speechConfig.speechRecognitionLanguage = "pt-BR";
    if (!microphoneStream) {
      throw new Error("O acesso ao microfone foi encerrado. Inicie a conversa novamente.");
    }
    const audioConfig = window.SpeechSDK.AudioConfig.fromStreamInput(microphoneStream);
    const activeRecognizer = new window.SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);
    recognition = activeRecognizer;

    activeRecognizer.recognizing = (_sender, event) => {
      if (
        recognition !== activeRecognizer ||
        !sessionActive ||
        generation !== sessionGeneration
      ) return;
      if (event.result?.text?.trim()) {
        scheduleIdlePrompt();
        showListeningStatus();
      }
    };
    activeRecognizer.recognized = (_sender, event) => {
      if (
        recognition !== activeRecognizer ||
        !sessionActive ||
        generation !== sessionGeneration
      ) return;
      if (
        event.result?.reason === window.SpeechSDK.ResultReason.RecognizedSpeech &&
        event.result.text?.trim() &&
        !isSpeaking &&
        !isWaitingForReply
      ) {
        sendMessage(event.result.text);
      }
    };
    activeRecognizer.canceled = (_sender, event) => {
      if (
        recognition !== activeRecognizer ||
        !sessionActive ||
        generation !== sessionGeneration
      ) return;
      const details = event.errorDetails || "A conexão de reconhecimento foi interrompida.";
      if (/not.?allowed|permission|microphone/i.test(details)) {
        stopSession();
        setStatus("Microfone bloqueado. Abra “Como liberar o microfone?” abaixo.");
        microphoneHelp.open = true;
        return;
      }
      scheduleRecognitionReconnect(details, generation);
    };
    activeRecognizer.sessionStopped = () => {
      if (
        recognition === activeRecognizer &&
        sessionActive &&
        generation === sessionGeneration
      ) {
        scheduleRecognitionReconnect("A sessão de escuta foi encerrada.", generation);
      }
    };

    activeRecognizer.startContinuousRecognitionAsync(
      () => {
        if (
          recognition !== activeRecognizer ||
          !sessionActive ||
          generation !== sessionGeneration
        ) return;
        recognitionRetryCount = 0;
        setStatus("Escuta contínua ativa — fale quando quiser.", true);
        scheduleIdlePrompt();
        scheduleTokenRefresh(generation);
      },
      (error) => {
        if (
          recognition !== activeRecognizer ||
          !sessionActive ||
          generation !== sessionGeneration
        ) return;
        if (/not.?allowed|permission|microphone/i.test(error)) {
          stopSession();
          setStatus("Microfone bloqueado. Abra “Como liberar o microfone?” abaixo.");
          microphoneHelp.open = true;
          return;
        }
        scheduleRecognitionReconnect(error, generation);
      },
    );
  } catch (error) {
    if (!sessionActive || generation !== sessionGeneration) return;
    if (/not.?allowed|permission|microphone/i.test(error.message)) {
      stopSession();
      setStatus("Microfone bloqueado. Abra “Como liberar o microfone?” abaixo.");
      microphoneHelp.open = true;
      return;
    }
    scheduleRecognitionReconnect(error.message, generation);
  }
}

function speakWithBrowser(lines, requestId) {
  if (requestId !== speechRequestId || !sessionActive) return;
  if (!("speechSynthesis" in window)) {
    isSpeaking = false;
    setStatus("A voz da Azure falhou e este navegador não oferece voz alternativa.");
    showListeningStatus();
    scheduleIdlePrompt();
    return;
  }

  setStatus("Usando a voz alternativa do navegador…");
  isSpeaking = true;
  const utterances = lines.map((line) => {
    const utterance = new SpeechSynthesisUtterance(line.text);
    utterance.lang = "pt-BR";
    utterance.rate = 0.9;
    utterance.pitch = characters[line.characterId]?.pitch || 0.8;
    return utterance;
  });
  const finishFallback = () => {
    isSpeaking = false;
    showListeningStatus();
    scheduleIdlePrompt();
  };
  utterances.forEach((utterance, index) => {
    if (index === utterances.length - 1) utterance.onend = finishFallback;
    utterance.onerror = (event) => {
      console.error("A fala não pôde ser reproduzida:", event.error);
      if (index === utterances.length - 1) {
        setStatus("Não consegui reproduzir a voz. Confira o áudio do celular.");
        finishFallback();
      }
    };
  });
  window.speechSynthesis.cancel();
  utterances.forEach((utterance) => window.speechSynthesis.speak(utterance));
}

function releaseAudio() {
  if (finishCurrentAudio) {
    const finish = finishCurrentAudio;
    finishCurrentAudio = undefined;
    finish();
    return;
  }
  if (currentAudio) {
    currentAudio.onended = null;
    currentAudio.onerror = null;
    currentAudio.pause();
    currentAudio.removeAttribute("src");
    currentAudio.load();
    currentAudio = null;
  }
  if (audioObjectUrl) {
    URL.revokeObjectURL(audioObjectUrl);
    audioObjectUrl = null;
  }
}

function playAudio(audio, requestId) {
  if (requestId !== speechRequestId || !sessionActive) return Promise.resolve();

  audioObjectUrl = URL.createObjectURL(audio);
  currentAudio = new Audio(audioObjectUrl);
  const activeAudio = currentAudio;
  const activeUrl = audioObjectUrl;

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      activeAudio.onended = null;
      activeAudio.onerror = null;
      activeAudio.pause();
      activeAudio.removeAttribute("src");
      activeAudio.load();
      URL.revokeObjectURL(activeUrl);
      if (currentAudio === activeAudio) currentAudio = undefined;
      if (audioObjectUrl === activeUrl) audioObjectUrl = undefined;
      if (finishCurrentAudio === cancelPlayback) finishCurrentAudio = undefined;
      if (error) reject(error);
      else resolve();
    };
    const cancelPlayback = () => finish();

    finishCurrentAudio = cancelPlayback;
    activeAudio.onended = () => finish();
    activeAudio.onerror = () => finish(new Error("O áudio não pôde ser reproduzido."));
    activeAudio.play().catch(finish);
  });
}

async function speak(lines) {
  const requestId = ++speechRequestId;
  isSpeaking = true;
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  releaseAudio();
  setStatus("A Sentinela está preparando a voz…");

  try {
    const audioSegments = await Promise.all(
      lines.map(async (line) => {
        const response = await fetch("/api/speech", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lines: [line] }),
        });
        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error || "Uma das vozes da Azure não pôde ser gerada.");
        }
        return response.blob();
      }),
    );
    if (requestId !== speechRequestId || !sessionActive) return;

    for (let index = 0; index < audioSegments.length; index++) {
      if (requestId !== speechRequestId || !sessionActive) return;
      setStatus(`${characters[lines[index].characterId].name.split(" · ")[0]} sussurra…`);
      await playAudio(audioSegments[index], requestId);
    }

    if (requestId !== speechRequestId || !sessionActive) return;
    isSpeaking = false;
    showListeningStatus();
    scheduleIdlePrompt();
  } catch (error) {
    if (requestId !== speechRequestId || !sessionActive) return;
    console.error(error.message);
    setStatus(error.message);
    speakWithBrowser(lines, requestId);
  }
}

async function requestReply({ text, idle = false }) {
  if (isWaitingForReply) return;
  clearIdleTimer();
  if (text) {
    messages.push({ role: "user", content: text });
    addMessage("user", text);
  }
  isWaitingForReply = true;
  setStatus(idle ? "A Sentinela está chamando a festa…" : "A Sentinela está pensando…");

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: messages.slice(-12),
        idle,
        turnIndex: assistantTurnCount,
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "A conversa não pôde continuar.");
    }

    const reply = result.lines
      .map((line) => `${characters[line.characterId].name}: ${line.text}`)
      .join("\n");
    messages.push({ role: "assistant", content: reply });
    assistantTurnCount++;
    result.lines.forEach((line) => addMessage("assistant", line.text, line.characterId));
    isWaitingForReply = false;
    if (sessionActive) {
      speak(result.lines);
    } else {
      setStatus("Resposta recebida");
    }
  } catch (error) {
    isWaitingForReply = false;
    addMessage("assistant", error.message);
    setStatus(error.message);
    showListeningStatus();
    scheduleIdlePrompt();
  }
}

async function sendMessage(text) {
  const trimmedText = text.trim();
  if (!trimmedText || isWaitingForReply) return;
  clearIdleTimer();
  return requestReply({ text: trimmedText });
}

function stopSession() {
  sessionActive = false;
  sessionGeneration++;
  clearIdleTimer();
  window.clearTimeout(tokenRefreshTimer);
  tokenRefreshTimer = undefined;
  speechRequestId++;
  talkButton.classList.remove("is-listening");
  buttonLabel.textContent = "Começar a conversa";
  talkButton.setAttribute("aria-pressed", "false");
  stopRecognition();
  if (microphoneStream) {
    microphoneStream.getTracks().forEach((track) => track.stop());
    microphoneStream = undefined;
  }
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  releaseAudio();
  isSpeaking = false;
  setStatus("Sessão encerrada");
}

function startSession() {
  if (!window.isSecureContext) {
    setStatus("O microfone exige HTTPS no celular. Abra o app por um endereço que comece com https://.");
    microphoneHelp.open = true;
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus("Este navegador não oferece acesso ao microfone. Use o campo para digitar.");
    textForm.hidden = false;
    textInput.focus();
    return;
  }

  if (!window.SpeechSDK) {
    setStatus("O SDK de voz não carregou. Verifique a conexão e recarregue a página.");
    return;
  }

  sessionActive = true;
  sessionGeneration++;
  talkButton.classList.add("is-listening");
  buttonLabel.textContent = "Encerrar conversa";
  talkButton.setAttribute("aria-pressed", "true");
  const generation = sessionGeneration;
  setStatus("Solicitando acesso ao microfone…");
  navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  }).then((stream) => {
    if (!sessionActive || generation !== sessionGeneration) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    microphoneStream = stream;
    startAzureRecognition(generation);
  }).catch((error) => {
    if (!sessionActive || generation !== sessionGeneration) return;
    console.error("Não foi possível acessar o microfone:", error);
    stopSession();
    setStatus("Microfone bloqueado. Abra “Como liberar o microfone?” abaixo.");
    microphoneHelp.open = true;
  });
}

talkButton.addEventListener("click", () => {
  if (sessionActive) {
    stopSession();
  } else {
    startSession();
  }
});

textToggle.addEventListener("click", () => {
  textForm.hidden = !textForm.hidden;
  if (!textForm.hidden) textInput.focus();
});

textForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = textInput.value;
  textInput.value = "";
  sendMessage(text);
});

if (!window.SpeechSDK) {
  setStatus("O SDK de voz não carregou. Recarregue a página ou use o campo para digitar.");
}
