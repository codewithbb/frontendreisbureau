// /assets/js/chatbot.js
// Streaming chatbot + speech-to-text + pending booking knop
// Updated for new endpoints in chatbot_revised.py:
// - POST /chatbot/chat
// - GET  /chatbot/pending_booking
// - POST /chatbot/confirm_booking  (recommended)
// - POST /chatbot/book_trip        (fallback)

//const API_BASE_CB = "http://127.0.0.1:5001";
const API_BASE_CB = "https://ack2511-reisbureau-fdghe5emesfrbza5.swedencentral-01.azurewebsites.net"; // no trailing slash

let speechRecognizer = null;
let isStreaming = false;

// DOM
const loggedOutBox = document.getElementById("chatbot-logged-out");
const chatbotUI = document.getElementById("chatbot-ui");
const chatWindow = document.getElementById("chat-window");
const userMsgBox = document.getElementById("user-message");

const sendBtn = document.getElementById("chatbot-send");
const clearBtn = document.getElementById("chatbot-clear");
const micBtn = document.getElementById("chatbot-mic");
const langSelect = document.getElementById("chatbot-lang");
const statusText = document.getElementById("chatbot-status");

// Marked: kleine safety/format tweaks (geen header ids, geen email mangle)
if (window.marked) {
  marked.setOptions({ headerIds: false, mangle: false });
}

// ==============
// 1) Login check
// ==============
document.addEventListener("DOMContentLoaded", async () => {
  const { loggedIn } = await getCurrentSession();

  if (!loggedIn) {
    loggedOutBox.classList.remove("hidden");
    chatbotUI.classList.add("hidden");
    return;
  }

  chatbotUI.classList.remove("hidden");
  loggedOutBox.classList.add("hidden");
});

// ==============
// 2) UI helpers
// ==============
function scrollToBottom() {
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function setStreamingUI(streaming) {
  isStreaming = streaming;
  sendBtn.disabled = streaming;
  micBtn.disabled = streaming || micBtn.classList.contains("listening");
}

function setStatus(text) {
  statusText.textContent = text || "";
}

function escapeHTML(str) {
  return String(str || "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[m]));
}

function createMessage({ kind }) {
  const wrapper = document.createElement("div");
  wrapper.className = `chat-msg ${kind}`;

  const who = document.createElement("div");
  who.className = "who";
  who.textContent = kind === "user" ? "🧍 Jij" : "🤖 Chatbot";

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  wrapper.appendChild(who);
  wrapper.appendChild(bubble);

  chatWindow.appendChild(wrapper);
  scrollToBottom();

  return { wrapper, bubble };
}

function appendUserMessage(text) {
  const { bubble } = createMessage({ kind: "user" });
  bubble.innerHTML = `<p style="margin:0;">${escapeHTML(text)}</p>`;
}

function createStreamingBotMessage() {
  const { wrapper, bubble } = createMessage({ kind: "bot" });
  const streamingDiv = document.createElement("div");
  streamingDiv.className = "streaming-text";
  bubble.appendChild(streamingDiv);
  return { wrapper, streamingDiv };
}

function finalizeBotMarkdown(streamingDiv, fullText) {
  streamingDiv.innerHTML = marked ? marked.parse(fullText) : escapeHTML(fullText);
  scrollToBottom();
}

function appendBotError(text) {
  const { bubble } = createMessage({ kind: "bot" });
  bubble.innerHTML = `<p style="margin:0;"><strong>Fout:</strong> ${escapeHTML(text)}</p>`;
  scrollToBottom();
}

// ===============================
// 3) Streaming chat (NEW endpoint)
// ===============================
async function sendMessage() {
  const message = userMsgBox.value.trim();
  if (!message || isStreaming) return;

  appendUserMessage(message);
  userMsgBox.value = "";
  setStatus("Chatbot is aan het typen…");
  setStreamingUI(true);

  try {
    // NEW: /chatbot/chat
    const response = await fetch(`${API_BASE_CB}/chatbot/chat`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      // stream:true makes sure we get a streaming text/plain response
      body: JSON.stringify({ message, stream: true })
    });

    if (!response.ok || !response.body) {
      // In some setups you might get JSON {"reply": "..."} (non-stream).
      // Try JSON fallback:
      let json = null;
      try { json = await response.json(); } catch (_) {}
      if (json && json.reply) {
        const { streamingDiv, wrapper } = createStreamingBotMessage();
        finalizeBotMarkdown(streamingDiv, json.reply);
        setStatus("");
        setStreamingUI(false);
        await checkPendingBookingAndRenderButton(wrapper);
        return;
      }

      appendBotError("Er ging iets mis tijdens het antwoorden.");
      setStatus("");
      setStreamingUI(false);
      return;
    }

    const { wrapper, streamingDiv } = createStreamingBotMessage();

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");

    let fullText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      fullText += chunk;

      // show plain text while streaming
      streamingDiv.textContent = fullText;
      scrollToBottom();
    }

    finalizeBotMarkdown(streamingDiv, fullText);
    setStatus("");
    setStreamingUI(false);

    // After message, check if chatbot prepared a booking
    await checkPendingBookingAndRenderButton(wrapper);

  } catch (err) {
    console.error(err);
    appendBotError("Netwerkfout. Probeer het opnieuw.");
    setStatus("");
    setStreamingUI(false);
  }
}

