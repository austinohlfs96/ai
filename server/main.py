import os
import logging
import openai
import re
import requests
import time
import json
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
from weather import WeatherService
from traffic import TrafficService
from location_extraction import find_known_locations, get_distance
from pywebpush import webpush, WebPushException
import markdown2
import datetime

subscriptions = []

# Configure logging
logging.basicConfig(level=logging.INFO)

# Load environment variables
load_dotenv()
weather_api_key = os.getenv('WEATHER_API_KEY')
maps_api_key = os.getenv('GOOGLE_MAPS_API_KEY')
openai.api_key = os.getenv('key')
VAPID_PUBLIC_KEY = os.getenv('VAPID_PUBLIC_KEY')
VAPID_PRIVATE_KEY = os.getenv('VAPID_PRIVATE_KEY')
VAPID_CLAIMS = {"sub": "mailto:austin@spotsurfer.com"}

# Initialize services
weather_service = WeatherService(weather_api_key)
traffic_service = TrafficService(maps_api_key)

# Flask setup
app = Flask(__name__, static_folder="client_build", static_url_path="/")
CORS(app)

# Load knowledge base
def load_knowledge_base():
    try:
        with open('knowledge_base.txt', 'r') as f:
            return f.read()
    except Exception as e:
        logging.error(f"Error loading knowledge base: {e}")
        return ""

knowledge_base = load_knowledge_base()

def reverse_geocode(lat, lng, api_key):
    try:
        url = f"https://maps.googleapis.com/maps/api/geocode/json?latlng={lat},{lng}&key={api_key}"
        resp = requests.get(url)
        results = resp.json().get("results", [])
        if results:
            components = results[0]["address_components"]
            for comp in components:
                if "locality" in comp["types"]:
                    return comp["long_name"]
                if "administrative_area_level_2" in comp["types"]:
                    return comp["long_name"]
            # fallback
            return results[0]["formatted_address"]
    except Exception as e:
        logging.warning(f"Reverse geocoding failed for {lat},{lng}: {e}")
    return f"{lat},{lng}"

# --- UTILITIES ---
def normalize_location_name(place_name, api_key):
    try:
        url = "https://maps.googleapis.com/maps/api/geocode/json"
        params = {"address": place_name, "key": maps_api_key}
        response = requests.get(url, params=params)
        data = response.json()
        if data['status'] == "OK" and data['results']:
            return data['results'][0]['formatted_address']
    except Exception as e:
        logging.warning(f"Failed to normalize location: {place_name} - {e}")
    return place_name  # fallback to original if failure


def extract_location_from_question(question):
    match = re.search(r'(?:weather\s+(?:in|at|for)?\s*)([a-zA-Z\s]+)', question.lower())
    if match:
        return match.group(1).strip().title()
    return None

def extract_origin_destination(text):
    text = text.lower()

    # Match full "from X to Y"
    match = re.search(r'from ([^,.?]+?) to ([^,.?]+)', text)
    if match:
        return match.group(1).strip().title(), match.group(2).strip().title()

    # Match just destination
    match = re.search(r'\bto ([^,.?]+)', text)
    if match:
        return None, match.group(1).strip().title()

    return None, None



# --- PROMPT GENERATOR ---

