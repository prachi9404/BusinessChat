const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const registerWizard = document.getElementById("register-wizard");
const registerAlert = document.getElementById("register-alert");
const loginFeedback = document.getElementById("login-feedback");
const tabSignin = document.getElementById("tab-signin");
const tabRegister = document.getElementById("tab-register");
const registerCompanyName = document.getElementById("register-company-name");
const registerCompanySlug = document.getElementById("register-company-slug");
const slugPreview = document.getElementById("slug-preview");
const slugPreviewValue = document.getElementById("slug-preview-value");
const companyRecap = document.getElementById("company-recap");
const wizardStep1 = document.getElementById("wizard-step-1");
const wizardStep2 = document.getElementById("wizard-step-2");
const wizardNext = document.getElementById("wizard-next");
const wizardBack = document.getElementById("wizard-back");
const wizardSteps = document.querySelectorAll(".wizard-step");
const toast = document.getElementById("toast");

const existingToken = localStorage.getItem("access_token");
if (existingToken) {
  window.location.href = "/app";
}

let currentWizardStep = 1;
let inlineFeedbackTimer = null;

function friendlyError(message) {
  const map = {
    "Invalid email or password": "That email or password doesn't match. Please try again.",
    "This email is already registered. Sign in or contact your company admin.":
      "That email is already registered. Try signing in instead.",
    "Company URL must use lowercase letters, numbers, and hyphens only":
      "We couldn't create a workspace address from that company name. Try a simpler name.",
  };

  if (map[message]) return map[message];
  if (message.startsWith("Request failed")) return "Something went wrong. Please try again.";
  return message;
}

function showToast(message, isError = false) {
  toast.textContent = isError ? friendlyError(message) : message;
  toast.classList.toggle("error", isError);
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 5000);
}

