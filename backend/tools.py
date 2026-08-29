"""Backend-executed tools exposed to Gemini via function calling.

These cover generic, public "online" data that a company knowledge base
would never contain: live web facts, weather, currency rates, and time.
All are keyless/free except web_search, which reuses GEMINI_API_KEY.
"""

import os
from datetime import datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import httpx
from google import genai
from google.genai import types

_HTTP_TIMEOUT = 10.0

# Open-Meteo WMO weather codes, collapsed to short human-readable labels.
_WEATHER_CODES = {
    0: "clear sky", 1: "mainly clear", 2: "partly cloudy", 3: "overcast",
    45: "fog", 48: "depositing rime fog",
    51: "light drizzle", 53: "moderate drizzle", 55: "dense drizzle",
    61: "slight rain", 63: "moderate rain", 65: "heavy rain",
    71: "slight snow", 73: "moderate snow", 75: "heavy snow",
    80: "slight rain showers", 81: "moderate rain showers", 82: "violent rain showers",
    95: "thunderstorm", 96: "thunderstorm with slight hail", 99: "thunderstorm with heavy hail",
}


async def web_search(query: str) -> dict:
    """Answer a generic/public question via a nested Gemini call using Google Search grounding.

    Kept as a separate nested call because the Gemini API does not allow combining
    built-in grounding tools with custom function-declaration tools in one request.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return {"error": "Web search is unavailable: GEMINI_API_KEY is not configured."}

    try:
        client = genai.Client(api_key=api_key)
        response = await client.aio.models.generate_content(
            model="gemini-3.6-flash",
            contents=query,
            config=types.GenerateContentConfig(
                tools=[types.Tool(google_search=types.GoogleSearch())],
                temperature=0.0,
            ),
        )

        sources: list[dict] = []
        candidate = response.candidates[0] if response.candidates else None
        grounding = candidate.grounding_metadata if candidate else None
        if grounding and grounding.grounding_chunks:
            for chunk in grounding.grounding_chunks:
                if chunk.web:
                    sources.append({"title": chunk.web.title or chunk.web.domain, "url": chunk.web.uri})

        return {"answer": response.text or "No web results found.", "sources": sources}
    except Exception as err:
        return {"error": f"Web search failed: {err}"}


async def get_weather(location: str) -> dict:
    """Fetch current weather conditions for a place name via Open-Meteo (keyless)."""
    try:
        async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
            geo_res = await client.get(
                "https://geocoding-api.open-meteo.com/v1/search",
                params={"name": location, "count": 1},
            )
            geo_res.raise_for_status()
            geo_results = geo_res.json().get("results") or []
            if not geo_results:
                return {"error": f"Could not find a location matching '{location}'."}

            place = geo_results[0]
            resolved_name = ", ".join(
                part for part in [place.get("name"), place.get("admin1"), place.get("country")] if part
            )

            weather_res = await client.get(
                "https://api.open-meteo.com/v1/forecast",
                params={"latitude": place["latitude"], "longitude": place["longitude"], "current_weather": "true"},
            )
            weather_res.raise_for_status()
            current = weather_res.json().get("current_weather") or {}

        return {
            "location": resolved_name,
            "temperatureC": current.get("temperature"),
            "windspeedKmh": current.get("windspeed"),
            "condition": _WEATHER_CODES.get(current.get("weathercode"), "unknown"),
            "observedAt": current.get("time"),
        }
    except Exception as err:
        return {"error": f"Weather lookup failed: {err}"}


async def convert_currency(amount: float, from_currency: str, to_currency: str) -> dict:
    """Convert an amount between currencies using live rates (keyless, open.er-api.com)."""
    try:
        from_code = from_currency.strip().upper()
        to_code = to_currency.strip().upper()

        async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
            res = await client.get(f"https://open.er-api.com/v6/latest/{from_code}")
            res.raise_for_status()
            data = res.json()

        rates = data.get("rates") or {}
        if to_code not in rates:
            return {"error": f"No exchange rate available for {from_code} -> {to_code}."}

        rate = rates[to_code]
        return {
            "amount": amount,
            "from": from_code,
            "to": to_code,
            "rate": rate,
            "convertedAmount": round(amount * rate, 4),
            "asOf": data.get("time_last_update_utc"),
        }
    except Exception as err:
        return {"error": f"Currency conversion failed: {err}"}


def get_current_datetime(timezone: str = "UTC") -> dict:
    """Return the current date/time in an IANA timezone. Pure stdlib, no network."""
    try:
        tz = ZoneInfo(timezone or "UTC")
    except ZoneInfoNotFoundError:
        return {"error": f"Unknown timezone '{timezone}'. Use an IANA name like 'Asia/Kolkata' or 'UTC'."}

    now = datetime.now(tz)
    return {
        "timezone": timezone or "UTC",
        "isoDatetime": now.isoformat(),
        "formatted": now.strftime("%A, %d %B %Y, %I:%M %p (%Z)"),
    }


TOOL_DECLARATIONS = [
    types.FunctionDeclaration(
        name="web_search",
        description=(
            "Search the live web for a generic, public, general-knowledge question that is NOT covered by "
            "the internal knowledge base (e.g. current events, public facts, definitions). Never use this "
            "for questions specifically about this company's internal HR/IT/policy documents."
        ),
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={"query": types.Schema(type=types.Type.STRING, description="The search query.")},
            required=["query"],
        ),
    ),
    types.FunctionDeclaration(
        name="get_weather",
        description="Get current weather conditions for a city or place name.",
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={
                "location": types.Schema(
                    type=types.Type.STRING, description="City and/or country, e.g. 'Tokyo, Japan'."
                )
            },
            required=["location"],
        ),
    ),
    types.FunctionDeclaration(
        name="convert_currency",
        description="Convert an amount from one currency to another using live exchange rates.",
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={
                "amount": types.Schema(type=types.Type.NUMBER, description="The amount to convert."),
                "from_currency": types.Schema(
                    type=types.Type.STRING, description="3-letter source currency code, e.g. 'USD'."
                ),
                "to_currency": types.Schema(
                    type=types.Type.STRING, description="3-letter target currency code, e.g. 'EUR'."
                ),
            },
            required=["amount", "from_currency", "to_currency"],
        ),
    ),
    types.FunctionDeclaration(
        name="get_current_datetime",
        description="Get the current date and time in a given IANA timezone (defaults to UTC).",
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={
                "timezone": types.Schema(
                    type=types.Type.STRING,
                    description="IANA timezone name, e.g. 'Asia/Kolkata', 'America/New_York'. Defaults to 'UTC'.",
                )
            },
            required=[],
        ),
    ),
]

TOOL_DISPATCH = {
    "web_search": web_search,
    "get_weather": get_weather,
    "convert_currency": convert_currency,
    "get_current_datetime": get_current_datetime,
}


def summarize_tool_result(name: str, result: dict) -> str:
    """Build a short human-readable summary of a tool's result for chat UI display."""
    if "error" in result:
        return result["error"]
    if name == "web_search":
        return (result.get("answer") or "")[:200]
    if name == "get_weather":
        return f"{result.get('location', '?')}: {result.get('temperatureC', '?')}\u00b0C, {result.get('condition', '?')}"
    if name == "convert_currency":
        return (
            f"{result.get('amount')} {result.get('from')} = {result.get('convertedAmount')} {result.get('to')} "
            f"(rate {result.get('rate')})"
        )
    if name == "get_current_datetime":
        return result.get("formatted", "")
    return str(result)[:200]
