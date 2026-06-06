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
  const { headers: extraHeaders, ...rest } = options;
  const response = await fetch(path, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(extraHeaders || {}),
    },
  });

  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      if (body.detail) {
        detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
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

async function refreshAll() {
  clearAnswer();
  await loadCompanyContext();
  await loadMessages();
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
  } catch (error) {
    showToast(error.message, true);
  } finally {
    button.disabled = false;
  }
});

loadCompanies()
  .then(refreshAll)
  .catch((error) => showToast(error.message, true));
