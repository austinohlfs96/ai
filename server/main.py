import os
import logging
import openai
import re
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from weather import WeatherService
from traffic import TrafficService
from location_extraction import find_known_locations, get_distance
import markdown2

# Configure logging
logging.basicConfig(level=logging.INFO)

# Load environment variables
load_dotenv()
weather_api_key = os.getenv('WEATHER_API_KEY')
maps_api_key = os.getenv('GOOGLE_MAPS_API_KEY')
openai.api_key = os.getenv('key')

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

# --- UTILITIES ---

def extract_location_from_question(question):
    match = re.search(r'(?:weather\s+(?:in|at|for)?\s*)([a-zA-Z\s]+)', question.lower())
    if match:
        return match.group(1).strip().title()
    return None

def extract_origin_destination(text):
    match = re.search(r'from ([a-zA-Z\s]+?) to ([a-zA-Z\s]+?)(?:[\.,\?]|$)', text.lower())
    if match:
        return match.group(1).strip().title(), match.group(2).strip().title()
    return None, None

# --- PROMPT GENERATOR ---

def generate_contextual_prompt(user_question, user_location=None, reservation_details=None):
    weather_info = ""
    traffic_info = ""
    location_info = ""

    # Weather extraction
    inferred_location = extract_location_from_question(user_question)
    effective_location = user_location or inferred_location

    if effective_location:
        weather = weather_service.fetch_weather(effective_location)
        if weather:
            weather_info += f"\nUser Location Weather:\n{weather_service.format_weather_info(weather, effective_location)}\n"
        else:
            weather_info += f"\n⚠️ Weather data not available for {effective_location}.\n"

    # Reservation weather
    if reservation_details:
        destination = reservation_details.get('destination')
        reservation_date = reservation_details.get('date')
        if destination:
            res_weather = weather_service.fetch_weather(destination)
            if res_weather:
                weather_info += f"\nReservation Location Weather:\n{weather_service.format_weather_info(res_weather, destination)}\n"
        if reservation_date:
            location_info += f"Reservation date: {reservation_date}\n"

    # Route weather
    if "route" in user_question.lower() or "travel" in user_question.lower():
        stops = ["Parker", "Idaho Springs", "Silverthorne", "Vail"]
        weather_info += f"\nRoute Weather:\n{weather_service.get_weather_along_route(stops)}"

    # Traffic extraction via regex
    origin, destination = extract_origin_destination(user_question)
    if origin and destination:
        traffic_data = traffic_service.get_traffic_summary(origin, destination)
        if traffic_data:
            traffic_info += traffic_service.format_traffic_info(traffic_data)
        else:
            traffic_info += f"\n⚠️ Could not retrieve traffic info from {origin} to {destination}.\n"

    # Final prompt
    prompt = f"""
You are Spot, the official AI assistant for SpotSurfer Parking.
Your job is to provide helpful, concise, and always SpotSurfer-focused parking advice, suggestions, and answers first then use your best knowledge to help the user.

Use the following knowledge base, real-time weather, live traffic, and user context to help users make informed parking decisions and encourage them to book with SpotSurfer:
    -Use the users information to help recommend suggestions but also offer new options that would also suite the user.
    -Dont always offer discount codes only on occasional responses that will help the user have a more seemless experience.
    - Give helpful tips from about traffic travel plans local sights and attractions and restaurants.

USER CONTEXT:
{location_info}

KNOWLEDGE BASE:
{knowledge_base}

{weather_info}
{traffic_info}

User Question:
{user_question}

Answer:
"""
    return prompt

# --- GPT Query ---

def query_contextual_response(prompt):
    try:
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

# --- ROUTE ---

@app.route('/')
def serve_react():
    return send_from_directory(app.static_folder, 'index.html')

@app.errorhandler(404)
def not_found(e):
    return send_from_directory(app.static_folder, 'index.html')
    
@app.route('/ask', methods=['POST'])
def ask():
    try:
        data = request.json
        message = data.get('message', '')
        user_location = data.get('user_location')
        reservation_details = data.get('reservation_details', {})

        # Detect known locations in the message
        matched_locations = find_known_locations(message)
        distance_info = ""

        # If more than one location mentioned, calculate and add distances
        if len(matched_locations) > 1:
            loc_names = list(matched_locations.keys())
            for i in range(len(loc_names)):
                for j in range(i + 1, len(loc_names)):
                    loc1 = loc_names[i]
                    loc2 = loc_names[j]
                    dist = get_distance(matched_locations[loc1], matched_locations[loc2])
                    distance_info += f"📍 Distance from **{loc1}** to **{loc2}** is approximately **{dist} miles**.\n"

        # Inject distances into the prompt
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
        logging.error(f"Error in /ask route: {e}")
        return jsonify({
            "response": "An error occurred while processing your request.",
            "status": "error"
        }), 500

# --- MAIN ---

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5555)
