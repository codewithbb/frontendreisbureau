// === chatbot.js ===

const API_BASE = "http://127.0.0.1:5001";

let speechRecognizer = null;

// DOM elements
const loggedOutBox = document.getElementById("chatbot-logged-out");
const chatbotUI = document.getElementById("chatbot-ui");
const chatWindow = document.getElementById("chat-window");
const userMsgBox = document.getElementById("user-message");

const sendBtn = document.getElementById("chatbot-send");
const clearBtn = document.getElementById("chatbot-clear");
const micBtn = document.getElementById("chatbot-mic");
const langSelect = document.getElementById("chatbot-lang");

const statusText = document.getElementById("chatbot-status");


// ===============================
// 1) Check login via session.js
// ===============================
document.addEventListener("DOMContentLoaded", async () => {
    const {loggedIn, user} = await getCurrentSession();

    if (!loggedIn) {
        loggedOutBox.style.display = "block";
        chatbotUI.style.display = "none";
        return;
    }

    chatbotUI.style.display = "block";
    loggedOutBox.style.display = "none";
});


// ===============================
// 2) Chat Window Helpers
// ===============================
function appendMessage(sender, text) {
    const div = document.createElement("div");
    div.style.marginBottom = "10px";

    div.innerHTML = `
        <strong>${sender}:</strong><br>
        <div>${text}</div>
    `;

    chatWindow.appendChild(div);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}


// ===============================
// 3) Send message to backend
// ===============================
async function sendMessage() {
    const message = userMsgBox.value.trim();
    if (!message) return;

    appendMessage("Jij", message);
    userMsgBox.value = "";
    statusText.textContent = "Chatbot denkt...";

    try {
        const resp = await fetch(`${API_BASE}/chatbot/query`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message })
        });

        const data = await resp.json();
        if (!resp.ok || !data.reply) {
            appendMessage("Chatbot", "(Fout bij ophalen antwoord)");
            statusText.textContent = "";
            return;
        }

        appendMessage("Chatbot", data.reply);
        statusText.textContent = "";

    } catch (err) {
        console.error(err);
        appendMessage("Chatbot", "(Netwerkfout)");
        statusText.textContent = "";
    }
}


// ===============================
// 4) Speech-to-text
// ===============================
async function startSpeech() {
    statusText.textContent = "";
    micBtn.disabled = true;

    try {
        // Fetch Azure token + region
        const tokenResp = await fetch(`${API_BASE}/julian/speech-token`, {
            method: "GET",
            credentials: "include"
        });

        const { token, region } = await tokenResp.json();
        if (!token) {
            statusText.textContent = "Kan geen spraak-token ophalen.";
            micBtn.disabled = false;
            return;
        }

        const SpeechSDK = window.SpeechSDK;
        const speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(token, region);
        speechConfig.speechRecognitionLanguage = langSelect.value;

        const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
        speechRecognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);

        statusText.textContent = "Luisteren...";

        speechRecognizer.recognizeOnceAsync(result => {
            if (result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
                const text = result.text || "";
                userMsgBox.value += (userMsgBox.value ? " " : "") + text;
                statusText.textContent = "Herkenning: " + text;
            } else {
                statusText.textContent = "Geen spraak herkend.";
            }

            speechRecognizer.close();
            speechRecognizer = null;
            micBtn.disabled = false;
        });

    } catch (err) {
        console.error(err);
        statusText.textContent = "Fout bij spraakherkenning.";
        micBtn.disabled = false;
    }
}


// ===============================
// 5) Event Listeners
// ===============================
sendBtn.addEventListener("click", sendMessage);

userMsgBox.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

clearBtn.addEventListener("click", () => {
    chatWindow.innerHTML = "";
});

micBtn.addEventListener("click", startSpeech);
