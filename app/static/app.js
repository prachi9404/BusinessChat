const companySelect = document.getElementById("company-select");
const userSelect = document.getElementById("user-select");
const companyBanner = document.getElementById("company-banner");
const messagesList = document.getElementById("messages-list");
const messageForm = document.getElementById("message-form");
const messageInput = document.getElementById("message-input");
const askForm = document.getElementById("ask-form");
const questionInput = document.getElementById("question-input");
const answerBox = document.getElementById("answer-box");
const answerText = document.getElementById("answer-text");
const answerModel = document.getElementById("answer-model");
const answerLogId = document.getElementById("answer-log-id");
const sourcesBox = document.getElementById("sources-box");
const sourcesList = document.getElementById("sources-list");
const qaHistoryList = document.getElementById("qa-history-list");
const qaDebugBox = document.getElementById("qa-debug-box");
const qaDebugQuestion = document.getElementById("qa-debug-question");
const qaDebugPrompt = document.getElementById("qa-debug-prompt");
const qaDebugRetrieval = document.getElementById("qa-debug-retrieval");
const toast = document.getElementById("toast");

let companies = [];
let currentCompany = null;

function showToast(message, isError = false) {
  toast.textContent = message;
  toast.classList.toggle("error", isError);
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 3500);
}

function companyHeaders() {
  return { "X-Company-Slug": companySelect.value };
}

async function api(path, options = {}) {
  const { headers: extraHeaders, body, ...rest } = options;
  const headers = { ...(extraHeaders || {}) };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(path, {
    ...rest,
    body,
    headers,
  });

  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const payload = await response.json();
      if (payload.detail) {
        if (typeof payload.detail === "string") {
          detail = payload.detail;
        } else if (Array.isArray(payload.detail)) {
          detail = payload.detail.map((item) => item.msg).join("; ");
        } else {
          detail = JSON.stringify(payload.detail);
        }
      }
    } catch (_) {
      /* ignore */
    }
    throw new Error(detail);
  }

  if (response.status === 204) return null;
  return response.json();
}

function formatDate(value) {
  return new Date(value).toLocaleString();
}

async function loadCompanies() {
  companies = await api("/companies");
  companySelect.innerHTML = companies
    .map((company) => `<option value="${company.slug}">${company.name}</option>`)
    .join("");
}

async function loadCompanyContext() {
  currentCompany = await api("/companies/me", { headers: companyHeaders() });

  companyBanner.textContent = `${currentCompany.name} · ${currentCompany.industry} · ${currentCompany.description || ""}`;
  companyBanner.classList.remove("hidden");

  userSelect.innerHTML = currentCompany.users
    .map(
      (user) =>
        `<option value="${user.id}">${user.name} (${user.role})</option>`
    )
    .join("");
}

async function loadMessages() {
  const messages = await api("/messages?limit=30", { headers: companyHeaders() });

  if (!messages.length) {
    messagesList.innerHTML = '<p class="empty-state">No updates yet. Post the first one.</p>';
    return;
  }

  messagesList.innerHTML = messages
    .map(
      (message) => `
        <article class="message-card">
          <header>
            <strong>${message.author_name}</strong>
            <time>${formatDate(message.created_at)}</time>
          </header>
          <p>${escapeHtml(message.content)}</p>
        </article>
      `
    )
    .join("");
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function clearAnswer() {
  answerBox.classList.add("hidden");
  sourcesBox.classList.add("hidden");
  answerText.textContent = "";
  sourcesList.innerHTML = "";
}

async function loadQaHistory() {
  const history = await api("/qa?limit=15", { headers: companyHeaders() });

  if (!history.length) {
    qaHistoryList.innerHTML = '<p class="empty-state">No questions asked yet for this company.</p>';
    qaDebugBox.classList.add("hidden");
    return;
  }

  qaHistoryList.innerHTML = history
    .map(
      (entry) => `
        <article class="history-card" data-qa-id="${entry.id}">
          <h4>${escapeHtml(entry.question)}</h4>
          <p>${escapeHtml(entry.answer_preview)}</p>
          <footer class="meta">${formatDate(entry.created_at)} · ${entry.source_count} sources · ${entry.model_used}</footer>
        </article>
      `
    )
    .join("");

  qaHistoryList.querySelectorAll(".history-card").forEach((card) => {
    card.addEventListener("click", () => {
      qaHistoryList.querySelectorAll(".history-card").forEach((item) => item.classList.remove("active"));
      card.classList.add("active");
      loadQaDebug(card.dataset.qaId).catch((error) => showToast(error.message, true));
    });
  });
}

async function loadQaDebug(qaLogId) {
  const debug = await api(`/qa/${qaLogId}/debug`, { headers: companyHeaders() });

  qaDebugQuestion.textContent = `Question: ${debug.question}`;
  qaDebugPrompt.textContent = debug.prompt_context || "(Prompt context not stored for this older entry)";
  qaDebugRetrieval.innerHTML = (debug.retrieval_snapshot || [])
    .map(
      (item) => `
        <article class="source-card">
          <header>
            <strong>${escapeHtml(item.author_name)}</strong>
            <span class="similarity">${Math.round((item.similarity || 0) * 100)}% match</span>
          </header>
          <p>${escapeHtml(item.content)}</p>
        </article>
      `
    )
    .join("");
  qaDebugBox.classList.remove("hidden");
}

async function refreshAll() {
  clearAnswer();
  qaDebugBox.classList.add("hidden");
  await loadCompanyContext();
  await loadMessages();
  await loadQaHistory();
}

companySelect.addEventListener("change", () => {
  refreshAll().catch((error) => showToast(error.message, true));
});

messageForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = messageForm.querySelector("button");
  button.disabled = true;

  try {
    await api("/messages", {
      method: "POST",
      headers: {
        ...companyHeaders(),
        "X-User-Id": userSelect.value,
      },
      body: JSON.stringify({ content: messageInput.value.trim() }),
    });
    messageInput.value = "";
    await loadMessages();
    showToast("Update posted");
  } catch (error) {
    showToast(error.message, true);
  } finally {
    button.disabled = false;
  }
});

askForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = askForm.querySelector("button");
  button.disabled = true;

  try {
    const result = await api("/ask", {
      method: "POST",
      headers: companyHeaders(),
      body: JSON.stringify({
        question: questionInput.value.trim(),
        limit: 8,
      }),
    });

    answerText.textContent = result.answer;
    answerModel.textContent = `Model: ${result.model_used}`;
    answerLogId.textContent = `Audit ID: ${result.qa_log_id}`;
    answerBox.classList.remove("hidden");

    if (result.sources?.length) {
      sourcesList.innerHTML = result.sources
        .map(
          (source) => `
            <article class="source-card">
              <header>
                <strong>${escapeHtml(source.author_name)}</strong>
                <span class="similarity">${Math.round(source.similarity * 100)}% match</span>
              </header>
              <p>${escapeHtml(source.content)}</p>
              <footer class="meta">${formatDate(source.created_at)}</footer>
            </article>
          `
        )
        .join("");
      sourcesBox.classList.remove("hidden");
    } else {
      sourcesBox.classList.add("hidden");
    }

    await loadQaHistory();
  } catch (error) {
    showToast(error.message, true);
  } finally {
    button.disabled = false;
  }
});

loadCompanies()
  .then(refreshAll)
  .catch((error) => showToast(error.message, true));
