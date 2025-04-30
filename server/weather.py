import requests
import time
import logging
import os
from dotenv import load_dotenv


class WeatherService:
    def __init__(self, api_key):
        self.api_key = api_key
        self.base_url = "http://api.openweathermap.org/data/2.5/weather"
        self.units = "imperial"

    def fetch_weather(self, location):
        """Fetch detailed weather data for a location (city name, optionally with state)."""
        try:
            params = {
                'q': f"{location},US",  # Add more specificity if needed
                'appid': self.api_key,
                'units': self.units
            }
            response = requests.get(self.base_url, params=params)
            response.raise_for_status()
            data = response.json()

            # Early exit if city is not found
            if data.get("cod") != 200:
                logging.warning(f"API returned error for {location}: {data.get('message')}")
                return None

            return self._parse_weather_data(data)

        except requests.RequestException as e:
            logging.error(f"API request error for '{location}': {e}")
            return None
        except Exception as e:
            logging.error(f"Unexpected error for '{location}': {e}")
            return None

    def _parse_weather_data(self, data):
        """Extract and normalize weather data."""
        try:
            return {
                "location": data.get("name"),
                "temperature": {
                    "current": data["main"].get("temp"),
                    "feels_like": data["main"].get("feels_like"),
                    "high": data["main"].get("temp_max"),
                    "low": data["main"].get("temp_min")
                },
                "weather": data["weather"][0] if data.get("weather") else {},
                "humidity": data["main"].get("humidity"),
                "wind": data.get("wind", {}),
                "clouds": data.get("clouds", {}).get("all"),
                "visibility": data.get("visibility", 0),
                "pressure": data["main"].get("pressure"),
                "sun": data.get("sys", {}),
                "timezone": data.get("timezone"),
                "coordinates": data.get("coord", {})
            }
        except KeyError as e:
            logging.warning(f"Missing expected field in API data: {e}")
            return None

    def format_weather_info(self, weather_data, location_fallback="Unknown"):
        """Format data for display."""
        if not weather_data:
            return f"⚠️ Weather information for {location_fallback} is currently unavailable."

        temp = weather_data["temperature"]
        weather = weather_data.get("weather", {})
        wind = weather_data.get("wind", {})
        sun = weather_data.get("sun", {})

        return (
            f"🌤️ **Weather in {weather_data.get('location', location_fallback)}:**\n"
            f"- Temperature: {temp.get('current')}°F (Feels like {temp.get('feels_like')}°F)\n"
            f"- High / Low: {temp.get('high')}°F / {temp.get('low')}°F\n"
            f"- Conditions: {weather.get('description', 'Unknown').capitalize()} ({weather.get('main', 'N/A')})\n"
            f"- Humidity: {weather_data.get('humidity')}%\n"
            f"- Wind: {wind.get('speed', 0)} mph"
            f"{' from ' + str(wind.get('deg')) + '°' if wind.get('deg') else ''}\n"
            f"- Cloud cover: {weather_data.get('clouds')}%\n"
            f"- Visibility: {weather_data['visibility'] / 1000:.1f} miles\n"
            f"- Pressure: {weather_data.get('pressure')} hPa\n"
            f"- Sunrise: {self._format_unix_time(sun.get('sunrise'))}\n"
            f"- Sunset: {self._format_unix_time(sun.get('sunset'))}"
        )

    def get_weather_for_locations(self, locations):
        """Get formatted weather info for a list of locations."""
        output = []
        for location in locations:
            data = self.fetch_weather(location)
            output.append(self.format_weather_info(data, location))
        return "\n\n".join(output)

    def _format_unix_time(self, timestamp):
        """Convert UNIX timestamp to HH:MM AM/PM format."""
        if not timestamp:
            return "Unknown"
        return time.strftime('%I:%M %p', time.localtime(timestamp))


# Example usage
if __name__ == '__main__':
    load_dotenv()
    api_key = os.getenv("WEATHER_API_KEY")

    if not api_key:
        print("❌ WEATHER_API_KEY not found in .env file.")
    else:
        service = WeatherService(api_key)

        # Dynamically get input from user
        user_input = input("Enter a city or multiple cities separated by commas: ")
        cities = [city.strip() for city in user_input.split(",") if city.strip()]

        if cities:
            print("\nFetching weather...\n")
            result = service.get_weather_for_locations(cities)
            print(result)
        else:
            print("⚠️ No valid locations provided.")