function showInlineFeedback(element, message, { error = false, timeout = 5000 } = {}) {
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
  const group = input.closest(".field-group") || input.closest(".composer");
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

function parseApiError(payload) {
  const detail = payload.detail;
  if (!detail) return "Something went wrong. Please try again.";
  if (typeof detail === "string") return friendlyError(detail);
  if (typeof detail === "object" && detail.message) {
    return friendlyError(detail.message);
  }
  if (Array.isArray(detail)) {
    return detail.map((item) => item.msg).join("; ");
  }
  return "Something went wrong. Please try again.";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function showRegisterAlert(message, adminEmails = []) {
  if (adminEmails.length) {
    const links = adminEmails
      .map(
        (email) =>
          `<a href="mailto:${encodeURIComponent(email)}?subject=BusinessChat%20access%20request">${escapeHtml(email)}</a>`
      )
      .join(" · ");
    registerAlert.innerHTML = `${escapeHtml(message)} Contact your admin: ${links}`;
  } else {
    registerAlert.textContent = friendlyError(message);
  }
  registerAlert.classList.remove("hidden");
}

function hideRegisterAlert() {
  registerAlert.classList.add("hidden");
  registerAlert.textContent = "";
}

function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function updateSlugPreview() {
  const slug = slugify(registerCompanyName.value);
  registerCompanySlug.value = slug;

  if (slug.length >= 2) {
    slugPreviewValue.textContent = slug;
    slugPreview.classList.remove("hidden");
  } else {
    slugPreview.classList.add("hidden");
  }
}

function setWizardStep(step) {
  currentWizardStep = step;
  wizardStep1.classList.toggle("hidden", step !== 1);
  wizardStep2.classList.toggle("hidden", step !== 2);

  wizardSteps.forEach((el) => {
    const stepNum = Number(el.dataset.step);
    el.classList.toggle("active", stepNum === step);
    el.classList.toggle("complete", stepNum < step);
  });

  if (step === 2) {
    const name = registerCompanyName.value.trim();
    const industry = document.getElementById("register-industry").value.trim();
    companyRecap.innerHTML = `
      <strong>${escapeHtml(name)}</strong>
      <span>${escapeHtml(industry)}</span>
    `;
  }
}

function resetWizard() {
  currentWizardStep = 1;
  registerForm.reset();
  registerCompanySlug.value = "";
  slugPreview.classList.add("hidden");
  hideRegisterAlert();
  clearFormErrors(registerForm);
  setWizardStep(1);
}

function showSignInTab() {
  tabSignin.classList.add("active");
  tabRegister.classList.remove("active");
  loginForm.classList.remove("hidden");
  registerWizard.classList.add("hidden");
  hideRegisterAlert();
}

function showRegisterTab() {
  tabRegister.classList.add("active");
  tabSignin.classList.remove("active");
  registerWizard.classList.remove("hidden");
  loginForm.classList.add("hidden");
  resetWizard();
}

function validateStep1() {
  clearFormErrors(registerForm);
  let valid = true;

  const name = registerCompanyName;
  const industry = document.getElementById("register-industry");

  if (!name.value.trim()) {
    setFieldError(name, "Enter your company name.");
    valid = false;
  }

  if (!industry.value.trim()) {
    setFieldError(industry, "Enter your industry.");
    valid = false;
  }

  updateSlugPreview();
  const slug = registerCompanySlug.value;
  if (!slug || slug.length < 2) {
    setFieldError(name, "Use a company name we can turn into a workspace address.");
    valid = false;
  }

  return valid;
}

function validateStep2() {
  clearFormErrors(registerForm);
  let valid = true;

  const adminName = document.getElementById("register-admin-name");
  const adminEmail = document.getElementById("register-admin-email");
  const adminPassword = document.getElementById("register-admin-password");

  if (!adminName.value.trim()) {
    setFieldError(adminName, "Enter your name.");
    valid = false;
  }

  if (!adminEmail.value.trim()) {
    setFieldError(adminEmail, "Enter your work email.");
    valid = false;
  } else if (!adminEmail.value.includes("@")) {
    setFieldError(adminEmail, "Enter a valid email address.");
    valid = false;
  }

  if (!adminPassword.value || adminPassword.value.length < 6) {
    setFieldError(adminPassword, "Password must be at least 6 characters.");
    valid = false;
  }

  return valid;
}

function fillDemoAccount(email, password) {
  showSignInTab();
  document.getElementById("email-input").value = email;
  document.getElementById("password-input").value = password;
  setFieldError(document.getElementById("email-input"), "");
  setFieldError(document.getElementById("password-input"), "");
  loginFeedback.classList.add("hidden");
  document.querySelector(".login-demo")?.removeAttribute("open");
  document.getElementById("email-input").focus();
}

registerCompanyName.addEventListener("input", updateSlugPreview);

tabSignin.addEventListener("click", showSignInTab);
tabRegister.addEventListener("click", showRegisterTab);

wizardNext.addEventListener("click", () => {
  if (!validateStep1()) return;
  hideRegisterAlert();
  setWizardStep(2);
  document.getElementById("register-admin-name").focus();
});

wizardBack.addEventListener("click", () => {
  hideRegisterAlert();
  setWizardStep(1);
});

document.querySelectorAll(".demo-fill-btn").forEach((button) => {
  button.addEventListener("click", () => {
    fillDemoAccount(button.dataset.email, button.dataset.password);
  });
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = loginForm.querySelector("button");
  const emailInput = document.getElementById("email-input");
  const passwordInput = document.getElementById("password-input");

  clearFormErrors(loginForm);
  loginFeedback.classList.add("hidden");

  if (!emailInput.value.trim()) {
    setFieldError(emailInput, "Enter your email.");
    return;
  }
  if (!passwordInput.value) {
    setFieldError(passwordInput, "Enter your password.");
    return;
  }

  setButtonLoading(button, true, "Signing in…");

  try {
    const response = await fetch("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: emailInput.value.trim(),
        password: passwordInput.value,
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(parseApiError(payload));
    }

    const data = await response.json();
    localStorage.setItem("access_token", data.access_token);
    window.location.href = "/app";
  } catch (error) {
    showInlineFeedback(loginFeedback, friendlyError(error.message), { error: true });
  } finally {
    setButtonLoading(button, false);
  }
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!validateStep2()) return;

  hideRegisterAlert();
  const button = registerForm.querySelector('button[type="submit"]');
  setButtonLoading(button, true, "Creating…");

  try {
    const response = await fetch("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company_slug: registerCompanySlug.value.trim(),
        company_name: registerCompanyName.value.trim(),
        industry: document.getElementById("register-industry").value.trim(),
        description: document.getElementById("register-description").value.trim() || null,
        admin_name: document.getElementById("register-admin-name").value.trim(),
        admin_email: document.getElementById("register-admin-email").value.trim(),
        admin_password: document.getElementById("register-admin-password").value,
      }),
    });

    const payload = await response.json().catch(() => ({}));

    if (response.status === 409) {
      const detail = payload.detail || {};
      if (typeof detail === "string") {
        showRegisterAlert(detail);
      } else {
        showRegisterAlert(
          detail.message || "This company already exists. Ask your admin for an invite.",
          detail.admin_emails || []
        );
      }
      return;
    }

    if (!response.ok) {
      throw new Error(parseApiError(payload));
    }

    localStorage.setItem("access_token", payload.access_token);
    window.location.href = "/app";
  } catch (error) {
    showRegisterAlert(error.message);
  } finally {
    setButtonLoading(button, false);
  }
});
