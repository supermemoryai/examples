// Personal Knowledge Base — client-side logic.
// Minimal vanilla JS: fetch + ReadableStream-based SSE parsing, no deps.

const chatHistory = []; // [{ role: "user" | "assistant", content: string }]

const $ = (sel) => document.querySelector(sel);
const noteListEl = $("#note-list");
const messagesEl = $("#messages");
const composerEl = $("#composer");
const inputEl = $("#message-input");
const sendBtn = $("#send-btn");
const addModal = $("#add-modal");
const viewModal = $("#view-modal");
const addForm = $("#add-note-form");

// ---------------------------------------------------------------- Notes API

async function loadNotes() {
  try {
    const res = await fetch("/api/notes");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    renderNotes(data.notes || []);
  } catch (err) {
    noteListEl.innerHTML = `<li class="note-empty">Failed to load notes</li>`;
    console.error(err);
  }
}

function renderNotes(notes) {
  if (!notes.length) {
    noteListEl.innerHTML = `<li class="note-empty">No notes yet. Add one to get started.</li>`;
    return;
  }
  noteListEl.innerHTML = "";
  for (const filename of notes) {
    const li = document.createElement("li");
    li.className = "note-item";
    li.title = "Click to view";

    const title = document.createElement("span");
    title.className = "note-item-title";
    title.textContent = filename.replace(/\.md$/, "");

    const del = document.createElement("button");
    del.className = "note-delete";
    del.textContent = "✕";
    del.title = "Delete note";
    del.setAttribute("aria-label", `Delete ${filename}`);
    del.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteNote(filename);
    });

    li.addEventListener("click", () => viewNote(filename));
    li.append(title, del);
    noteListEl.appendChild(li);
  }
}

async function addNote(title, content) {
  const res = await fetch("/api/notes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, content }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  await loadNotes();
}

async function deleteNote(filename) {
  if (!confirm(`Delete "${filename}"?`)) return;
  try {
    const res = await fetch(`/api/notes/${encodeURIComponent(filename)}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await loadNotes();
  } catch (err) {
    alert(`Failed to delete: ${err.message}`);
  }
}

async function viewNote(filename) {
  try {
    const res = await fetch(`/api/notes/${encodeURIComponent(filename)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    $("#view-title").textContent = filename;
    $("#view-content").textContent = data.content || "(empty)";
    openModal(viewModal);
  } catch (err) {
    alert(`Failed to load note: ${err.message}`);
  }
}

// ---------------------------------------------------------------- Modals

function openModal(modal) { modal.hidden = false; }
function closeModal(modal) { modal.hidden = true; }

document.querySelectorAll("[data-close-modal]").forEach((el) => {
  el.addEventListener("click", () => {
    closeModal(el.closest(".modal"));
  });
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeModal(addModal);
    closeModal(viewModal);
  }
});

$("#add-note-btn").addEventListener("click", () => {
  $("#note-title").value = "";
  $("#note-content").value = "";
  openModal(addModal);
  setTimeout(() => $("#note-title").focus(), 30);
});

addForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = $("#note-title").value.trim();
  const content = $("#note-content").value;
  const submitBtn = addForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  try {
    await addNote(title, content);
    closeModal(addModal);
  } catch (err) {
    alert(`Failed to save: ${err.message}`);
  } finally {
    submitBtn.disabled = false;
  }
});

// ---------------------------------------------------------------- Chat / SSE

function scrollChat() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function appendUserMessage(text) {
  const wrap = document.createElement("div");
  wrap.className = "message message-user";
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;
  wrap.appendChild(bubble);
  messagesEl.appendChild(wrap);
  scrollChat();
}

