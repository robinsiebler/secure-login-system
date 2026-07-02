const themeToggle = document.getElementById("theme-toggle");
const root = document.documentElement;

function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    const isDark = theme === "dark";
    themeToggle.querySelector(".icon-sun").style.display = isDark ? "block" : "none";
    themeToggle.querySelector(".icon-moon").style.display = isDark ? "none" : "block";
    themeToggle.setAttribute("aria-pressed", String(isDark));
    themeToggle.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
}

applyTheme(root.getAttribute("data-theme") || "light");

themeToggle.addEventListener("click", () => {
    const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    localStorage.setItem("theme", next);
    applyTheme(next);
});

const tabButtons = document.querySelectorAll(".tab-btn");
const panels = {
    login: document.getElementById("login-form"),
    register: document.getElementById("register-form"),
    profile: document.getElementById("profile-panel"),
};

function showTab(name) {
    tabButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.tab === name));
    Object.entries(panels).forEach(([key, panel]) => panel.classList.toggle("active", key === name));
}

tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => showTab(btn.dataset.tab));
});

document.querySelectorAll(".toggle-password").forEach((btn) => {
    btn.addEventListener("click", () => {
        const input = document.getElementById(btn.dataset.target);
        const willReveal = input.type === "password";

        input.type = willReveal ? "text" : "password";
        btn.setAttribute("aria-pressed", String(willReveal));
        btn.setAttribute("aria-label", willReveal ? "Hide password" : "Show password");
        btn.querySelector(".icon-eye").style.display = willReveal ? "block" : "none";
        btn.querySelector(".icon-eye-off").style.display = willReveal ? "none" : "block";
    });
});

function setMessage(el, text, type) {
    el.textContent = text;
    el.className = `message ${type}`;
}

async function apiRequest(path, options) {
    const res = await fetch(`/api${path}`, {
        headers: { "Content-Type": "application/json" },
        ...options,
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        throw new Error(data.error || "Request failed");
    }

    return data;
}

document.getElementById("register-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const messageEl = document.getElementById("register-message");

    try {
        await apiRequest("/register", {
            method: "POST",
            body: JSON.stringify({
                username: form.username.value,
                email: form.email.value,
                password: form.password.value,
            }),
        });
        setMessage(messageEl, "Account created. You can now log in.", "success");
        form.reset();
        showTab("login");
    } catch (err) {
        setMessage(messageEl, err.message, "error");
    }
});

document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const messageEl = document.getElementById("login-message");

    try {
        const data = await apiRequest("/login", {
            method: "POST",
            body: JSON.stringify({
                username: form.username.value,
                password: form.password.value,
            }),
        });
        sessionStorage.setItem("token", data.token);
        setMessage(messageEl, "", "success");
        form.reset();
        await loadProfile();
    } catch (err) {
        setMessage(messageEl, err.message, "error");
    }
});

document.getElementById("logout-btn").addEventListener("click", () => {
    sessionStorage.removeItem("token");
    showTab("login");
});

async function loadProfile() {
    const token = sessionStorage.getItem("token");
    if (!token) {
        return;
    }

    try {
        const profile = await apiRequest("/profile", {
            headers: { Authorization: `Bearer ${token}` },
        });

        const details = document.getElementById("profile-details");
        details.textContent = "";
        [
            ["Username", profile.username],
            ["Email", profile.email],
            ["Last login", profile.lastLogin || "First login"],
        ].forEach(([label, value]) => {
            const dt = document.createElement("dt");
            dt.textContent = label;
            const dd = document.createElement("dd");
            dd.textContent = value;
            details.append(dt, dd);
        });
        showTab("profile");
    } catch {
        sessionStorage.removeItem("token");
    }
}

loadProfile();
