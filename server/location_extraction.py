# location_extraction.py

import re

# A dictionary of known landmarks and SpotSurfer facilities with coordinates
KNOWN_LOCATIONS = {
    "Arrabelle Valet": {"lat": 39.6404, "lng": -106.3742},
    "Lionshead Village": {"lat": 39.6415, "lng": -106.3780},
    "Vail Village": {"lat": 39.6400, "lng": -106.3740},
    "Vail Daily building": {"lat": 39.6408, "lng": -106.3792},
    "63 Willow Place": {"lat": 39.6390, "lng": -106.3735},
    "Bluebird Parking": {"lat": 39.6422, "lng": -106.3795},
    # Add more known locations here...
}

def find_known_locations(text):
    """Scan text for known location names using regex"""
    found = {}
    for name in KNOWN_LOCATIONS:
        if re.search(re.escape(name), text, re.IGNORECASE):
            found[name] = KNOWN_LOCATIONS[name]
    return found

def get_distance(loc1, loc2):
    """Calculate distance in miles using haversine formula"""
    from math import radians, cos, sin, asin, sqrt
    lon1, lat1 = loc1["lng"], loc1["lat"]
    lon2, lat2 = loc2["lng"], loc2["lat"]

    # convert decimal degrees to radians
    lon1, lat1, lon2, lat2 = map(radians, [lon1, lat1, lon2, lat2])

    # haversine formula
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * asin(sqrt(a))
    r = 3956  # Radius of earth in miles
    return round(c * r, 2)
