// === chatbot.js (Streaming Version) ===

//const API_BASE_CB = "http://127.0.0.1:5001";
const API_BASE_CB = "https://ack2511-reisbureau-fdghe5emesfrbza5.swedencentral-01.azurewebsites.net/";

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
// 2) Message helpers
// ===============================

// Creates a new message div but returns the element
function createStreamingMessage(sender) {
    const div = document.createElement("div");
    div.style.marginBottom = "10px";
    div.innerHTML = `<strong>${sender}:</strong><br><div class="streaming-text"></div>`;
    chatWindow.appendChild(div);
    chatWindow.scrollTop = chatWindow.scrollHeight;
    return div;
}

function appendFinalMarkdown(messageElement, fullText) {
    // Replace the raw streaming text with parsed markdown
    messageElement.innerHTML = marked.parse(fullText);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}


// ===============================
// 3) Streaming Chat Function
// ===============================
async function sendMessage() {
    const message = userMsgBox.value.trim();
    if (!message) return;

    appendUserMessage(message);
    userMsgBox.value = "";
    statusText.textContent = "Chatbot denkt...";

    try {
        const response = await fetch(`${API_BASE_CB}/chatbot/query`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message })
        });

        if (!response.ok || !response.body) {
            appendBotMessage("(Fout tijdens streamen)");
            statusText.textContent = "";
            return;
        }

        // Create streaming message container
        const msgDiv = createStreamingMessage("Chatbot");
        const msgElem = msgDiv.querySelector(".streaming-text");

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");

        let fullText = "";
        let done, value;

        // Read streaming chunks
        while (true) {
            ({done, value} = await reader.read());
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            fullText += chunk;

            // Append chunk as plain text
            msgElem.textContent = fullText;

            chatWindow.scrollTop = chatWindow.scrollHeight;
        }

        // Once finished → markdown parse entire message
        appendFinalMarkdown(msgElem, fullText);
        statusText.textContent = "";

        if (msgDiv) {
            await checkPendingBookingAndRenderButton(msgDiv);
        }

    } catch (err) {
        console.error(err);
        appendBotMessage("(Netwerkfout)");
        statusText.textContent = "";
    }
}


// ===============================
// 4) Helpers for user and bot messages
// ===============================
function appendUserMessage(text) {
    const div = document.createElement("div");
    div.style.marginBottom = "10px";
    div.innerHTML = `<strong>Jij:</strong><br><div>${text}</div>`;
    chatWindow.appendChild(div);
    chatWindow.scrollTop = chatWindow.scrollHeight;
    return div;
}

function appendBotMessage(text) {
    const div = document.createElement("div");
    div.style.marginBottom = "10px";
    div.innerHTML = `<strong>Chatbot:</strong><br><div>${marked.parse(text)}</div>`;
    chatWindow.appendChild(div);
    chatWindow.scrollTop = chatWindow.scrollHeight;
    return div;
}

async function checkPendingBookingAndRenderButton(parentDiv) {
    try {
        console.log("Checking for pending booking...");
        const resp = await fetch(`${API_BASE}/chatbot/pending_booking`, {
            method: "GET",
            credentials: "include"
        });
        console.log("Pending booking response:", resp);
        if (!resp.ok) return;
        const data = await resp.json();
        console.log("Pending booking data received:", data);
        if (!data.pending) return;
        console.log("Pending booking data:", data);
        const { flight_id, travel_date } = data;

        // Create a small container under the chatbot message
        const box = document.createElement("div");
        box.style.marginTop = "6px";
        box.style.fontSize = "0.9rem";

        const info = document.createElement("span");
        info.textContent = `De chatbot stelt voor vlucht ${flight_id} op ${travel_date || "(datum uit schema)"} te boeken. `;

        const btn = document.createElement("button");
        btn.textContent = "Boek deze vlucht";
        btn.style.marginLeft = "6px";

        btn.addEventListener("click", async () => {
            btn.disabled = true;
            btn.textContent = "Bezig met boeken...";

            try {
                const resp2 = await fetch(`${API_BASE}/chatbot/book_trip`, {
                    method: "POST",
                    credentials: "include"
                });
                const data2 = await resp2.json();

                if (!resp2.ok || !data2.success) {
                    appendBotMessage("Er ging iets mis bij het boeken van de vlucht.");
                } else {
                    appendBotMessage("Je vlucht is succesvol geboekt! 🎉");
                }
            } catch (err) {
                console.error(err);
                appendBotMessage("Er trad een netwerkfout op tijdens het boeken.");
            } finally {
                btn.disabled = true;
                btn.textContent = "Geboekt";
            }
        });

        box.appendChild(info);
        box.appendChild(btn);

        parentDiv.appendChild(box);
    } catch (err) {
        console.error("Error checking pending booking:", err);
    }
}

// ===============================
// 5) Speech-to-text
// ===============================
async function startSpeech() {
    statusText.textContent = "";
    micBtn.disabled = true;

    try {
        const tokenResp = await fetch(`${API_BASE_CB}/julian/speech-token`, {
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
// 6) Event Listeners
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