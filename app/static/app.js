const companyTitle = document.getElementById("company-title");
const companyMeta = document.getElementById("company-meta");
const sessionInfo = document.getElementById("session-info");
const logoutBtn = document.getElementById("logout-btn");
const appNav = document.getElementById("app-nav");
const postingAs = document.getElementById("posting-as");
const messagesList = document.getElementById("messages-list");
const messageForm = document.getElementById("message-form");
const messageInput = document.getElementById("message-input");
const askStage = document.getElementById("ask-stage");
const askEmpty = document.getElementById("ask-empty");
const askConversation = document.getElementById("ask-conversation");
const askQuestionDisplay = document.getElementById("ask-question-display");
const askForm = document.getElementById("ask-form");
const questionInput = document.getElementById("question-input");
const answerText = document.getElementById("answer-text");
const sourcesDetails = document.getElementById("sources-details");
const sourcesSummary = document.getElementById("sources-summary");
const sourcesList = document.getElementById("sources-list");
const qaHistoryList = document.getElementById("qa-history-list");
const historyDrawer = document.getElementById("history-drawer");
const qaDebugDetails = document.getElementById("qa-debug-details");
const qaDebugQuestion = document.getElementById("qa-debug-question");
const qaDebugPrompt = document.getElementById("qa-debug-prompt");
const qaDebugRetrieval = document.getElementById("qa-debug-retrieval");
const createUserForm = document.getElementById("create-user-form");
const managedUsersList = document.getElementById("managed-users-list");
const teamCount = document.getElementById("team-count");
const loginSnippet = document.getElementById("login-snippet");
const loginSnippetText = document.getElementById("login-snippet-text");
const copyLoginSnippetBtn = document.getElementById("copy-login-snippet");
const editMemberDialog = document.getElementById("edit-member-dialog");
const editUserForm = document.getElementById("edit-user-form");
const editDialogClose = document.getElementById("edit-dialog-close");
const editDialogCancel = document.getElementById("edit-dialog-cancel");
const resetPasswordDialog = document.getElementById("reset-password-dialog");
const resetPasswordForm = document.getElementById("reset-password-form");
const resetPasswordTitle = document.getElementById("reset-password-title");
const resetPasswordValue = document.getElementById("reset-password-value");
const resetPasswordGenerate = document.getElementById("reset-password-generate");
const resetDialogClose = document.getElementById("reset-dialog-close");
const resetDialogCancel = document.getElementById("reset-dialog-cancel");

const CREDENTIALS_STORAGE_KEY = "businesschat_member_credentials";
const toast = document.getElementById("toast");
const messageFeedback = document.getElementById("message-feedback");
const inviteFeedback = document.getElementById("invite-feedback");
const askLoading = document.getElementById("ask-loading");
const askLoadingText = document.getElementById("ask-loading-text");

const views = {
  updates: document.getElementById("view-updates"),
  ask: document.getElementById("view-ask"),
  team: document.getElementById("view-team"),
};

let session = null;
let activeQaId = null;
const teamUsersById = new Map();
const memberCredentials = new Map();

function loadStoredCredentials() {
  try {
    const stored = JSON.parse(sessionStorage.getItem(CREDENTIALS_STORAGE_KEY) || "{}");
    Object.entries(stored).forEach(([userId, password]) => {
      memberCredentials.set(userId, password);
    });
  } catch (_) {
    /* ignore */
  }
}

loadStoredCredentials();

function getToken() {
  return localStorage.getItem("access_token");
}

function redirectToLogin() {
  localStorage.removeItem("access_token");
  window.location.href = "/login";
}

if (!getToken()) {
  redirectToLogin();
}

function friendlyError(message) {
  const map = {
    "Invalid email or password": "That email or password doesn't match. Please try again.",
    "Session expired": "You've been signed out. Please sign in again.",
    "Not authenticated": "Please sign in to continue.",
    "Admin access required": "You don't have permission to do that.",
    "This email is already registered to another account.":
      "That email is already in use. Try a different one.",
    "This email is already registered. Sign in or contact your company admin.":
      "That email is already registered. Sign in instead, or ask your admin for access.",
    "User not found": "We couldn't find that person.",
    "No fields to update": "Nothing to save — change a field first.",
  };

  if (map[message]) return map[message];
  if (message.startsWith("Request failed")) return "Something went wrong. Please try again.";
  return message;
}

