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
    forgot: document.getElementById("forgot-password-form"),
    reset: document.getElementById("reset-password-form"),
    dashboard: document.getElementById("dashboard-panel"),
    profile: document.getElementById("profile-panel"),
    admin: document.getElementById("admin-panel"),
    manager: document.getElementById("manager-panel"),
};

const ROLE_OPTIONS = ["ADMIN", "MANAGER", "EMPLOYEE"];
let currentUsername = null;

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

const PASSWORD_STRENGTH_MAX_SCORE = 6;

function calculatePasswordStrength(password) {
    let score = 0;
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    if (password.length >= 12) score++;
    if (password.length >= 16) score++;

    if (password.length < 8 || score <= 2) {
        return { score, label: "Weak" };
    }

    return score <= 4 ? { score, label: "Good" } : { score, label: "Strong" };
}

function attachPasswordStrengthMeter(inputId, meterId) {
    const input = document.getElementById(inputId);
    const meter = document.getElementById(meterId);
    const fill = meter.querySelector(".password-strength-fill");
    const label = meter.querySelector(".password-strength-label");

    input.addEventListener("input", () => {
        const password = input.value;

        if (!password) {
            meter.hidden = true;
            return;
        }

        meter.hidden = false;
        const strength = calculatePasswordStrength(password);
        fill.style.width = `${Math.min(100, Math.round((strength.score / PASSWORD_STRENGTH_MAX_SCORE) * 100))}%`;
        fill.dataset.strength = strength.label.toLowerCase();
        label.textContent = `Password strength: ${strength.label}`;
    });
}

attachPasswordStrengthMeter("register-password", "register-password-strength");
attachPasswordStrengthMeter("reset-password", "reset-password-strength");
attachPasswordStrengthMeter("new-password", "new-password-strength");

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
        document.getElementById("register-password-strength").hidden = true;
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
        await loadDashboard();
    } catch (err) {
        setMessage(messageEl, err.message, "error");
    }
});

function logout() {
    sessionStorage.removeItem("token");
    showTab("login");
}

document.getElementById("logout-btn").addEventListener("click", logout);
document.getElementById("dashboard-logout-btn").addEventListener("click", logout);

document.getElementById("forgot-password-link").addEventListener("click", (e) => {
    e.preventDefault();
    showTab("forgot");
});

document.querySelectorAll(".back-to-login").forEach((link) => {
    link.addEventListener("click", (e) => {
        e.preventDefault();
        showTab("login");
    });
});

document.getElementById("forgot-password-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const messageEl = document.getElementById("forgot-message");

    try {
        const data = await apiRequest("/forgot-password", {
            method: "POST",
            body: JSON.stringify({ email: form.email.value }),
        });
        setMessage(messageEl, data.message, "success");
        form.reset();
    } catch (err) {
        setMessage(messageEl, err.message, "error");
    }
});

document.getElementById("reset-password-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const messageEl = document.getElementById("reset-message");

    try {
        const data = await apiRequest("/reset-password", {
            method: "POST",
            body: JSON.stringify({ token: form.token.value, password: form.password.value }),
        });
        form.reset();
        document.getElementById("reset-password-strength").hidden = true;
        setMessage(document.getElementById("login-message"), data.message, "success");
        showTab("login");
    } catch (err) {
        setMessage(messageEl, err.message, "error");
    }
});

document.getElementById("change-password-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const messageEl = document.getElementById("change-password-message");
    const token = sessionStorage.getItem("token");

    try {
        await apiRequest("/change-password", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                currentPassword: form.currentPassword.value,
                newPassword: form.newPassword.value,
            }),
        });
        form.reset();
        document.getElementById("new-password-strength").hidden = true;
        sessionStorage.removeItem("token");
        setMessage(document.getElementById("login-message"), "Password changed. Please log in again.", "success");
        showTab("login");
    } catch (err) {
        setMessage(messageEl, err.message, "error");
    }
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

        currentUsername = profile.username;

        renderDetailList(document.getElementById("profile-details"), [
            ["Username", profile.username],
            ["Email", profile.email],
            ["Role", profile.role],
            ["Last login", profile.lastLogin || "First login"],
        ]);

        document.getElementById("admin-link-row").hidden = profile.role !== "ADMIN";
        document.getElementById("manager-link-row").hidden = profile.role !== "MANAGER";

        showTab("profile");
    } catch {
        sessionStorage.removeItem("token");
    }
}

document.getElementById("admin-panel-link").addEventListener("click", (e) => {
    e.preventDefault();
    showTab("admin");
    loadAdminUsers();
});

document.getElementById("manager-panel-link").addEventListener("click", (e) => {
    e.preventDefault();
    showTab("manager");
    loadManagerEmployees();
});

document.querySelectorAll(".back-to-profile").forEach((link) => {
    link.addEventListener("click", (e) => {
        e.preventDefault();
        showTab("profile");
    });
});

document.querySelectorAll(".back-to-dashboard").forEach((link) => {
    link.addEventListener("click", (e) => {
        e.preventDefault();
        showTab("dashboard");
    });
});

document.getElementById("dashboard-profile-link").addEventListener("click", (e) => {
    e.preventDefault();
    loadProfile();
});

function authHeaders() {
    return { Authorization: `Bearer ${sessionStorage.getItem("token")}` };
}

async function loadAdminUsers() {
    const messageEl = document.getElementById("admin-message");
    const body = document.getElementById("admin-users-body");

    try {
        const data = await apiRequest("/admin/users", { headers: authHeaders() });
        body.textContent = "";

        data.users.forEach((user) => {
            body.appendChild(buildAdminUserRow(user));
        });
    } catch (err) {
        setMessage(messageEl, err.message, "error");
    }
}