// ======================================
// 4) Pending booking (NEW response shape)
// ======================================
async function checkPendingBookingAndRenderButton(parentWrapper) {
  try {
    const resp = await fetch(`${API_BASE_CB}/chatbot/pending_booking`, {
      method: "GET",
      credentials: "include"
    });
    if (!resp.ok) return;

    const data = await resp.json();
    if (!data || !data.pending) return;

    // NEW: pending is nested object
    const pending = data.pending;
    const flight_id = pending.flight_id;
    const travel_date = pending.travel_date;

    if (!flight_id) return;

    const box = document.createElement("div");
    box.style.marginTop = "10px";
    box.className = "alert";

    const info = document.createElement("div");
    info.style.marginBottom = "10px";
    info.textContent = `De chatbot staat klaar om vlucht ${flight_id} te boeken${travel_date ? ` op ${travel_date}` : ""}. Bevestigen?`;

    const btnRow = document.createElement("div");
    btnRow.className = "row";

    // Confirm button
    const btnYes = document.createElement("button");
    btnYes.className = "btn btn-primary";
    btnYes.type = "button";
    btnYes.textContent = "✅ Bevestigen";

    // Cancel button
    const btnNo = document.createElement("button");
    btnNo.className = "btn btn-secondary";
    btnNo.type = "button";
    btnNo.textContent = "❌ Annuleren";

    btnYes.addEventListener("click", async () => {
      await confirmPendingBooking({ flight_id, confirm: true, btn: btnYes });
    });

    btnNo.addEventListener("click", async () => {
      await confirmPendingBooking({ flight_id, confirm: false, btn: btnNo });
    });

    btnRow.appendChild(btnYes);
    btnRow.appendChild(btnNo);

    box.appendChild(info);
    box.appendChild(btnRow);

    parentWrapper.appendChild(box);
    scrollToBottom();

  } catch (err) {
    console.error("Error checking pending booking:", err);
  }
}

