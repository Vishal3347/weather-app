# WeatherNow + AI

A real-time weather app with an integrated AI weather assistant powered by Claude.

## Features
- 🌤 Live weather + 5-day forecast via OpenWeatherMap API
- ✦ AI-generated weather insights (auto on city load)
- 💬 Conversational weather chatbot with multi-turn context
- 📍 Geolocation support
- 🌙 Dark/light mode, °C/°F toggle, recent searches

## Tech Stack
- Vanilla JS, HTML, CSS (no frameworks)
- OpenWeatherMap API
- Anthropic Claude API (claude-sonnet-4)
- Deployed on Vercel with a serverless API proxy

## Setup

### 1. OpenWeatherMap
Replace the key in `config.js` with your own from https://openweathermap.org

### 2. Anthropic API Key (for AI features)
The `api/ai.js` file is a Vercel serverless function that proxies requests to Claude securely.

```bash
# Add your API key as a Vercel environment variable (never exposed to browser)
vercel env add ANTHROPIC_API_KEY

# Deploy
vercel --prod
```

### 3. Update the API endpoint in script.js
In `script.js`, the `callClaudeAPI` function currently calls `https://api.anthropic.com/v1/messages` directly.
After setting up the Vercel proxy, change it to call `/api/ai` instead:

```js
// In callClaudeAPI(), change the fetch URL from:
const response = await fetch("https://api.anthropic.com/v1/messages", { ... })

// To:
const response = await fetch("/api/ai", { ... })
// (and remove the Content-Type header — the proxy handles auth)
```

## Resume Bullet Points
> Built an AI-powered weather assistant integrating real-time OpenWeatherMap data with Claude LLM via a secure Vercel serverless proxy, enabling natural language weather queries with multi-turn context — deployed on Vercel.

> Architected a RAG-adjacent pipeline injecting live meteorological data (temperature, humidity, wind, 5-day forecast) as context into LLM prompts, demonstrating real-world LLM integration with external API data.