def generate_contextual_prompt(user_question, user_location=None, reservation_details=None):
    weather_info = ""
    traffic_info = ""
    location_info = ""

    inferred_location = extract_location_from_question(user_question)
    effective_location = user_location or inferred_location

    # --- Fetch Weather for Effective Location ---
    if effective_location:
        try:
            weather = weather_service.fetch_weather(effective_location)
            if weather:
                weather_info += f"\nUser Location Weather:\n{weather_service.format_weather_info(weather, effective_location)}\n"
            else:
                weather_info += f"\n⚠️ Weather data not available for {effective_location}.\n"
        except Exception as e:
            logging.warning(f"Weather API error for {effective_location}: {e}")
            weather_info += f"\n⚠️ Could not fetch weather for {effective_location}.\n"

    # --- Reservation Context ---
    if reservation_details:
        destination = reservation_details.get('destination')
        reservation_date = reservation_details.get('date')
        if destination:
            try:
                res_weather = weather_service.fetch_weather(destination)
                if res_weather:
                    weather_info += f"\nReservation Location Weather:\n{weather_service.format_weather_info(res_weather, destination)}\n"
            except Exception as e:
                logging.warning(f"Reservation weather error for {destination}: {e}")
        if reservation_date:
            location_info += f"Reservation date: {reservation_date}\n"

    # --- Origin/Destination Extraction ---
    origin, destination = extract_origin_destination(user_question)

    # Interpret "MY_LOCATION"
    if origin == "MY_LOCATION":
        origin = user_location

    # Fallbacks
    if not origin and user_location:
        origin = user_location
    if not destination and reservation_details.get("destination"):
        destination = reservation_details["destination"]

    # Normalize both origin and destination before using them
    if origin:
        origin = normalize_location_name(origin, maps_api_key)
    if destination:
        destination = normalize_location_name(destination, maps_api_key)

    # --- Route Weather ---
    if origin and destination:
        try:
            stops = traffic_service.get_route_stops(origin, destination, max_stops=4, reverse_geocode=True)
            if stops:
                weather_info += f"\n\n🌤️ **Route Weather Forecast** (from {origin} to {destination}):\n"
                weather_info += weather_service.get_weather_along_route(stops)
            else:
                weather_info += f"\n⚠️ Couldn't get route weather from {origin} to {destination}."
        except Exception as e:
            logging.warning(f"Route weather error from {origin} to {destination}: {e}")
            weather_info += f"\n⚠️ Error retrieving weather for your route from {origin} to {destination}.\n"

# --- Live Traffic Info ---
        if origin and destination:
            try:
                traffic_data = traffic_service.get_traffic_summary(origin, destination)
                if traffic_data:
                    traffic_info += f"\n\n🚗 **Live Traffic Update** (from {origin} to {destination}):\n"
                    traffic_info += traffic_service.format_traffic_info(traffic_data)
                else:
                    traffic_info += f"\n⚠️ Could not retrieve traffic info from {origin} to {destination}.\n"
            except Exception as e:
                logging.warning(f"Traffic API error from {origin} to {destination}: {e}")
                traffic_info += f"\n⚠️ Error fetching traffic info between {origin} and {destination}.\n"

    # --- Prompt Assembly ---
    current_datetime = datetime.datetime.now().strftime('%A, %B %d, %Y at %I:%M %p')

    prompt = f"""
You are the official AI assistant for SpotSurfer Parking, an online parking management software.
Your job is to provide helpful, concise, and always SpotSurfer-focused parking advice, suggestions, and answers first, then use your best knowledge to help the user.

Use the following knowledge base, real-time weather, live traffic, and user context to help users make informed parking decisions and encourage them to book with SpotSurfer:
    - Only answer questions that regard Spotsurfer or parkinging or traffic or weather conditions that might effect the users travel or experience.
    - Never mention any of Spotsurfer's rival parking companies like Spothero or parkhub.
    - Use the user's information to recommend nearby parking and travel tips.
    - Only offer discount codes on occasion to improve user experience.
    - Suggest things to do (restaurants, scenic routes, shopping, etc.) that enhance the user's trip.
    - Use current weather and traffic to help the user plan ahead (e.g., departure time, gear, conditions).
    - Do NOT mention past events or anything more than 6 weeks away.
    - Mention only events that are happening this weekend or in the next few weeks.
    - All events must be mentioned only if they’re timely and relevant to the current date.
    - Do NOT mention past events or operations that are already over.
    - For example, if the ski season has ended (April 20, 2025), do not suggest skiing or gondola access.
    - Use the current date to determine what services are active. Ski season closes April 20. After that, do NOT mention ski lifts or mountain access unless summer gondola operations are running.
    - You can also track a user's trip and proactively alert them when they are near available SpotSurfer parking locations.


Current Date and Time: {current_datetime}
{location_info}

KNOWLEDGE BASE:
{knowledge_base}

--- Real-Time Travel Insights ---

{weather_info}

{traffic_info}

---


User Question:
{user_question}

Answer:
"""
    return prompt


# --- GPT Query ---

