const talkButton = document.querySelector("#talk-button");
const buttonLabel = document.querySelector("#button-label");
const statusLine = document.querySelector("#status-line");
const statusText = document.querySelector("#status-text");
const conversation = document.querySelector(".conversation");
const textToggle = document.querySelector("#text-toggle");
const textForm = document.querySelector("#text-form");
const textInput = document.querySelector("#text-input");
const microphoneHelp = document.querySelector(".microphone-help");

const speechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const IDLE_TIMEOUT_MS = 15_000;
const messages = [];
let recognition;
let sessionActive = false;
let isSpeaking = false;
let isWaitingForReply = false;
let idleTimer;
let currentAudio;
let audioObjectUrl;
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

function addMessage(role, text) {
  const message = document.createElement("article");
  message.className = `message ${role === "user" ? "user-message" : "assistant-message"}`;

  const label = document.createElement("span");
  label.className = "message-label";
  label.textContent = role === "user" ? "VOCÊ" : "A SENTINELA";

  const content = document.createElement("p");
  content.textContent = text;
  message.append(label, content);
  conversation.append(message);
  conversation.scrollTop = conversation.scrollHeight;
}

function stopRecognition() {
  if (recognition) {
    try {
      recognition.stop();
    } catch (error) {
      if (error.name !== "InvalidStateError") {
        console.error("Não foi possível parar o reconhecimento de voz:", error);
      }
    }
  }
}

function listenAgain() {
  if (!sessionActive || isSpeaking || isWaitingForReply || !recognition) return;
  try {
    recognition.start();
    setStatus("Estou ouvindo…", true);
  } catch (error) {
    if (error.name !== "InvalidStateError") {
      console.error("Não foi possível iniciar o reconhecimento de voz:", error);
      setStatus("Não consegui acessar o microfone. Tente novamente.");
      stopSession();
    }
  }
}

function speakWithBrowser(text, requestId) {
  if (requestId !== speechRequestId || !sessionActive) return;
  if (!("speechSynthesis" in window)) {
    isSpeaking = false;
    setStatus("A voz da Azure falhou e este navegador não oferece voz alternativa.");
    listenAgain();
    scheduleIdlePrompt();
    return;
  }

  setStatus("Usando a voz alternativa do navegador…");
  isSpeaking = true;
  stopRecognition();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "pt-BR";
  utterance.rate = 0.9;
  utterance.pitch = 0.8;
  utterance.onend = () => {
    isSpeaking = false;
    listenAgain();
    scheduleIdlePrompt();
  };
  utterance.onerror = (event) => {
    isSpeaking = false;
    console.error("A fala não pôde ser reproduzida:", event.error);
    setStatus("Não consegui reproduzir a voz. Confira o áudio do celular.");
    listenAgain();
    scheduleIdlePrompt();
  };
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function releaseAudio() {
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

async function speak(text) {
  const requestId = ++speechRequestId;
  isSpeaking = true;
  stopRecognition();
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  releaseAudio();
  setStatus("A Sentinela está preparando a voz…");

  try {
    const response = await fetch("/api/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!response.ok) {
      const result = await response.json();
      throw new Error(result.error || "A voz da Azure não pôde ser gerada.");
    }

    const audio = await response.blob();
    if (requestId !== speechRequestId || !sessionActive) return;

    setStatus("A Sentinela sussurra na escuridão…");
    audioObjectUrl = URL.createObjectURL(audio);
    currentAudio = new Audio(audioObjectUrl);
    currentAudio.onended = () => {
      releaseAudio();
      if (requestId !== speechRequestId) return;
      isSpeaking = false;
      listenAgain();
      scheduleIdlePrompt();
    };
    currentAudio.onerror = () => {
      console.error("O áudio da Azure não pôde ser reproduzido neste navegador.");
      releaseAudio();
      speakWithBrowser(text, requestId);
    };

    try {
      await currentAudio.play();
    } catch (error) {
      console.error("A reprodução de áudio da Azure foi bloqueada:", error);
      releaseAudio();
      speakWithBrowser(text, requestId);
    }
  } catch (error) {
    if (requestId !== speechRequestId || !sessionActive) return;
    console.error(error.message);
    setStatus(error.message);
    speakWithBrowser(text, requestId);
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
  stopRecognition();
  setStatus(idle ? "A Sentinela está chamando a festa…" : "A Sentinela está pensando…");

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: messages.slice(-12), idle }),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "A conversa não pôde continuar.");
    }

    messages.push({ role: "assistant", content: result.reply });
    addMessage("assistant", result.reply);
    isWaitingForReply = false;
    if (sessionActive) {
      speak(result.reply);
    } else {
      setStatus("Resposta recebida");
    }
  } catch (error) {
    isWaitingForReply = false;
    addMessage("assistant", error.message);
    setStatus(error.message);
    listenAgain();
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
  clearIdleTimer();
  speechRequestId++;
  talkButton.classList.remove("is-listening");
  buttonLabel.textContent = "Começar a conversa";
  talkButton.setAttribute("aria-pressed", "false");
  if (recognition) stopRecognition();
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

  if (!speechRecognition) {
    setStatus("Reconhecimento de voz indisponível. Use o campo para digitar.");
    textForm.hidden = false;
    textInput.focus();
    return;
  }

  recognition = new speechRecognition();
  recognition.lang = "pt-BR";
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.onresult = (event) => {
    const latestResult = event.results[event.results.length - 1];
    if (latestResult[0].transcript.trim()) clearIdleTimer();
    if (latestResult.isFinal) sendMessage(latestResult[0].transcript);
  };
  recognition.onerror = (event) => {
    if (event.error === "no-speech") return;
    if (event.error === "aborted" && !sessionActive) return;
    console.error("Erro no reconhecimento de voz:", event.error);
    if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      stopSession();
      setStatus("Microfone bloqueado. Abra “Como liberar o microfone no celular?” abaixo.");
      return;
    }
    setStatus("O microfone falhou. Tentando ouvir novamente…");
  };
  recognition.onend = () => {
    if (sessionActive && !isSpeaking && !isWaitingForReply) {
      window.setTimeout(listenAgain, 350);
    }
  };

  sessionActive = true;
  talkButton.classList.add("is-listening");
  buttonLabel.textContent = "Encerrar conversa";
  talkButton.setAttribute("aria-pressed", "true");
  listenAgain();
  scheduleIdlePrompt();
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

if (!speechRecognition) {
  setStatus("Voz indisponível neste navegador; você pode digitar.");
}