function showToast(message, isError = false) {
  toast.textContent = isError ? friendlyError(message) : message;
  toast.classList.toggle("error", isError);
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 3500);
}

function authHeaders() {
  return { Authorization: `Bearer ${getToken()}` };
}

async function api(path, options = {}) {
  const { headers: extraHeaders, body, ...rest } = options;
  const headers = { ...(extraHeaders || {}), ...authHeaders() };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(path, {
    ...rest,
    body,
    headers,
  });

  if (response.status === 401) {
    redirectToLogin();
    throw new Error("Session expired");
  }

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

function formatRelativeTime(value) {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const seconds = Math.floor(diffMs / 1000);

  if (seconds < 45) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function timeTag(value) {
  const relative = formatRelativeTime(value);
  const full = formatDate(value);
  return `<time datetime="${new Date(value).toISOString()}" title="${escapeHtml(full)}">${relative}</time>`;
}

let inlineFeedbackTimer = null;

function showInlineFeedback(element, message, { error = false, timeout = 4000 } = {}) {
  if (!element) return;
  if (inlineFeedbackTimer) clearTimeout(inlineFeedbackTimer);

  element.textContent = message;
  element.classList.toggle("is-error", error);
  element.classList.remove("hidden");

  inlineFeedbackTimer = setTimeout(() => {
    element.classList.add("hidden");
  }, timeout);
}

function setButtonLoading(button, loading, loadingLabel) {
  if (!button) return;
  if (!button.dataset.defaultLabel) {
    button.dataset.defaultLabel = button.textContent.trim();
  }
  button.disabled = loading;
  button.classList.toggle("is-loading", loading);
  button.textContent = loading ? loadingLabel : button.dataset.defaultLabel;
}

function setFieldError(input, message) {
  const group =
    input.closest(".field-group") ||
    input.closest(".composer") ||
    input.closest(".ask-input-shell");
  if (!group) return;

  let errorEl = group.querySelector(".field-error");
  if (!errorEl) {
    errorEl = document.createElement("p");
    errorEl.className = "field-error";
    group.appendChild(errorEl);
  }

  errorEl.textContent = message || "";
  input.classList.toggle("input-invalid", Boolean(message));
  input.setAttribute("aria-invalid", message ? "true" : "false");
}

function clearFormErrors(form) {
  form.querySelectorAll(".field-error").forEach((el) => {
    el.textContent = "";
  });
  form.querySelectorAll(".input-invalid").forEach((el) => {
    el.classList.remove("input-invalid");
    el.setAttribute("aria-invalid", "false");
  });
}

function validateInviteForm() {
  clearFormErrors(createUserForm);
  let valid = true;

  const name = document.getElementById("new-user-name");
  const email = document.getElementById("new-user-email");
  const password = document.getElementById("new-user-password");

  if (!name.value.trim()) {
    setFieldError(name, "Enter a name.");
    valid = false;
  }
  if (!email.value.trim()) {
    setFieldError(email, "Enter an email address.");
    valid = false;
  } else if (!email.value.includes("@")) {
    setFieldError(email, "Enter a valid email address.");
    valid = false;
  }
  if (!password.value || password.value.length < 6) {
    setFieldError(password, "Password must be at least 6 characters.");
    valid = false;
  }

  return valid;
}

function showAskLoading(message = "Looking through team updates…") {
  askLoadingText.textContent = message;
  askLoading.classList.remove("hidden");
  answerText.classList.add("hidden");
  sourcesDetails.classList.add("hidden");
}

function hideAskLoading() {
  askLoading.classList.add("hidden");
  answerText.classList.remove("hidden");
}

function roleLabel(role) {
  return role === "owner" ? "Admin" : "Member";
}

function getInitials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function formatTeamCount(count) {
  if (!count) return "No one on your team yet";
  return `${count} ${count === 1 ? "person" : "people"}`;
}

function emptyStateCard(icon, title, message) {
  return `
    <div class="empty-state-card">
      <div class="empty-state-icon" aria-hidden="true">${icon}</div>
      <p class="empty-state-title">${title}</p>
      <p class="empty-state-text">${message}</p>
    </div>
  `;
}

function loginPageUrl() {
  return `${window.location.origin}/login`;
}

function buildLoginSnippet(email, password) {
  return [
    "Sign in to BusinessChat",
    "",
    `Sign-in page: ${loginPageUrl()}`,
    `Email: ${email}`,
    `Password: ${password}`,
  ].join("\n");
}

function generateTempPassword() {
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `Welcome${suffix}!`;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast("Copied to clipboard");
  } catch (_) {
    showToast("Couldn't copy automatically — select the text and copy it yourself.", true);
  }
}

function showLoginSnippet(email, password) {
  loginSnippetText.textContent = buildLoginSnippet(email, password);
  loginSnippet.classList.remove("hidden");
}

function cacheMemberPassword(userId, password) {
  if (!password) return;
  memberCredentials.set(userId, password);
  sessionStorage.setItem(
    CREDENTIALS_STORAGE_KEY,
    JSON.stringify(Object.fromEntries(memberCredentials))
  );
}

function openResetPasswordDialog(userId) {
  const user = teamUsersById.get(userId);
  if (!user) return;

  document.getElementById("reset-user-id").value = userId;
  resetPasswordTitle.textContent = `New password for ${user.name}`;
  resetPasswordValue.value = generateTempPassword();
  resetPasswordDialog.showModal();
}

function closeResetPasswordDialog() {
  resetPasswordDialog.close();
}

async function saveMemberPassword(userId, password) {
  const updated = await api(`/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify({ password }),
  });

  cacheMemberPassword(userId, password);
  showLoginSnippet(updated.email, password);
  await copyText(buildLoginSnippet(updated.email, password));

  if (String(updated.id) === String(session.user.id)) {
    await loadSession();
  }

  return updated;
}

function openEditDialog(userId) {
  const user = teamUsersById.get(userId);
  if (!user) return;

  document.getElementById("edit-user-id").value = userId;
  document.getElementById("edit-user-name").value = user.name;
  document.getElementById("edit-user-email").value = user.email;
  document.getElementById("edit-user-password").value = "";
  editMemberDialog.showModal();
}

function closeEditDialog() {
  editMemberDialog.close();
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function showView(viewName) {
  Object.entries(views).forEach(([name, element]) => {
    element.classList.toggle("hidden", name !== viewName);
    element.classList.toggle("view-active", name === viewName);
  });

  appNav.querySelectorAll(".nav-link").forEach((link) => {
    link.classList.toggle("active", link.dataset.view === viewName);
  });

  document.body.classList.toggle("ask-focus-layout", viewName === "ask" && session?.user?.is_admin);
}

function setupNavigation() {
  const isAdmin = session.user.is_admin;

  if (isAdmin) {
    document.body.classList.add("admin-layout");
    document.body.classList.remove("member-layout");
    appNav.classList.remove("hidden");
    appNav.querySelectorAll(".nav-link").forEach((link) => {
      link.addEventListener("click", () => showView(link.dataset.view));
    });
    showView("ask");
  } else {
    document.body.classList.add("member-layout");
    document.body.classList.remove("admin-layout", "ask-focus-layout");
    appNav.classList.add("hidden");
    showView("updates");
  }
}

function setAskConversationMode(hasConversation) {
  askStage.classList.toggle("has-conversation", hasConversation);
  askEmpty.classList.toggle("hidden", hasConversation);
  askConversation.classList.toggle("hidden", !hasConversation);
}

function renderSourcesCards(items, useCreatedAt = false) {
  if (!items?.length) {
    sourcesDetails.classList.add("hidden");
    sourcesDetails.open = false;
    sourcesList.innerHTML = "";
    return;
  }

  sourcesList.innerHTML = items
    .map((item) => {
      const author = escapeHtml(item.author_name);
      const content = escapeHtml(item.content);
      const similarity = Math.round((item.similarity || 0) * 100);
      const dateFooter = item.created_at ? `<footer class="meta">${timeTag(item.created_at)}</footer>` : "";

      return `
        <article class="source-card">
          <header>
            <strong>${author}</strong>
            <span class="similarity">${similarity}% relevant</span>
          </header>
          <p>${content}</p>
          ${dateFooter}
        </article>
      `;
    })
    .join("");

  const count = items.length;
  sourcesSummary.textContent = `View ${count} related update${count === 1 ? "" : "s"}`;
  sourcesDetails.open = false;
  sourcesDetails.classList.remove("hidden");
}

function showAnswer(question, answer) {
  hideAskLoading();
  askQuestionDisplay.textContent = question;
  answerText.textContent = answer;
  setAskConversationMode(true);
}

function clearAnswer() {
  hideAskLoading();
  askQuestionDisplay.textContent = "";
  answerText.textContent = "";
  sourcesDetails.classList.add("hidden");
  sourcesDetails.open = false;
  sourcesList.innerHTML = "";
  setAskConversationMode(false);
}

function setActiveHistoryCard(qaLogId) {
  qaHistoryList.querySelectorAll(".history-card").forEach((card) => {
    card.classList.toggle("active", card.dataset.qaId === qaLogId);
  });
}

async function loadSession() {
  session = await api("/auth/me");

  companyTitle.textContent = session.company.name;
  companyMeta.textContent = [session.company.industry, session.company.description]
    .filter(Boolean)
    .join(" · ");

  sessionInfo.innerHTML = `
    <strong title="${escapeHtml(session.user.name)}">${escapeHtml(session.user.name)}</strong>
    <span class="role-badge ${session.user.is_admin ? "role-admin" : "role-user"}">${roleLabel(session.user.role)}</span>
  `;

  postingAs.textContent = session.user.is_admin
    ? "Post daily updates from the floor, field, or desk."
    : `Signed in as ${session.user.name}`;
  setupNavigation();
}

async function loadMessages() {
  const messages = await api("/messages?limit=30");

  if (!messages.length) {
    messagesList.innerHTML = emptyStateCard(
      "+",
      "No updates yet",
      "Share the first one — even a quick note helps your team stay aligned."
    );
    return;
  }

  messagesList.innerHTML = messages
    .map(
      (message) => `
        <article class="message-card">
          <div class="message-avatar" aria-hidden="true">${escapeHtml(getInitials(message.author_name))}</div>
          <div class="message-body">
            <header>
              <strong>${escapeHtml(message.author_name)}</strong>
              ${timeTag(message.created_at)}
            </header>
            <p>${escapeHtml(message.content)}</p>
          </div>
        </article>
      `
    )
    .join("");
}

async function loadQaHistory() {
  if (!session.user.is_admin) return;

  const history = await api("/qa?limit=15");

  if (!history.length) {
    qaHistoryList.innerHTML = emptyStateCard(
      "?",
      "No questions yet",
      "Ask something above to get answers from your team's updates."
    );
    return;
  }

  qaHistoryList.innerHTML = history
    .map(
      (entry) => `
        <article class="history-card" data-qa-id="${entry.id}">
          <h4>${escapeHtml(entry.question)}</h4>
          <p>${escapeHtml(entry.answer_preview)}</p>
          <footer class="meta">${timeTag(entry.created_at)} · ${entry.source_count} update${entry.source_count === 1 ? "" : "s"} cited</footer>
        </article>
      `
    )
    .join("");

  qaHistoryList.querySelectorAll(".history-card").forEach((card) => {
    card.addEventListener("click", () => {
      loadQaEntry(card.dataset.qaId).catch((error) => showToast(error.message, true));
    });
  });
}

async function loadQaEntry(qaLogId) {
  activeQaId = qaLogId;
  setActiveHistoryCard(qaLogId);

  const entry = await api(`/qa/${qaLogId}`);
  showAnswer(entry.question, entry.answer);
  renderSourcesCards(entry.retrieval_snapshot || []);
  showView("ask");
  historyDrawer.open = false;

  if (qaDebugDetails.open) {
    await loadQaDebug(qaLogId);
  }
}

async function loadQaDebug(qaLogId) {
  const debug = await api(`/qa/${qaLogId}/debug`);

  qaDebugQuestion.textContent = debug.question;
  qaDebugPrompt.textContent =
    debug.prompt_context || "Full technical context isn't available for older questions.";
  qaDebugRetrieval.innerHTML = (debug.retrieval_snapshot || [])
    .map(
      (item) => `
        <article class="source-card">
          <header>
            <strong>${escapeHtml(item.author_name)}</strong>
            <span class="similarity">${Math.round((item.similarity || 0) * 100)}% relevant</span>
          </header>
          <p>${escapeHtml(item.content)}</p>
        </article>
      `
    )
    .join("");
}

async function loadManagedUsers() {
  if (!session.user.is_admin) return;

  const users = await api("/users");
  teamCount.textContent = formatTeamCount(users.length);

  if (!users.length) {
    managedUsersList.innerHTML = emptyStateCard(
      "+",
      "Your team is empty",
      "Add someone using the invite form so they can start posting updates."
    );
    return;
  }

  teamUsersById.clear();
  users.forEach((user) => teamUsersById.set(user.id, user));

  const sorted = [...users].sort((a, b) => {
    if (a.role === "owner" && b.role !== "owner") return -1;
    if (a.role !== "owner" && b.role === "owner") return 1;
    return a.name.localeCompare(b.name);
  });

  managedUsersList.innerHTML = sorted
    .map((user) => {
      const isYou = user.email === session.user.email;
      const isAdmin = user.role === "owner";
      return `
        <article class="team-member" data-user-id="${user.id}">
          <div class="team-avatar ${isAdmin ? "team-avatar-admin" : ""}" aria-hidden="true">${escapeHtml(getInitials(user.name))}</div>
          <div class="team-member-info">
            <strong>${escapeHtml(user.name)}${isYou ? ' <span class="team-you">(you)</span>' : ""}</strong>
            <span>${escapeHtml(user.email)}</span>
            <span class="team-joined">Added ${formatRelativeTime(user.created_at)}</span>
          </div>
          <div class="team-member-side">
            <span class="role-badge ${isAdmin ? "role-admin" : "role-user"}">${roleLabel(user.role)}</span>
            <div class="team-member-actions">
              <button type="button" class="btn-ghost btn-sm" data-action="reset-password">New password</button>
              <button type="button" class="btn-ghost btn-sm" data-action="edit-member">Edit</button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function resizeQuestionInput() {
  questionInput.style.height = "auto";
  questionInput.style.height = `${Math.min(questionInput.scrollHeight, 160)}px`;
}

async function refreshAll() {
  clearAnswer();
  activeQaId = null;
  historyDrawer.open = false;
  qaDebugDetails.open = false;
  await loadSession();
  await loadMessages();
  await Promise.all([loadQaHistory(), loadManagedUsers()]);
}

logoutBtn.addEventListener("click", redirectToLogin);

messageForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = messageForm.querySelector("button");
  const content = messageInput.value.trim();

  if (!content) {
    setFieldError(messageInput, "Write something before sharing.");
    return;
  }
  setFieldError(messageInput, "");

  setButtonLoading(button, true, "Sharing…");

  try {
    await api("/messages", {
      method: "POST",
      body: JSON.stringify({ content }),
    });
    messageInput.value = "";
    await loadMessages();
    showInlineFeedback(messageFeedback, "Update shared.");
  } catch (error) {
    showInlineFeedback(messageFeedback, friendlyError(error.message), { error: true });
  } finally {
    setButtonLoading(button, false);
  }
});

askForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = askForm.querySelector("button");
  const question = questionInput.value.trim();

  if (!question) {
    setFieldError(questionInput, "Ask a question first.");
    return;
  }
  setFieldError(questionInput, "");

  setButtonLoading(button, true, "…");
  askQuestionDisplay.textContent = question;
  setAskConversationMode(true);
  showAskLoading("Looking through team updates…");

  try {
    const result = await api("/ask", {
      method: "POST",
      body: JSON.stringify({
        question,
        limit: 8,
      }),
    });

    showAnswer(result.question, result.answer);
    renderSourcesCards(result.sources || [], true);
    questionInput.value = "";
    resizeQuestionInput();
    await loadQaHistory();

    if (result.qa_log_id) {
      activeQaId = result.qa_log_id;
      setActiveHistoryCard(result.qa_log_id);
    }
  } catch (error) {
    hideAskLoading();
    setAskConversationMode(false);
    showToast(error.message, true);
  } finally {
    setButtonLoading(button, false);
  }
});