function buildAdminUserRow(user) {
    const isSelf = user.username === currentUsername;
    const tr = document.createElement("tr");

    const usernameTd = document.createElement("td");
    usernameTd.textContent = user.username;

    const emailTd = document.createElement("td");
    emailTd.textContent = user.email;

    const roleTd = document.createElement("td");
    const roleSelect = document.createElement("select");
    roleSelect.className = "role-select";
    roleSelect.disabled = isSelf;
    ROLE_OPTIONS.forEach((role) => {
        const option = document.createElement("option");
        option.value = role;
        option.textContent = role;
        option.selected = role === user.role;
        roleSelect.appendChild(option);
    });
    roleTd.appendChild(roleSelect);

    const lastLoginTd = document.createElement("td");
    lastLoginTd.textContent = user.lastLogin || "Never";

    const actionsTd = document.createElement("td");
    actionsTd.className = "row-actions";

    if (!isSelf) {
        const saveBtn = document.createElement("button");
        saveBtn.type = "button";
        saveBtn.className = "btn-small";
        saveBtn.textContent = "Save role";
        saveBtn.addEventListener("click", () => updateUserRole(user.id, roleSelect.value));

        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "btn-small btn-danger";
        deleteBtn.textContent = "Delete";
        deleteBtn.addEventListener("click", () => deleteUser(user.id, user.username));

        actionsTd.append(saveBtn, deleteBtn);
    } else {
        actionsTd.textContent = "(you)";
    }

    tr.append(usernameTd, emailTd, roleTd, lastLoginTd, actionsTd);
    return tr;
}

async function updateUserRole(id, role) {
    const messageEl = document.getElementById("admin-message");

    try {
        const data = await apiRequest(`/admin/users/${id}/role`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", ...authHeaders() },
            body: JSON.stringify({ role }),
        });
        setMessage(messageEl, data.message, "success");
        await loadAdminUsers();
    } catch (err) {
        setMessage(messageEl, err.message, "error");
    }
}

async function deleteUser(id, username) {
    if (!window.confirm(`Delete user "${username}"? This cannot be undone.`)) {
        return;
    }

    const messageEl = document.getElementById("admin-message");

    try {
        const data = await apiRequest(`/admin/users/${id}`, {
            method: "DELETE",
            headers: authHeaders(),
        });
        setMessage(messageEl, data.message, "success");
        await loadAdminUsers();
    } catch (err) {
        setMessage(messageEl, err.message, "error");
    }
}

async function loadManagerEmployees() {
    const messageEl = document.getElementById("manager-message");
    const body = document.getElementById("manager-employees-body");

    try {
        const data = await apiRequest("/manager/employees", { headers: authHeaders() });
        body.textContent = "";

        data.employees.forEach((employee) => {
            body.appendChild(buildManagerEmployeeRow(employee));
        });
    } catch (err) {
        setMessage(messageEl, err.message, "error");
    }
}

function buildManagerEmployeeRow(employee) {
    const tr = document.createElement("tr");

    const usernameTd = document.createElement("td");
    usernameTd.textContent = employee.username;

    const emailTd = document.createElement("td");
    emailTd.textContent = employee.email;

    const lastLoginTd = document.createElement("td");
    lastLoginTd.textContent = employee.lastLogin || "Never";

    const actionsTd = document.createElement("td");
    actionsTd.className = "row-actions";

    const fireBtn = document.createElement("button");
    fireBtn.type = "button";
    fireBtn.className = "btn-small btn-danger";
    fireBtn.textContent = "Fire";
    fireBtn.addEventListener("click", () => fireEmployee(employee.id, employee.username));
    actionsTd.appendChild(fireBtn);

    tr.append(usernameTd, emailTd, lastLoginTd, actionsTd);
    return tr;
}

async function fireEmployee(id, username) {
    if (!window.confirm(`Fire "${username}"? This cannot be undone.`)) {
        return;
    }

    const messageEl = document.getElementById("manager-message");

    try {
        const data = await apiRequest(`/manager/employees/${id}`, {
            method: "DELETE",
            headers: authHeaders(),
        });
        setMessage(messageEl, data.message, "success");
        await loadManagerEmployees();
    } catch (err) {
        setMessage(messageEl, err.message, "error");
    }
}

function renderDetailList(el, entries) {
    el.textContent = "";
    entries.forEach(([label, value]) => {
        const dt = document.createElement("dt");
        dt.textContent = label;
        const dd = document.createElement("dd");
        dd.textContent = value;
        el.append(dt, dd);
    });
}

async function loadDashboard() {
    const token = sessionStorage.getItem("token");
    if (!token) {
        return;
    }

    try {
        const dashboard = await apiRequest("/dashboard", {
            headers: { Authorization: `Bearer ${token}` },
        });

        currentUsername = dashboard.username;

        document.getElementById("dashboard-welcome").textContent = `Welcome back, ${dashboard.username}!`;

        renderDetailList(document.getElementById("dashboard-details"), [
            ["Role", dashboard.role],
            ["Last login", dashboard.lastLogin || "First login"],
        ]);

        const statsSection = document.getElementById("dashboard-stats");
        statsSection.hidden = !dashboard.stats;

        if (dashboard.stats) {
            renderDetailList(document.getElementById("dashboard-stats-details"), [
                ["Total users", dashboard.stats.totalUsers],
                ...Object.entries(dashboard.stats.usersByRole),
            ]);
        }

        showTab("dashboard");
    } catch {
        sessionStorage.removeItem("token");
    }
}

function checkResetTokenInUrl() {
    const token = new URLSearchParams(window.location.search).get("token");
    if (token) {
        document.getElementById("reset-token").value = token;
        showTab("reset");
    }
}

checkResetTokenInUrl();
loadDashboard();