def query_contextual_response(prompt):
    try:
        logging.info("==== GPT PROMPT START ====")
        logging.info(prompt)
        logging.info("==== GPT PROMPT END ====")
        response = openai.ChatCompletion.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.5,
            max_tokens=700
        )
        return response['choices'][0]['message']['content'].strip()
    except Exception as e:
        logging.error(f"OpenAI query failed: {e}")
        return "⚠️ Sorry, I couldn't get the information right now. Please try again shortly."

# --- ROUTES ---

@app.route('/')
def serve_react():
    return send_from_directory(app.static_folder, 'index.html')

@app.errorhandler(404)
def not_found(e):
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/subscribe', methods=['POST'])
def subscribe():
    subscription_info = request.json
    print("📥 Received subscription info:", subscription_info)
    subscriptions.append(subscription_info)
    return jsonify({"success": True}), 201


@app.route('/unsubscribe', methods=['POST'])
def unsubscribe():
    subscription_info = request.json
    subscriptions.remove(subscription_info)  # ✅ Remove it
    return jsonify({"success": True}), 201

@app.route('/send-notification', methods=['POST'])
def send_notification():
    try:
        data = request.json
        title = data.get("title", "📍 SpotSurfer Update")
        body = data.get("body", "Your trip is still being tracked.")

        message = json.dumps({ "title": title, "body": body })

        print(f"🧪 Subscriptions count: {len(subscriptions)}")
        if not subscriptions:
            return jsonify({ "error": "No subscriptions to notify." }), 400

        failures = 0
        for sub in subscriptions:
            try:
                send_push_notification(sub, message)
            except Exception as e:
                logging.warning(f"Push to one subscription failed: {e}")
                failures += 1

        return jsonify({ "sent": len(subscriptions) - failures, "failed": failures })

    except Exception as e:
        logging.error(f"Error sending push notification: {e}")
        return jsonify({ "error": "Notification failed!" }), 500



def send_push_notification(subscription_info, message):
    try:
        print("📤 Sending to subscription:", subscription_info.get("endpoint"))
        webpush(
            subscription_info=subscription_info,
            data=message,
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims=VAPID_CLAIMS
        )
    except WebPushException as ex:
        print("❌ WebPushException occurred")
        print("Exception:", repr(ex))
        if ex.response is not None:
            print("🔐 Status code:", ex.response.status_code)
            print("📄 Response body:", ex.response.text)
        raise



@app.route('/ask', methods=['POST'])
def ask():
    try:
        data = request.json
        message = data.get('message', '')
        intent = data.get('intent')  # new intent support
        reservation_details = data.get('reservation_details', {})
        user_location = data.get('user_location')
        lat = data.get('lat')
        lng = data.get('lng')

        # simple shortcut response
        if intent == 'trip_start_simple':
            # Always resolve user location dynamically
            user_location = reverse_geocode(lat, lng, maps_api_key)
            logging.info(f"Reverse-geocoded user location for trip start: {user_location}")

            response_text = f"Now tracking your trip from {user_location or 'your location'}."

            return jsonify({
                "response": response_text,
                "html": markdown2.markdown(response_text),
                "status": "success"
            })

        # Use lat/lng to determine user location if not explicitly provided
        if not user_location and lat is not None and lng is not None:
            user_location = reverse_geocode(lat, lng, maps_api_key)
            logging.info(f"Resolved user_location from coordinates: {user_location}")

        matched_locations = find_known_locations(message)
        distance_info = ""

        if len(matched_locations) > 1:
            loc_names = list(matched_locations.keys())
            for i in range(len(loc_names)):
                for j in range(i + 1, len(loc_names)):
                    loc1 = loc_names[i]
                    loc2 = loc_names[j]
                    dist = get_distance(matched_locations[loc1], matched_locations[loc2])
                    distance_info += f"📍 Distance from **{loc1}** to **{loc2}** is approximately **{dist} miles**.\n"

        prompt = generate_contextual_prompt(message, user_location, reservation_details)
        if distance_info:
            prompt += f"\n\nLocation Insights:\n{distance_info}"

        ai_response = query_contextual_response(prompt)
        html_response = markdown2.markdown(ai_response)

        return jsonify({
            "response": ai_response,
            "html": html_response,
            "status": "success"
        })

    except Exception as e:
        logging.exception(f"Error in /ask route: {e}")
        return jsonify({
            "response": "An error occurred while processing your request.",
            "status": "error"
        }), 500





if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5555)
