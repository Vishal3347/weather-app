// ============================================================
// script.js – WeatherNow Application Logic
//
// Sections:
//  1. State & Constants
//  2. DOM References
//  3. Utility Functions
//  4. Weather Data Fetching
//  5. UI Rendering
//  6. Recent Searches (localStorage)
//  7. Unit Toggle (°C / °F)
//  8. Theme Toggle (Dark / Light)
//  9. Geolocation
// 10. AI Assistant (Claude API integration)
// 11. Event Listeners
// ============================================================

// ============================================================
// 1. STATE & CONSTANTS
// ============================================================

const state = {
    unit: "metric",
    theme: "dark",
    currentData: null,
    forecastData: null,
    recentCities: [],
    aiPanelOpen: true,
    aiChatHistory: [],   // stores {role, content} for context
};

const WEATHER_BG_MAP = {
    Clear: "weather-clear",
    Clouds: "weather-clouds",
    Rain: "weather-rain",
    Drizzle: "weather-drizzle",
    Thunderstorm: "weather-thunder",
    Snow: "weather-snow",
    Mist: "weather-mist",
    Smoke: "weather-mist",
    Haze: "weather-mist",
    Dust: "weather-mist",
    Fog: "weather-mist",
    Sand: "weather-mist",
    Ash: "weather-mist",
    Squall: "weather-thunder",
    Tornado: "weather-thunder",
};

const MAX_RECENT = 5;
const RECENT_KEY = "weathernow_recent";

// ============================================================
// 2. DOM REFERENCES
// ============================================================
const searchInput   = document.getElementById("search-input");
const searchBtn     = document.getElementById("search-btn");
const geoBtn        = document.getElementById("geo-btn");
const unitToggle    = document.getElementById("unit-toggle");
const themeToggle   = document.getElementById("theme-toggle");
const loader        = document.getElementById("loader");
const errorMsg      = document.getElementById("error-msg");
const errorText     = document.getElementById("error-text");
const weatherCard   = document.getElementById("weather-card");
const emptyState    = document.getElementById("empty-state");
const recentSection = document.getElementById("recent-searches");

const cityNameEl    = document.getElementById("city-name");
const dateTimeEl    = document.getElementById("date-time");
const weatherIconEl = document.getElementById("weather-icon");
const temperatureEl = document.getElementById("temperature");
const weatherDescEl = document.getElementById("weather-desc");
const feelsLikeEl   = document.getElementById("feels-like");
const humidityEl    = document.getElementById("humidity");
const windSpeedEl   = document.getElementById("wind-speed");
const visibilityEl  = document.getElementById("visibility");
const pressureEl    = document.getElementById("pressure");
const forecastGrid  = document.getElementById("forecast-grid");

// AI Panel DOM
const aiToggleBtn       = document.getElementById("ai-toggle-btn");
const aiPanelBody       = document.getElementById("ai-panel-body");
const aiInsightBox      = document.getElementById("ai-insight-box");
const aiInsightLoading  = document.getElementById("ai-insight-loading");
const aiInsightContent  = document.getElementById("ai-insight-content");
const aiChatWindow      = document.getElementById("ai-chat-window");
const aiChatInput       = document.getElementById("ai-chat-input");
const aiSendBtn         = document.getElementById("ai-send-btn");
const aiQuickBtns       = document.querySelectorAll(".ai-quick-btn");

// ============================================================
// 3. UTILITY FUNCTIONS
// ============================================================

function formatTemp(value) {
    const rounded = Math.round(value);
    const symbol = state.unit === "metric" ? "°C" : "°F";
    return `${rounded}${symbol}`;
}

function formatDateTime(dt, timezoneOffset) {
    const localMs = (dt + timezoneOffset) * 1000;
    const date = new Date(localMs);
    const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const dayName = days[date.getUTCDay()];
    const day = date.getUTCDate();
    const month = months[date.getUTCMonth()];
    const year = date.getUTCFullYear();
    const hours = String(date.getUTCHours()).padStart(2, "0");
    const mins  = String(date.getUTCMinutes()).padStart(2, "0");
    return `${dayName}, ${day} ${month} ${year}  ·  ${hours}:${mins}`;
}