const askDrawers = [historyDrawer, qaDebugDetails];

function setupAskDrawers() {
  document.addEventListener("mousedown", (event) => {
    askDrawers.forEach((drawer) => {
      if (drawer.open && !drawer.contains(event.target)) {
        drawer.open = false;
      }
    });
  });

  askDrawers.forEach((drawer) => {
    drawer.addEventListener("toggle", () => {
      if (!drawer.open) return;
      askDrawers.forEach((other) => {
        if (other !== drawer) other.open = false;
      });
    });
  });
}

setupAskDrawers();

qaDebugDetails.addEventListener("toggle", () => {
  if (qaDebugDetails.open && activeQaId) {
    loadQaDebug(activeQaId).catch((error) => showToast(error.message, true));
  }
});

copyLoginSnippetBtn.addEventListener("click", () => {
  copyText(loginSnippetText.textContent);
});

managedUsersList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const member = button.closest(".team-member");
  const userId = member?.dataset.userId;
  if (!userId) return;

  const user = teamUsersById.get(userId);
  if (!user) return;

  if (button.dataset.action === "reset-password") {
    openResetPasswordDialog(userId);
    return;
  }

  if (button.dataset.action === "edit-member") {
    openEditDialog(userId);
  }
});

resetPasswordGenerate.addEventListener("click", () => {
  resetPasswordValue.value = generateTempPassword();
});