function createAssistantMessage() {
  const wrap = document.createElement("div");
  wrap.className = "message message-assistant";
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  wrap.appendChild(bubble);
  messagesEl.appendChild(wrap);
  scrollChat();

  // Track the live text bubble + any tool blocks appended afterwards.
  let currentBubble = bubble;
  let textBuffer = "";

  return {
    addText(chunk) {
      if (!currentBubble) {
        currentBubble = document.createElement("div");
        currentBubble.className = "bubble";
        wrap.appendChild(currentBubble);
        textBuffer = "";
      }
      textBuffer += chunk;
      currentBubble.textContent = textBuffer;
      scrollChat();
    },
    addToolCall(cmd) {
      // After a tool call, any new text starts a fresh bubble.
      currentBubble = null;

      const details = document.createElement("details");
      details.className = "tool-call";
      const summary = document.createElement("summary");
      const code = document.createElement("span");
      code.className = "tool-cmd";
      code.textContent = `$ ${cmd}`;
      summary.appendChild(code);
      details.appendChild(summary);

      const result = document.createElement("div");
      result.className = "tool-result pending";
      result.textContent = "running…";
      details.appendChild(result);

      wrap.appendChild(details);
      scrollChat();
      return result;
    },
    addError(msg) {
      currentBubble = null;
      const err = document.createElement("div");
      err.className = "tool-error";
      err.textContent = `Error: ${msg}`;
      wrap.appendChild(err);
      scrollChat();
    },
    getFinalText() {
      // Return concatenation of all bubble text (best-effort for history).
      return Array.from(wrap.querySelectorAll(".bubble"))
        .map((b) => b.textContent)
        .join("\n")
        .trim();
    },
  };
}

async function sendMessage(message) {
  appendUserMessage(message);
  chatHistory.push({ role: "user", content: message });

  const view = createAssistantMessage();
  let pendingToolResult = null;

  let response;
  try {
    response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history: chatHistory.slice(0, -1) }),
    });
  } catch (err) {
    view.addError(err.message);
    return;
  }

  if (!response.ok || !response.body) {
    view.addError(`HTTP ${response.status}`);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const handleEvent = (event, dataStr) => {
    let data = {};
    try { data = JSON.parse(dataStr); } catch { /* keep empty */ }

    if (event === "text") {
      view.addText(data.content || "");
    } else if (event === "tool_call") {
      const cmd = (data.input && data.input.cmd) || "";
      pendingToolResult = view.addToolCall(cmd);
    } else if (event === "tool_result") {
      if (pendingToolResult) {
        pendingToolResult.classList.remove("pending");
        pendingToolResult.textContent = data.output || "(no output)";
        pendingToolResult = null;
        scrollChat();
      }
    } else if (event === "error") {
      view.addError(data.message || "unknown error");
    } else if (event === "done") {
      const finalText = view.getFinalText();
      if (finalText) {
        chatHistory.push({ role: "assistant", content: finalText });
      }
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE messages are separated by a blank line.
    let sep;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const raw = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      let event = "message";
      const dataLines = [];
      for (const line of raw.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
      }
      handleEvent(event, dataLines.join("\n"));
    }
  }
}

composerEl.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = inputEl.value.trim();
  if (!text) return;
  inputEl.value = "";
  inputEl.style.height = "auto";

  // Remove welcome card on first message.
  const welcome = messagesEl.querySelector(".welcome");
  if (welcome) welcome.remove();

  sendBtn.disabled = true;
  inputEl.disabled = true;
  try {
    await sendMessage(text);
  } finally {
    sendBtn.disabled = false;
    inputEl.disabled = false;
    inputEl.focus();
  }
});

// Auto-grow textarea, and submit on Enter (Shift+Enter = newline).
inputEl.addEventListener("input", () => {
  inputEl.style.height = "auto";
  inputEl.style.height = Math.min(inputEl.scrollHeight, 200) + "px";
});
inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    composerEl.requestSubmit();
  }
});

// Mobile sidebar toggle
const toggleBtn = $("#toggle-sidebar");
if (toggleBtn) {
  toggleBtn.addEventListener("click", () => {
    $("#sidebar").classList.toggle("open");
  });
}

// ---------------------------------------------------------------- Init
loadNotes();