function getDayAbbr(dt) {
    const d = new Date(dt * 1000);
    const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    return days[d.getUTCDay()];
}

function formatWind(speed) {
    return state.unit === "metric" ? `${Math.round(speed)} m/s` : `${Math.round(speed)} mph`;
}

function iconUrl(iconCode) {
    return `${CONFIG.ICON_URL}/${iconCode}@2x.png`;
}

/** Builds a concise weather summary string for injecting into AI prompts */
function buildWeatherContext(w, f) {
    if (!w) return "";
    const unit = state.unit === "metric" ? "°C" : "°F";
    const forecastLines = getDailyForecasts(f.list).map(item =>
        `${getDayAbbr(item.dt)}: ${Math.round(item.main.temp_min)}–${Math.round(item.main.temp_max)}${unit}, ${item.weather[0].description}`
    ).join("; ");

    return `Location: ${w.name}, ${w.sys.country}
Current: ${Math.round(w.main.temp)}${unit}, feels like ${Math.round(w.main.feels_like)}${unit}, ${w.weather[0].description}
Humidity: ${w.main.humidity}% | Wind: ${formatWind(w.wind.speed)} | Pressure: ${w.main.pressure} hPa | Visibility: ${w.visibility ? (w.visibility/1000).toFixed(1) + " km" : "N/A"}
5-Day Forecast: ${forecastLines}`;
}

// ============================================================
// 4. WEATHER DATA FETCHING
// ============================================================

async function fetchWeatherByCity(city) {
    if (!city.trim()) return;
    showLoader();
    try {
        const [weather, forecast] = await Promise.all([
            fetchCurrentWeather({ q: city }),
            fetchForecast({ q: city }),
        ]);
        handleSuccess(weather, forecast, city);
    } catch (err) {
        handleError(err.message);
    }
}

async function fetchWeatherByCoords(lat, lon) {
    showLoader();
    try {
        const [weather, forecast] = await Promise.all([
            fetchCurrentWeather({ lat, lon }),
            fetchForecast({ lat, lon }),
        ]);
        handleSuccess(weather, forecast, weather.name);
    } catch (err) {
        handleError(err.message);
    }
}

async function fetchCurrentWeather(params) {
    const url = buildUrl("weather", params);
    const res = await fetch(url);
    if (!res.ok) {
        if (res.status === 404) throw new Error("City not found. Please check the spelling and try again.");
        if (res.status === 401) throw new Error("Invalid API key. Please update config.js.");
        throw new Error(`Weather service error (${res.status}). Please try again.`);
    }
    return res.json();
}

