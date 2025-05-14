import requests
import logging

class TrafficService:
    def __init__(self, api_key):
        self.api_key = api_key
        self.base_url = "https://maps.googleapis.com/maps/api/directions/json"
        self.geocode_url = "https://maps.googleapis.com/maps/api/geocode/json"

    def get_traffic_summary(self, origin, destination):
        """
        Fetch live traffic-aware travel time from Google Maps Directions API.
        """
        try:
            params = {
                "origin": origin,
                "destination": destination,
                "departure_time": "now",  # enables real-time traffic estimation
                "key": self.api_key
            }
            response = requests.get(self.base_url, params=params)
            response.raise_for_status()
            data = response.json()

            if data["status"] != "OK" or not data["routes"]:
                logging.warning(f"No routes found or API error: {data.get('status')}")
                return None

            leg = data["routes"][0]["legs"][0]
            duration = leg["duration"]["text"]
            duration_in_traffic = leg.get("duration_in_traffic", {}).get("text", duration)
            distance = leg["distance"]["text"]
            summary = data["routes"][0].get("summary", "Route summary not available")

            return {
                "origin": origin,
                "destination": destination,
                "distance": distance,
                "duration": duration,
                "duration_in_traffic": duration_in_traffic,
                "route_summary": summary,
            }

        except requests.exceptions.RequestException as e:
            logging.error(f"Traffic API request failed: {e}")
            return None
        except Exception as e:
            logging.error(f"Unexpected error in TrafficService: {e}")
            return None

    def format_traffic_info(self, data):
        """
        Format traffic info for display or prompt inclusion.
        """
        if not data:
            return "Live traffic data is currently unavailable."

        return (
            f"Live traffic from {data['origin']} to {data['destination']}:\n"
            f"- Distance: {data['distance']}\n"
            f"- Estimated time (normal): {data['duration']}\n"
            f"- Estimated time (with traffic): {data['duration_in_traffic']}\n"
            f"- Route: {data['route_summary']}"
        )

    def get_route_stops(self, origin, destination, max_stops=5, reverse_geocode=False):
        """
        Get evenly spaced stops (end_location points) along a driving route.
        Optionally reverse geocodes each point into a human-readable name.
        """
        try:
            params = {
                "origin": origin,
                "destination": destination,
                "departure_time": "now",  # Add this for traffic-aware routes
                "key": self.api_key
            }
            response = requests.get(self.base_url, params=params)
            response.raise_for_status()
            data = response.json()

            if data['status'] != 'OK' or not data['routes']:
                logging.warning(f"Directions API error: {data.get('status')}")
                return []

            steps = data['routes'][0]['legs'][0]['steps']
            total_steps = len(steps)
            interval = max(1, total_steps // max_stops)

            waypoints = []
            for i in range(0, total_steps, interval):
                loc = steps[i]['end_location']
                if reverse_geocode:
                    place = self.reverse_geocode(loc['lat'], loc['lng'])
                else:
                    place = f"{loc['lat']},{loc['lng']}"
                waypoints.append(place)

            return waypoints

        except requests.exceptions.RequestException as e:
            logging.error(f"Route stops request failed: {e}")
            return []
        except Exception as e:
            logging.error(f"Unexpected error in get_route_stops: {e}")
            return []

    def reverse_geocode(self, lat, lng):
        """
        Convert lat/lng to a human-readable location using Google Maps Geocoding API.
        """
        try:
            params = {
                "latlng": f"{lat},{lng}",
                "key": self.api_key
            }
            response = requests.get(self.geocode_url, params=params)
            response.raise_for_status()
            results = response.json().get("results", [])
            if results:
                return results[0]["formatted_address"]
        except Exception as e:
            logging.warning(f"Reverse geocoding failed: {e}")
        return f"{lat},{lng}"
