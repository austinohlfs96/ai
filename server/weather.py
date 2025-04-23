import requests
import time
import logging


class WeatherService:
    def __init__(self, api_key):
        self.api_key = api_key
        self.base_url = "http://api.openweathermap.org/data/2.5/weather"
        self.units = "imperial"

    def fetch_weather(self, location):
        """
        Fetch detailed weather information from OpenWeatherMap API
        """
        try:
            params = {
                'q': location,
                'appid': self.api_key,
                'units': self.units
            }
            response = requests.get(self.base_url, params=params)
            response.raise_for_status()
            data = response.json()

            # Validate critical fields exist
            if 'main' not in data or 'weather' not in data or not data['weather']:
                logging.warning(f"Incomplete weather data for location: {location}")
                return None

            return {
                "temperature": {
                    "current": data['main'].get('temp'),
                    "feels_like": data['main'].get('feels_like'),
                    "high": data['main'].get('temp_max'),
                    "low": data['main'].get('temp_min')
                },
                "weather": {
                    "description": data['weather'][0].get('description', 'No description'),
                    "main": data['weather'][0].get('main'),
                    "icon": data['weather'][0].get('icon')
                },
                "humidity": data['main'].get('humidity'),
                "wind": {
                    "speed": data['wind'].get('speed'),
                    "direction": data['wind'].get('deg'),
                    "gust": data['wind'].get('gust')
                },
                "clouds": data['clouds'].get('all'),
                "visibility": data.get('visibility', 0),
                "pressure": data['main'].get('pressure'),
                "sun": {
                    "sunrise": data['sys'].get('sunrise'),
                    "sunset": data['sys'].get('sunset')
                },
                "timezone": data.get('timezone'),
                "coordinates": {
                    "lat": data['coord'].get('lat'),
                    "lon": data['coord'].get('lon')
                }
            }

        except requests.exceptions.RequestException as e:
            logging.error(f"Weather API request error for '{location}': {e}")
            return None
        except Exception as e:
            logging.error(f"Unexpected error fetching weather data for '{location}': {e}")
            return None

    def format_weather_info(self, weather_data, location):
        """
        Format detailed weather information for display
        """
        if not weather_data:
            return f"⚠️ Weather information for {location} is currently unavailable."

        temp = weather_data['temperature']
        weather = weather_data['weather']
        wind = weather_data['wind']
        sun = weather_data['sun']

        return (
            f"🌤️ **Weather in {location}:**\n"
            f"- Temperature: {temp['current']}°F (Feels like {temp['feels_like']}°F)\n"
            f"- High / Low: {temp['high']}°F / {temp['low']}°F\n"
            f"- Conditions: {weather['description'].capitalize()} ({weather['main']})\n"
            f"- Humidity: {weather_data['humidity']}%\n"
            f"- Wind: {wind['speed']} mph"
            f"{' from ' + str(wind['direction']) + '°' if wind['direction'] else ''}\n"
            f"- Cloud cover: {weather_data['clouds']}%\n"
            f"- Visibility: {weather_data['visibility'] / 1000:.1f} miles\n"
            f"- Pressure: {weather_data['pressure']} hPa\n"
            f"- Sunrise: {self._format_unix_time(sun['sunrise'])}\n"
            f"- Sunset: {self._format_unix_time(sun['sunset'])}"
        )

    def get_weather_along_route(self, locations):
        weather_details = []
        for loc in locations:
            weather = self.fetch_weather(loc)
            formatted = self.format_weather_info(weather, loc)
            weather_details.append(f"📍 **{loc}**\n{formatted}")
        return "\n\n".join(weather_details)

    def _format_unix_time(self, timestamp):
        """
        Convert Unix timestamp to readable local time
        """
        if not timestamp:
            return "Unknown"
        return time.strftime('%I:%M %p', time.localtime(timestamp))


# Example usage
if __name__ == '__main__':
    import os
    from dotenv import load_dotenv

    load_dotenv()
    weather_api_key = os.getenv('WEATHER_API_KEY')

    if weather_api_key:
        service = WeatherService(weather_api_key)
        cities = ["Parker", "Idaho Springs", "Silverthorne", "Vail"]
        info = service.get_weather_along_route(cities)
        print(info)
    else:
        print("❌ WEATHER_API_KEY not found in .env file.")
