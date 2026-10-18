import os
import pickle
import numpy as np
import xgboost as xgb

MODEL_PATH = os.path.join(os.path.dirname(__file__), 'xgboost_chatbot.json')
ASSETS_PATH = os.path.join(os.path.dirname(__file__), 'model_assets.pkl')

_model = None
_vectorizer = None
_label_encoder = None
_responses = None

# Keyword-based fallback mapping: if the ML model is uncertain,
# check whether the user message contains any of these keywords.
KEYWORD_INTENT_MAP = {
    "project_info": ["bhoomi rakshak", "project", "hackathon", "sih", "overview", "purpose", "about", "what is this"],
    "architecture": ["tech stack", "architecture", "react", "fastapi", "sqlite", "vite", "leaflet", "three.js", "backend", "frontend", "framework", "database", "technology"],
    "priority_scoring": ["priority", "score", "scoring", "vulnerability", "red zone", "yellow zone", "hazard intensity", "exposure", "phasing"],
    "multi_hazard": ["multi-hazard", "multi hazard", "overlap", "composite risk", "fusion", "multiple hazards", "compound"],
    "evacuation_routing": ["evacuation", "routing", "dijkstra", "impedance", "corridor", "path", "route", "evacuate"],
    "site_suitability": ["relocation site", "suitability", "carrying capacity", "site selection", "suitable", "candidate site"],
    "economics": ["reverse insurance", "economic", "roi", "proactive", "reactive", "cost", "financial", "delay cost"],
    "climate_fund": ["climate fund", "pmay", "jjm", "pmgsy", "mgnrega", "ndmf", "sdrf", "grant", "fund calculator", "financing"],
    "certificates": ["certificate", "pdf", "sha-256", "reportlab", "tamper", "legal", "document"],
    "citizen_portal": ["citizen", "sos", "go-bag", "go bag", "voice advisory", "geolocation", "safe haven", "emergency"],
    "disaster_history": ["disaster history", "previous events", "past disaster", "historical", "event history"],
    "data_source": ["data source", "real data", "synthetic", "fake data", "demo data", "where does the data"],
    "greeting": ["hello", "hi", "hey", "good morning", "good evening", "good afternoon", "namaste", "howdy"],
    "goodbye": ["bye", "goodbye", "see you", "take care", "thanks bye"],
}

def load_model():
    global _model, _vectorizer, _label_encoder, _responses
    if _model is None:
        try:
            # Load assets
            with open(ASSETS_PATH, 'rb') as f:
                assets = pickle.load(f)
                _vectorizer = assets['vectorizer']
                _label_encoder = assets['label_encoder']
                _responses = assets['responses']
            
            # Load XGBoost model
            _model = xgb.XGBClassifier()
            _model.load_model(MODEL_PATH)
        except Exception as e:
            print(f"Error loading chatbot model: {e}")

def _keyword_fallback(text: str) -> str | None:
    """Try to match user input to an intent using keyword matching."""
    text_lower = text.lower()
    best_intent = None
    best_count = 0
    for intent, keywords in KEYWORD_INTENT_MAP.items():
        count = sum(1 for kw in keywords if kw in text_lower)
        if count > best_count:
            best_count = count
            best_intent = intent
    if best_intent and best_count > 0:
        return _responses.get(best_intent)
    return None

def get_chat_response(messages: list[dict]) -> str:
    """
    Given a list of messages, return the chatbot's response using the XGBoost model.
    Falls back to keyword matching if model confidence is low.
    """
    load_model()
    
    if _model is None or _vectorizer is None:
        return "I'm sorry, my AI engine is currently unavailable."
        
    # Get the latest user message
    user_message = ""
    for msg in reversed(messages):
        if msg.get("role") == "user":
            user_message = msg.get("content", "")
            break
            
    if not user_message:
        return "Please say something."
        
    try:
        # Transform input text
        X_input = _vectorizer.transform([user_message.lower()])
        
        # Predict probabilities
        probs = _model.predict_proba(X_input.toarray())[0]
        max_prob_idx = np.argmax(probs)
        max_prob = probs[max_prob_idx]
        
        # Confidence threshold
        CONFIDENCE_THRESHOLD = 0.25
        
        if max_prob >= CONFIDENCE_THRESHOLD:
            # Get intent and response from the ML model
            predicted_label_idx = _model.predict(X_input.toarray())[0]
            intent = _label_encoder.inverse_transform([predicted_label_idx])[0]
            return _responses.get(intent, _responses.get("fallback"))
        
        # ML model is not confident — try keyword-based fallback
        keyword_response = _keyword_fallback(user_message)
        if keyword_response:
            return keyword_response
            
        return _responses.get("fallback", "I didn't quite understand that.")
        
    except Exception as e:
        print(f"Error generating chat response: {e}")
        return "I encountered an error processing your message."