async function confirmPendingBooking({ flight_id, confirm, btn }) {
  btn.disabled = true;
  setStatus(confirm ? "Boeking wordt verwerkt…" : "Boeking wordt geannuleerd…");

  try {
    // Recommended NEW endpoint:
    const resp = await fetch(`${API_BASE_CB}/chatbot/confirm_booking`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flight_id, confirm })
    });

    const data = await resp.json().catch(() => ({}));

    if (!resp.ok || data.success === false) {
      appendBotError(data.error || "Actie niet gelukt. Probeer het opnieuw.");
      btn.disabled = false;
      setStatus("");
      return;
    }

    // If confirm true: backend returns booking result JSON
    if (confirm) {
      const { bubble } = createMessage({ kind: "bot" });
      bubble.innerHTML = `<p style="margin:0;">Je vlucht is succesvol geboekt! 🎉 (flight_id: ${escapeHTML(flight_id)})</p>`;
    } else {
      const { bubble } = createMessage({ kind: "bot" });
      bubble.innerHTML = `<p style="margin:0;">Oké — boeking geannuleerd.</p>`;
    }

  } catch (err) {
    console.error(err);
    appendBotError("Netwerkfout tijdens bevestigen/annuleren.");
    btn.disabled = false;
  } finally {
    setStatus("");
  }
}

// ===============================
// 5) Speech-to-text (microfoon)
// ===============================
async function startSpeech() {
  if (speechRecognizer || isStreaming) return;

  setMicUI(true);

  try {
    const tokenResp = await fetch(`${API_BASE_CB}/julian/speech-token`, {
      method: "GET",
      credentials: "include"
    });

    if (!tokenResp.ok) {
      setStatus("Kan geen spraak-token ophalen.");
      setMicUI(false);
      return;
    }

    const { token, region } = await tokenResp.json();
    if (!token || !region) {
      setStatus("Ongeldig antwoord voor spraak-token.");
      setMicUI(false);
      return;
    }

    const SpeechSDK = window.SpeechSDK;
    if (!SpeechSDK) {
      setStatus("Speech SDK niet geladen.");
      setMicUI(false);
      return;
    }

    const speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(token, region);
    speechConfig.speechRecognitionLanguage = langSelect.value;

    const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
    speechRecognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);

    speechRecognizer.recognizeOnceAsync(
      (result) => {
        try {
          if (result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
            const text = result.text || "";
            userMsgBox.value += (userMsgBox.value ? " " : "") + text;
            setStatus(`Herkenning: ${text}`);
          } else if (result.reason === SpeechSDK.ResultReason.NoMatch) {
            setStatus("Geen spraak herkend.");
          } else {
            setStatus("Spraakherkenning gestopt.");
          }
        } finally {
          try { speechRecognizer.close(); } catch (e) {}
          speechRecognizer = null;
          setMicUI(false);
        }
      },
      (err) => {
        console.error("Speech recognition error:", err);
        setStatus("Fout bij spraakherkenning.");
        if (speechRecognizer) {
          try { speechRecognizer.close(); } catch (e) {}
          speechRecognizer = null;
        }
        setMicUI(false);
      }
    );

  } catch (err) {
    console.error("Speech setup error:", err);
    setStatus("Fout bij starten van spraakherkenning.");
    if (speechRecognizer) {
      try { speechRecognizer.close(); } catch (e) {}
      speechRecognizer = null;
    }
    setMicUI(false);
  }
}

function setMicUI(listening) {
  if (listening) {
    micBtn.classList.add("listening");
    micBtn.textContent = "Aan het luisteren…";
    micBtn.disabled = true;
  } else {
    micBtn.classList.remove("listening");
    micBtn.textContent = "🎤 Spreek";
    micBtn.disabled = false;
  }
}

// ===============================
// 6) Event listeners
// ===============================
sendBtn.addEventListener("click", sendMessage);

userMsgBox.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

clearBtn.addEventListener("click", () => {
  chatWindow.innerHTML = `
    <div class="chat-msg bot">
      <div class="who">🤖 Chatbot <span>•</span> <span>klaar</span></div>
      <div class="bubble">
        <p style="margin:0;">Waar kan ik je mee helpen? Bijvoorbeeld: “Zoek een vlucht naar Barcelona”, “Welke reizen heb ik binnenkort?” of “Boek die vlucht.”</p>
      </div>
    </div>
  `;
  setStatus("");
});

micBtn.addEventListener("click", startSpeech);