async function fetchForecast(params) {
    const url = buildUrl("forecast", params);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Forecast error (${res.status}).`);
    return res.json();
}

function buildUrl(endpoint, extraParams) {
    const params = new URLSearchParams({
        appid: CONFIG.API_KEY,
        units: state.unit,
        ...extraParams,
    });
    return `${CONFIG.BASE_URL}/${endpoint}?${params.toString()}`;
}

// ============================================================
// 5. UI RENDERING
// ============================================================

function handleSuccess(weather, forecast, cityName) {
    state.currentData  = weather;
    state.forecastData = forecast;
    state.aiChatHistory = []; // reset chat context on new city

    hideLoader();
    hideError();
    hideEmptyState();
    renderCurrentWeather(weather);
    renderForecast(forecast);
    setWeatherBackground(weather.weather[0].main);
    addRecentCity(cityName);
    showWeatherCard();

    // Trigger AI auto-insight
    generateWeatherInsight();
}

function renderCurrentWeather(data) {
    const w = data.weather[0];
    cityNameEl.textContent    = `${data.name}, ${data.sys.country}`;
    dateTimeEl.textContent    = formatDateTime(data.dt, data.timezone);
    temperatureEl.textContent = formatTemp(data.main.temp);
    weatherDescEl.textContent = w.description;
    feelsLikeEl.textContent   = `Feels like ${formatTemp(data.main.feels_like)}`;
    humidityEl.textContent    = `${data.main.humidity}%`;
    windSpeedEl.textContent   = formatWind(data.wind.speed);
    visibilityEl.textContent  = data.visibility ? `${(data.visibility / 1000).toFixed(1)} km` : "N/A";
    pressureEl.textContent    = `${data.main.pressure} hPa`;
    weatherIconEl.src         = iconUrl(w.icon);
    weatherIconEl.alt         = w.description;
}

function renderForecast(data) {
    const daily = getDailyForecasts(data.list);
    forecastGrid.innerHTML = "";
    daily.forEach(item => {
        const w = item.weather[0];
        const div = document.createElement("div");
        div.className = "forecast-day";
        div.innerHTML = `
      <span class="forecast-day-name">${getDayAbbr(item.dt)}</span>
      <img src="${iconUrl(w.icon)}" alt="${w.description}" loading="lazy" />
      <span class="forecast-day-temp">${formatTemp(item.main.temp_max)}</span>
      <span class="forecast-day-low">${formatTemp(item.main.temp_min)}</span>
    `;
        forecastGrid.appendChild(div);
    });
}

function getDailyForecasts(list) {
    const seen = {};
    list.forEach(item => {
        const date = new Date(item.dt * 1000);
        const key  = `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`;
        const hour = date.getUTCHours();
        if (!seen[key]) {
            seen[key] = item;
        } else {
            const prevHour = new Date(seen[key].dt * 1000).getUTCHours();
            if (Math.abs(hour - 12) < Math.abs(prevHour - 12)) seen[key] = item;
        }
    });
    const todayKey = (() => {
        const now = new Date();
        return `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}`;
    })();
    return Object.entries(seen).filter(([k]) => k !== todayKey).slice(0, 5).map(([, v]) => v);
}

function setWeatherBackground(condition) {
    document.body.classList.forEach(cls => {
        if (cls.startsWith("weather-")) document.body.classList.remove(cls);
    });
    const bgClass = WEATHER_BG_MAP[condition];
    if (bgClass) document.body.classList.add(bgClass);
}

// ============================================================
// 6. RECENT SEARCHES
// ============================================================

function loadRecentCities() {
    try {
        const stored = localStorage.getItem(RECENT_KEY);
        state.recentCities = stored ? JSON.parse(stored) : [];
    } catch {
        state.recentCities = [];
    }
    renderRecentCities();
}

function addRecentCity(city) {
    const normalised = city.trim();
    if (!normalised) return;
    state.recentCities = state.recentCities.filter(c => c.toLowerCase() !== normalised.toLowerCase());
    state.recentCities.unshift(normalised);
    if (state.recentCities.length > MAX_RECENT) state.recentCities = state.recentCities.slice(0, MAX_RECENT);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(state.recentCities)); } catch {}
    renderRecentCities();
}

function renderRecentCities() {
    recentSection.innerHTML = "";
    if (state.recentCities.length === 0) return;
    const label = document.createElement("span");
    label.className = "recent-label";
    label.textContent = "Recent";
    recentSection.appendChild(label);
    state.recentCities.forEach(city => {
        const tag = document.createElement("button");
        tag.className = "recent-tag";
        tag.textContent = city;
        tag.setAttribute("aria-label", `Search for ${city}`);
        tag.addEventListener("click", () => {
            searchInput.value = city;
            fetchWeatherByCity(city);
        });
        recentSection.appendChild(tag);
    });
}

// ============================================================
// 7. UNIT TOGGLE
// ============================================================

function toggleUnit() {
    state.unit = state.unit === "metric" ? "imperial" : "metric";
    unitToggle.textContent = state.unit === "metric" ? "°F" : "°C";
    if (state.currentData) fetchWeatherByCity(state.currentData.name);
}

// ============================================================
// 8. THEME TOGGLE
// ============================================================

function toggleTheme() {
    state.theme = state.theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", state.theme);
    themeToggle.textContent = state.theme === "dark" ? "☀️" : "🌙";
    try { localStorage.setItem("weathernow_theme", state.theme); } catch {}
}

function loadTheme() {
    try {
        const saved = localStorage.getItem("weathernow_theme");
        if (saved === "dark" || saved === "light") {
            state.theme = saved;
            document.documentElement.setAttribute("data-theme", state.theme);
            themeToggle.textContent = state.theme === "dark" ? "☀️" : "🌙";
        }
    } catch {}
}

// ============================================================
// 9. GEOLOCATION
// ============================================================

function handleGeolocation() {
    if (!navigator.geolocation) { showError("Geolocation is not supported by your browser."); return; }
    showLoader();
    navigator.geolocation.getCurrentPosition(
        ({ coords }) => fetchWeatherByCoords(coords.latitude, coords.longitude),
        (err) => {
            hideLoader();
            if (err.code === err.PERMISSION_DENIED) {
                showError("Location access denied. Please allow permission or search manually.");
            } else {
                showError("Unable to retrieve your location. Please try again.");
            }
        },
        { timeout: 10000 }
    );
}

// ============================================================
// 10. AI ASSISTANT (Claude API integration)
// ============================================================

const AI_SYSTEM_PROMPT = `You are a friendly, concise AI weather assistant embedded in a weather app called WeatherNow.
You have access to the user's current weather data and 5-day forecast.
Give practical, helpful responses about weather conditions, what to wear, activities, travel, health impacts, etc.
Keep responses brief (2-4 sentences) and conversational. Use emojis sparingly but naturally.
Never make up weather data — only use the data provided to you.`;

/**
 * Calls the AI proxy at /api/ai (Vercel serverless function → Gemini).
 * Gemini free tier: 1500 requests/day, no credit card needed.
 */
async function callClaudeAPI(messages) {
    const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, system: AI_SYSTEM_PROMPT }),
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `API error ${response.status}`);
    }

    const data = await response.json();
    return data.text || "";
}

/**
 * Auto-generates a weather insight when a city is loaded.
 * Shows in the insight box at the top of the AI panel.
 */
async function generateWeatherInsight() {
    if (!state.currentData || !state.forecastData) return;

    // Reset insight box
    aiInsightContent.innerHTML = "";
    aiInsightLoading.classList.remove("hidden");
    aiInsightBox.style.minHeight = "60px";

    const weatherContext = buildWeatherContext(state.currentData, state.forecastData);

    const messages = [{
        role: "user",
        content: `Here is the current weather data:\n${weatherContext}\n\nGive me a 2-3 sentence natural language summary of today's weather and one practical tip for the day. Be warm and conversational.`
    }];

    try {
        const insight = await callClaudeAPI(messages);
        aiInsightLoading.classList.add("hidden");
        aiInsightContent.innerHTML = insight;
    } catch (e) {
        aiInsightLoading.classList.add("hidden");
        aiInsightContent.innerHTML = `<span style="color:var(--text-muted);font-size:0.82rem;font-style:italic;">AI insight unavailable. You can still ask questions below.</span>`;
        console.warn("AI insight error:", e.message);
    }
}

