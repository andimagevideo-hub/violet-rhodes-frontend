// Violet Rhodes Frontend - Per-user Memory + Voice Messages
const BACKEND_URL = "https://violet-rhodes-backend.onrender.com";

// Initialize userId for per-user memory
let userId = localStorage.getItem("violet_user_id");
if (!userId) {
  userId = crypto.randomUUID ? crypto.randomUUID() : "u_" + Date.now() + "_" + Math.random();
  localStorage.setItem("violet_user_id", userId);
}

let conversation = [];
let userMemory = null;

const messagesEl = document.getElementById("messages");
const inputEl = document.getElementById("chat-input");
const sendBtn = document.getElementById("send-btn");
const typingEl = document.getElementById("typing-indicator");
const statusEl = document.getElementById("chat-status");

// Load per-user memory on page load
window.addEventListener("load", async () => {
  await loadMemory();

  let greeting = "hey babe... i'm right here, what's on your mind? 💜";
  if (userMemory && userMemory.lastMessage) {
    greeting = "hey, you came back... still thinking about: " + userMemory.lastMessage + " ? 😌";
  }

  addMessage("violet", greeting);
});

sendBtn.addEventListener("click", sendMessage);
inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendMessage();
});

// Load per-user memory from backend
async function loadMemory() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/memory?userId=${encodeURIComponent(userId)}`);
    if (!res.ok) throw new Error("Failed to load memory");
    const data = await res.json();
    userMemory = data;
    return data;
  } catch (e) {
    console.error("loadMemory error:", e);
    userMemory = { lastInteraction: null, lastMessage: "", userProfile: {} };
    return userMemory;
  }
}

// Save per-user memory to backend
async function saveMemory() {
  if (!userMemory) return;
  try {
    await fetch(BACKEND_URL + "/api/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, memory: userMemory })
    });
  } catch (e) {
    console.error("saveMemory error:", e);
  }
}

// Add message bubble
function addMessage(sender, text) {
  const div = document.createElement("div");
  div.className = `message ${sender}`;
  div.textContent = text;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return div;
}

// Add media (image/video) to a message
function addMediaToMessage(container, media) {
  if (!media || !media.type || !media.src) return;

  if (media.type === "image") {
    const img = document.createElement("img");
    img.src = media.src;
    img.className = "violet-image";
    container.appendChild(img);
  }

  if (media.type === "video") {
    const vid = document.createElement("video");
    vid.src = media.src;
    vid.className = "violet-video";
    vid.controls = true;
    container.appendChild(vid);
  }

  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// Get best voice for Violet (female, English preferred)
function getVioletVoice() {
  const voices = window.speechSynthesis.getVoices();
  let chosen = voices.find(v => /female/i.test(v.name) && /en/i.test(v.lang));
  if (!chosen) chosen = voices.find(v => /en/i.test(v.lang));
  return chosen || voices[0];
}

// Play Violet's voice using Web Speech API
function playVioletVoice(text) {
  if (!("speechSynthesis" in window)) {
    console.warn("Voice not supported in this browser");
    return;
  }
  const utter = new SpeechSynthesisUtterance(text);
  const voice = getVioletVoice();
  if (voice) utter.voice = voice;
  utter.rate = 1.0;
  utter.pitch = 1.1;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
}

// Type out effect for human-like messaging
function typeOutMessage(sender, fullText, media) {
  const bubble = document.createElement("div");
  bubble.className = `message ${sender}`;
  messagesEl.appendChild(bubble);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  const textSpan = document.createElement("span");
  textSpan.className = "msg-text";
  bubble.appendChild(textSpan);

  // Add voice button for Violet messages
  if (sender === "violet") {
    const voiceBtn = document.createElement("button");
    voiceBtn.textContent = "🎧";
    voiceBtn.className = "voice-btn";
    voiceBtn.title = "Play voice";
    voiceBtn.onclick = () => playVioletVoice(fullText);
    bubble.appendChild(voiceBtn);
  }

  let i = 0;
  const minDelay = 15;
  const maxDelay = 40;

  function typeNext() {
    if (i >= fullText.length) {
      if (media) addMediaToMessage(bubble, media);
      return;
    }
    textSpan.textContent += fullText[i];
    i++;

    const delay = Math.random() * (maxDelay - minDelay) + minDelay;
    setTimeout(typeNext, delay);
  }

  typeNext();
}

// Show/hide typing indicator
function showTyping() {
  typingEl.classList.remove("hidden");
  statusEl.textContent = "typing...";
}

function hideTyping() {
  typingEl.classList.add("hidden");
  statusEl.textContent = "online ●";
}

// Send message to backend
async function sendMessage() {
  const text = inputEl.value.trim();
  if (!text) return;

  addMessage("user", text);
  conversation.push({ role: "user", content: text });
  inputEl.value = "";

  showTyping();

  try {
    const response = await fetch(BACKEND_URL + "/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, messages: conversation })
    });

    const data = await response.json();
    hideTyping();

    const replyText = data.reply || "mm... something glitched babe...";
    const media = data.media || null;
    typeOutMessage("violet", replyText, media);

    conversation.push({ role: "assistant", content: replyText });

    // Update and save per-user memory
    if (!userMemory) {
      userMemory = { lastInteraction: null, lastMessage: "", userProfile: {} };
    }
    userMemory.lastInteraction = Date.now();
    userMemory.lastMessage = replyText;
    saveMemory();

  } catch (err) {
    console.error(err);
    hideTyping();
    addMessage("violet", "ugh, my connection glitched... can you try again in a sec?");
  }
}

// Load voices on voices changed
window.speechSynthesis.onvoiceschanged = () => {
  getVioletVoice();
};