resetDialogClose.addEventListener("click", closeResetPasswordDialog);
resetDialogCancel.addEventListener("click", closeResetPasswordDialog);

resetPasswordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const userId = document.getElementById("reset-user-id").value;
  const password = resetPasswordValue.value.trim();
  const button = resetPasswordForm.querySelector('button[type="submit"]');
  button.disabled = true;

  try {
    await saveMemberPassword(userId, password);
    closeResetPasswordDialog();
    await loadManagedUsers();
    showToast("New password saved and sign-in details copied");
    showView("team");
  } catch (error) {
    showToast(error.message, true);
  } finally {
    button.disabled = false;
  }
});

editDialogClose.addEventListener("click", closeEditDialog);
editDialogCancel.addEventListener("click", closeEditDialog);

editUserForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const userId = document.getElementById("edit-user-id").value;
  const button = editUserForm.querySelector('button[type="submit"]');
  button.disabled = true;

  const name = document.getElementById("edit-user-name").value.trim();
  const email = document.getElementById("edit-user-email").value.trim();
  const password = document.getElementById("edit-user-password").value;

  const body = { name, email };
  if (password) body.password = password;

  try {
    const updated = await api(`/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });

    if (password) {
      cacheMemberPassword(userId, password);
    }

    closeEditDialog();
    await loadManagedUsers();
    showLoginSnippet(updated.email, memberCredentials.get(userId) || password || null);

    if (String(updated.id) === String(session.user.id)) {
      await loadSession();
    }

    showToast("Changes saved");
    showView("team");
  } catch (error) {
    showToast(error.message, true);
  } finally {
    button.disabled = false;
  }
});

createUserForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!validateInviteForm()) return;

  const button = createUserForm.querySelector("button");
  const name = document.getElementById("new-user-name").value.trim();
  const email = document.getElementById("new-user-email").value.trim();
  const password = document.getElementById("new-user-password").value;

  setButtonLoading(button, true, "Adding…");

  try {
    const created = await api("/users", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });

    cacheMemberPassword(created.id, password);
    createUserForm.reset();
    clearFormErrors(createUserForm);
    await loadManagedUsers();
    showLoginSnippet(created.email, password);
    showInlineFeedback(inviteFeedback, "Person added. Share the sign-in details below.");
    showView("team");
  } catch (error) {
    showInlineFeedback(inviteFeedback, friendlyError(error.message), { error: true });
  } finally {
    setButtonLoading(button, false);
  }
});

messageInput.addEventListener("input", () => {
  if (messageInput.value.trim()) setFieldError(messageInput, "");
});

questionInput.addEventListener("input", () => {
  if (questionInput.value.trim()) setFieldError(questionInput, "");
  resizeQuestionInput();
});

refreshAll().catch((error) => showToast(error.message, true));