/**
 * Handles sending a chat message to Claude with full weather context.
 * @param {string} userMessage
 */
async function sendAIMessage(userMessage) {
    if (!userMessage.trim()) return;
    if (!state.currentData) {
        appendChatMessage("bot", "Please search for a city first so I have weather data to work with! 🌍");
        return;
    }

    const weatherContext = buildWeatherContext(state.currentData, state.forecastData);

    // Add user message to UI and history
    appendChatMessage("user", userMessage);
    aiChatInput.value = "";
    aiSendBtn.disabled = true;

    // Add typing indicator
    const typingId = appendTypingIndicator();

    // Build messages array with weather context as system-level injection
    const contextualUserMsg = `Current weather data for context:\n${weatherContext}\n\nUser question: ${userMessage}`;

    // For first message, inject context. For follow-ups, use history.
    let messages;
    if (state.aiChatHistory.length === 0) {
        messages = [{ role: "user", content: contextualUserMsg }];
    } else {
        // Include history + inject context reminder in latest message
        messages = [
            ...state.aiChatHistory,
            { role: "user", content: contextualUserMsg }
        ];
    }

    try {
        const reply = await callClaudeAPI(messages);

        // Remove typing indicator
        removeTypingIndicator(typingId);

        // Show reply
        appendChatMessage("bot", reply);

        // Update history with clean messages (no context repetition for follow-ups)
        state.aiChatHistory.push({ role: "user", content: userMessage });
        state.aiChatHistory.push({ role: "assistant", content: reply });

        // Keep history bounded to last 8 turns
        if (state.aiChatHistory.length > 16) {
            state.aiChatHistory = state.aiChatHistory.slice(-16);
        }

    } catch (err) {
        removeTypingIndicator(typingId);
        appendChatMessage("bot", "Sorry, I couldn't reach the AI right now. Try again in a moment. ⚡");
        console.error("AI chat error:", err.message);
    }

    aiSendBtn.disabled = false;
    aiChatInput.focus();
}

/** Appends a message bubble to the chat window */
function appendChatMessage(role, text) {
    const msg = document.createElement("div");
    msg.className = `ai-msg ${role}`;
    msg.innerHTML = `
    <div class="ai-msg-avatar">${role === "user" ? "U" : "✦"}</div>
    <div class="ai-msg-bubble">${escapeHtml(text)}</div>
  `;
    aiChatWindow.appendChild(msg);
    aiChatWindow.scrollTop = aiChatWindow.scrollHeight;
    return msg;
}

/** Appends a typing indicator and returns its ID */
function appendTypingIndicator() {
    const id = "typing-" + Date.now();
    const msg = document.createElement("div");
    msg.className = "ai-msg bot ai-msg-typing";
    msg.id = id;
    msg.innerHTML = `
    <div class="ai-msg-avatar">✦</div>
    <div class="ai-msg-bubble">
      <div class="ai-dots"><span></span><span></span><span></span></div>
      <span>Thinking…</span>
    </div>
  `;
    aiChatWindow.appendChild(msg);
    aiChatWindow.scrollTop = aiChatWindow.scrollHeight;
    return id;
}

function removeTypingIndicator(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

/** Toggle AI panel open/close */
function toggleAIPanel() {
    state.aiPanelOpen = !state.aiPanelOpen;
    if (state.aiPanelOpen) {
        aiPanelBody.classList.remove("collapsed");
        aiToggleBtn.classList.remove("collapsed");
    } else {
        aiPanelBody.classList.add("collapsed");
        aiToggleBtn.classList.add("collapsed");
    }
}

// ============================================================
// SHOW / HIDE UI HELPERS
// ============================================================

function showLoader() {
    loader.classList.remove("hidden");
    weatherCard.classList.add("hidden");
    emptyState.classList.add("hidden");
    errorMsg.classList.add("hidden");
}

function hideLoader() { loader.classList.add("hidden"); }

function showWeatherCard() {
    weatherCard.classList.add("hidden");
    weatherCard.offsetWidth; // trigger reflow
    weatherCard.classList.remove("hidden");
    emptyState.classList.add("hidden");
}

function showError(message) {
    errorText.textContent = message || "Something went wrong. Please try again.";
    errorMsg.classList.remove("hidden");
    weatherCard.classList.add("hidden");
    emptyState.classList.add("hidden");
}

function hideError()      { errorMsg.classList.add("hidden"); }
function hideEmptyState() { emptyState.classList.add("hidden"); }
function handleError(msg) { hideLoader(); showError(msg); }

// ============================================================
// 11. EVENT LISTENERS
// ============================================================

// Weather search
searchBtn.addEventListener("click", () => {
    const city = searchInput.value.trim();
    if (city) fetchWeatherByCity(city);
});

searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        const city = searchInput.value.trim();
        if (city) fetchWeatherByCity(city);
    }
});

geoBtn.addEventListener("click", handleGeolocation);
unitToggle.addEventListener("click", toggleUnit);
themeToggle.addEventListener("click", toggleTheme);

// AI panel toggle
aiToggleBtn.addEventListener("click", toggleAIPanel);
document.querySelector(".ai-panel-header").addEventListener("click", (e) => {
    if (!e.target.closest("button")) toggleAIPanel();
});

// AI send
aiSendBtn.addEventListener("click", () => {
    sendAIMessage(aiChatInput.value.trim());
});

aiChatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendAIMessage(aiChatInput.value.trim());
    }
});

// Quick prompt buttons
aiQuickBtns.forEach(btn => {
    btn.addEventListener("click", () => {
        const text = btn.textContent.replace(/^[^\w]*/, "").trim();
        aiChatInput.value = text;
        sendAIMessage(text);
    });
});

// ============================================================
// INIT
// ============================================================
(function init() {
    loadTheme();
    loadRecentCities();

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            ({ coords }) => fetchWeatherByCoords(coords.latitude, coords.longitude),
            () => {}
        );
    }
})();
