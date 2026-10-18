import json
import pickle
import xgboost as xgb
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import LabelEncoder
import numpy as np

# Training data (Intents and Examples) based entirely on Bhoomi Rakshak prototype documentation
training_data = [
    # ── General Info ──────────────────────────────────────────────────
    {"intent": "project_info", "text": "what is this project?"},
    {"intent": "project_info", "text": "explain bhoomi rakshak"},
    {"intent": "project_info", "text": "what is bhoomi rakshak?"},
    {"intent": "project_info", "text": "tell me about this hackathon project"},
    {"intent": "project_info", "text": "smart india hackathon problem statement"},
    {"intent": "project_info", "text": "who is this for?"},
    {"intent": "project_info", "text": "what does this app do"},
    {"intent": "project_info", "text": "tell me about the project"},
    {"intent": "project_info", "text": "what is the purpose of this platform"},
    {"intent": "project_info", "text": "describe bhoomi rakshak"},
    {"intent": "project_info", "text": "what problem does this solve"},
    {"intent": "project_info", "text": "sih project details"},
    {"intent": "project_info", "text": "who made this"},
    {"intent": "project_info", "text": "what is the use case"},
    {"intent": "project_info", "text": "give me an overview"},
    {"intent": "project_info", "text": "summary of the project"},
    {"intent": "project_info", "text": "why was this built"},
    {"intent": "project_info", "text": "what is the goal of bhoomi rakshak"},
    {"intent": "project_info", "text": "disaster relocation platform"},
    {"intent": "project_info", "text": "about this system"},

    # ── Architecture & Tech Stack ─────────────────────────────────────
    {"intent": "architecture", "text": "what is the architecture?"},
    {"intent": "architecture", "text": "tech stack"},
    {"intent": "architecture", "text": "technologies used"},
    {"intent": "architecture", "text": "what backend are you using?"},
    {"intent": "architecture", "text": "is it react or angular?"},
    {"intent": "architecture", "text": "database used"},
    {"intent": "architecture", "text": "sqlite fastapi react"},
    {"intent": "architecture", "text": "what framework is the frontend built with"},
    {"intent": "architecture", "text": "what language is the backend"},
    {"intent": "architecture", "text": "how is the system designed"},
    {"intent": "architecture", "text": "which libraries are used"},
    {"intent": "architecture", "text": "tell me about the technology"},
    {"intent": "architecture", "text": "system design overview"},
    {"intent": "architecture", "text": "what tools and frameworks are used"},
    {"intent": "architecture", "text": "is the database sql or nosql"},
    {"intent": "architecture", "text": "fastapi python backend"},
    {"intent": "architecture", "text": "react vite frontend"},
    {"intent": "architecture", "text": "what stack is this built on"},
    {"intent": "architecture", "text": "client server model"},
    {"intent": "architecture", "text": "leaflet three.js"},
    {"intent": "architecture", "text": "what technologies did you use"},
    {"intent": "architecture", "text": "which technologies are you using"},
    {"intent": "architecture", "text": "programming languages used"},

    # ── Priority Scoring Engine ───────────────────────────────────────
    {"intent": "priority_scoring", "text": "how is the priority score calculated?"},
    {"intent": "priority_scoring", "text": "what is the formula for priority?"},
    {"intent": "priority_scoring", "text": "how do you index vulnerability?"},
    {"intent": "priority_scoring", "text": "explain hazard intensity and exposure"},
    {"intent": "priority_scoring", "text": "what makes a zone red?"},
    {"intent": "priority_scoring", "text": "immediate short-term medium-term phasing"},
    {"intent": "priority_scoring", "text": "how is priority decided"},
    {"intent": "priority_scoring", "text": "what is the scoring model"},
    {"intent": "priority_scoring", "text": "how does the scoring work"},
    {"intent": "priority_scoring", "text": "explain the priority engine"},
    {"intent": "priority_scoring", "text": "what factors affect the score"},
    {"intent": "priority_scoring", "text": "how are zones prioritized"},
    {"intent": "priority_scoring", "text": "vulnerability index calculation"},
    {"intent": "priority_scoring", "text": "population exposure formula"},
    {"intent": "priority_scoring", "text": "red zone yellow zone green zone"},
    {"intent": "priority_scoring", "text": "what is a red zone"},
    {"intent": "priority_scoring", "text": "how are risk zones classified"},
    {"intent": "priority_scoring", "text": "elderly population disability housing"},
    {"intent": "priority_scoring", "text": "score threshold for immediate relocation"},
    {"intent": "priority_scoring", "text": "priority score meaning"},

    # ── Multi-Hazard Fusion ───────────────────────────────────────────
    {"intent": "multi_hazard", "text": "what if there are multiple hazards?"},
    {"intent": "multi_hazard", "text": "multi-hazard fusion engine"},
    {"intent": "multi_hazard", "text": "overlapping disasters"},
    {"intent": "multi_hazard", "text": "how does the overlap bonus work?"},
    {"intent": "multi_hazard", "text": "composite risk calculation"},
    {"intent": "multi_hazard", "text": "what happens when hazards overlap"},
    {"intent": "multi_hazard", "text": "how is composite risk computed"},
    {"intent": "multi_hazard", "text": "multiple disasters at the same time"},
    {"intent": "multi_hazard", "text": "flood and earthquake together"},
    {"intent": "multi_hazard", "text": "combined hazard score"},
    {"intent": "multi_hazard", "text": "multi hazard analysis"},
    {"intent": "multi_hazard", "text": "how are overlapping risks handled"},
    {"intent": "multi_hazard", "text": "fusion of hazard scores"},
    {"intent": "multi_hazard", "text": "compound disaster risk"},
    {"intent": "multi_hazard", "text": "overlap bonus explained"},

    # ── Evacuation & Routing ──────────────────────────────────────────
    {"intent": "evacuation_routing", "text": "how does evacuation routing work?"},
    {"intent": "evacuation_routing", "text": "dijkstra shortest path"},
    {"intent": "evacuation_routing", "text": "hazard impedance multiplier"},
    {"intent": "evacuation_routing", "text": "how to avoid active disaster paths?"},
    {"intent": "evacuation_routing", "text": "red corridor impedance penalty"},
    {"intent": "evacuation_routing", "text": "how is the evacuation route found"},
    {"intent": "evacuation_routing", "text": "explain the routing algorithm"},
    {"intent": "evacuation_routing", "text": "shortest safe path"},
    {"intent": "evacuation_routing", "text": "how does the map show evacuation"},
    {"intent": "evacuation_routing", "text": "safe corridor routing"},
    {"intent": "evacuation_routing", "text": "path finding algorithm"},
    {"intent": "evacuation_routing", "text": "how to evacuate safely"},
    {"intent": "evacuation_routing", "text": "route to nearest safe zone"},
    {"intent": "evacuation_routing", "text": "evacuation corridor penalty"},
    {"intent": "evacuation_routing", "text": "dynamic hazard avoidance"},
    {"intent": "evacuation_routing", "text": "how does the evacuation work"},

    # ── Relocation Site Suitability ───────────────────────────────────
    {"intent": "site_suitability", "text": "how do you choose relocation sites?"},
    {"intent": "site_suitability", "text": "what is the multi-factor suitability index?"},
    {"intent": "site_suitability", "text": "8 statutory suitability criteria"},
    {"intent": "site_suitability", "text": "carrying capacity and road accessibility"},
    {"intent": "site_suitability", "text": "what makes a site highly suitable?"},
    {"intent": "site_suitability", "text": "relocation site selection criteria"},
    {"intent": "site_suitability", "text": "how are sites evaluated"},
    {"intent": "site_suitability", "text": "what factors determine a good relocation site"},
    {"intent": "site_suitability", "text": "site suitability score"},
    {"intent": "site_suitability", "text": "water healthcare education livelihood"},
    {"intent": "site_suitability", "text": "suitability index explained"},
    {"intent": "site_suitability", "text": "how to find the best relocation site"},
    {"intent": "site_suitability", "text": "safe relocation area"},
    {"intent": "site_suitability", "text": "candidate site ranking"},
    {"intent": "site_suitability", "text": "eight factor suitability"},

    # ── Reverse Insurance & Economics ─────────────────────────────────
    {"intent": "economics", "text": "what is reverse insurance?"},
    {"intent": "economics", "text": "economic resilience calculus"},
    {"intent": "economics", "text": "proactive vs reactive cost"},
    {"intent": "economics", "text": "roi of proactive relocation"},
    {"intent": "economics", "text": "delay cost penalties"},
    {"intent": "economics", "text": "cost benefit analysis"},
    {"intent": "economics", "text": "how much money does proactive relocation save"},
    {"intent": "economics", "text": "financial return of relocation"},
    {"intent": "economics", "text": "economics of disaster preparedness"},
    {"intent": "economics", "text": "why is proactive cheaper than reactive"},
    {"intent": "economics", "text": "ndrf deployment cost"},
    {"intent": "economics", "text": "ex-gratia emergency camp savings"},
    {"intent": "economics", "text": "return on investment for relocation"},
    {"intent": "economics", "text": "reverse insurance model"},
    {"intent": "economics", "text": "financial impact of delayed action"},
    {"intent": "economics", "text": "cost benefit analysis of relocation"},
    {"intent": "economics", "text": "what is the cost benefit of doing this"},
    {"intent": "economics", "text": "money saved by relocation"},
    {"intent": "economics", "text": "how much does it save"},

    # ── Climate Fund Calculator ───────────────────────────────────────
    {"intent": "climate_fund", "text": "climate fund calculator"},
    {"intent": "climate_fund", "text": "statutory grant convergence"},
    {"intent": "climate_fund", "text": "pmay-g jjm pmgsy mgnrega"},
    {"intent": "climate_fund", "text": "ndmf sdrf center state ratios"},
    {"intent": "climate_fund", "text": "government funding schemes"},
    {"intent": "climate_fund", "text": "how are funds calculated"},
    {"intent": "climate_fund", "text": "disaster financing india"},
    {"intent": "climate_fund", "text": "what schemes are used for funding"},
    {"intent": "climate_fund", "text": "center state fiscal ratio"},
    {"intent": "climate_fund", "text": "finance commission fund allocation"},
    {"intent": "climate_fund", "text": "housing water roads wages schemes"},
    {"intent": "climate_fund", "text": "multi scheme convergence"},
    {"intent": "climate_fund", "text": "how does the fund calculator work"},
    {"intent": "climate_fund", "text": "himalayan state funding ratio"},

    # ── Certificates ──────────────────────────────────────────────────
    {"intent": "certificates", "text": "how to generate a certificate?"},
    {"intent": "certificates", "text": "what is a legal certificate?"},
    {"intent": "certificates", "text": "tamper evident sha-256 hash"},
    {"intent": "certificates", "text": "reportlab pdf generation"},
    {"intent": "certificates", "text": "legal relocation certificate"},
    {"intent": "certificates", "text": "how are certificates created"},
    {"intent": "certificates", "text": "pdf certificate download"},
    {"intent": "certificates", "text": "official document generation"},
    {"intent": "certificates", "text": "audit compliance certificate"},
    {"intent": "certificates", "text": "cryptographic verification hash"},
    {"intent": "certificates", "text": "government style pdf"},
    {"intent": "certificates", "text": "certificate for relocation"},
    {"intent": "certificates", "text": "tamper proof document"},

    # ── Citizen Portal ────────────────────────────────────────────────
    {"intent": "citizen_portal", "text": "what can citizens do?"},
    {"intent": "citizen_portal", "text": "citizen resilience portal"},
    {"intent": "citizen_portal", "text": "sos speed dial and go-bag"},
    {"intent": "citizen_portal", "text": "bilingual voice advisory"},
    {"intent": "citizen_portal", "text": "ground observation feedback loop"},
    {"intent": "citizen_portal", "text": "citizen page features"},
    {"intent": "citizen_portal", "text": "how can people use this"},
    {"intent": "citizen_portal", "text": "nearest safe haven"},
    {"intent": "citizen_portal", "text": "emergency contact numbers"},
    {"intent": "citizen_portal", "text": "hindi english voice alert"},
    {"intent": "citizen_portal", "text": "go bag checklist"},
    {"intent": "citizen_portal", "text": "citizen observations"},
    {"intent": "citizen_portal", "text": "html5 geolocation feature"},
    {"intent": "citizen_portal", "text": "public facing features"},
    {"intent": "citizen_portal", "text": "what is the citizen portal"},

    # ── Disaster History ──────────────────────────────────────────────
    {"intent": "disaster_history", "text": "what is disaster history?"},
    {"intent": "disaster_history", "text": "how are previous events recorded?"},
    {"intent": "disaster_history", "text": "does history replace hazard data?"},
    {"intent": "disaster_history", "text": "past disaster events"},
    {"intent": "disaster_history", "text": "historical disaster data"},
    {"intent": "disaster_history", "text": "previous disasters in a zone"},
    {"intent": "disaster_history", "text": "event history records"},
    {"intent": "disaster_history", "text": "how is disaster history used"},
    {"intent": "disaster_history", "text": "prior events supporting evidence"},
    {"intent": "disaster_history", "text": "past floods earthquakes landslides"},

    # ── Data Source ───────────────────────────────────────────────────
    {"intent": "data_source", "text": "is this real data?"},
    {"intent": "data_source", "text": "where does the data come from?"},
    {"intent": "data_source", "text": "prototype synthetic data"},
    {"intent": "data_source", "text": "is the data fake"},
    {"intent": "data_source", "text": "what data is being used"},
    {"intent": "data_source", "text": "demo data or real data"},
    {"intent": "data_source", "text": "data sources for this project"},
    {"intent": "data_source", "text": "are the records real"},
    {"intent": "data_source", "text": "synthetic or actual data"},
    {"intent": "data_source", "text": "sample data for demonstration"},

    # ── Greetings ─────────────────────────────────────────────────────
    {"intent": "greeting", "text": "hello"},
    {"intent": "greeting", "text": "hi"},
    {"intent": "greeting", "text": "good morning"},
    {"intent": "greeting", "text": "hey"},
    {"intent": "greeting", "text": "hi there"},
    {"intent": "greeting", "text": "good evening"},
    {"intent": "greeting", "text": "good afternoon"},
    {"intent": "greeting", "text": "howdy"},
    {"intent": "greeting", "text": "hey there"},
    {"intent": "greeting", "text": "hola"},
    {"intent": "greeting", "text": "namaste"},

    # ── Goodbye ───────────────────────────────────────────────────────
    {"intent": "goodbye", "text": "bye"},
    {"intent": "goodbye", "text": "thanks, goodbye"},
    {"intent": "goodbye", "text": "see you later"},
    {"intent": "goodbye", "text": "thank you bye"},
    {"intent": "goodbye", "text": "goodbye"},
    {"intent": "goodbye", "text": "take care"},
    {"intent": "goodbye", "text": "that's all thanks"},
    {"intent": "goodbye", "text": "ok bye"},
]

# Responses mapping
responses = {
    "greeting": "Hello! I am the Bhoomi Rakshak assistant. How can I help you today?",
    "project_info": "Bhoomi Rakshak is an AI-assisted geospatial disaster-risk mitigation and proactive relocation planning platform. It was created for Smart India Hackathon 2026 (Problem Statement 26191) to help district and state authorities make data-driven evacuation and relocation decisions.",
    "architecture": "The architecture is a decoupled client-server model. Frontend uses React 19, Vite, Leaflet, and Three.js. Backend uses FastAPI, GeoPandas, and Shapely. The database is a zero-config local SQLite database (bhoomi_rakshak.db) for geospatial data persistence.",
    "priority_scoring": "Priority Score is calculated as: Hazard Intensity × (Population Exposure / 100) × Vulnerability Index. The Vulnerability Index considers factors like elderly population (>15%), disabilities, housing quality (Kutcha), and low income. Scores > 500 trigger 'Immediate' Red Zones.",
    "multi_hazard": "When multiple hazards overlap (e.g., flood + slope instability), the Multi-Hazard Fusion Engine calculates a Composite Risk. It takes the mean of active hazard scores and adds an 'Overlap Bonus' ((number of hazards - 1) × 12.5), capped at 100.",
    "evacuation_routing": "Evacuation routing uses Dijkstra's Algorithm with Dynamic Hazard Impedance. It avoids active hazard paths by applying penalties: 1.60x for Red Corridors, 1.25x for Yellow Corridors, and 1.0x (standard) for Green Safe Corridors.",
    "site_suitability": "Candidate relocation sites are evaluated using an 8-factor Suitability Index: Hazard Safety, Carrying Capacity, Road Accessibility, Water Availability, Healthcare, Education, Livelihood Continuity, and Habitation Proximity. Scores >80 are 'Highly Suitable'.",
    "economics": "Our Reverse Insurance & Economic Resilience Calculus quantifies the financial return of proactive planned relocation versus reactive post-disaster expenditure. It typically shows a 4.8x - 7.2x ROI by saving on NDRF deployment, ex-gratia, and emergency camps.",
    "climate_fund": "The Climate Fund Calculator operationalizes Indian disaster financing (XV-FC NDMF/SDRF). It calculates Multi-Scheme Convergence across PMAY-G (housing), JJM (water), PMGSY (roads), and MGNREGA (wages), applying correct Center:State fiscal ratios (e.g. 90:10 for Himalayan states).",
    "certificates": "Authorities can generate Official Legal Relocation Certificates dynamically. We use ReportLab to compile A4 Government-style PDFs embedding priority metrics, site data, and cryptographic SHA-256 tamper-evident verification hashes for administrative audit compliance.",
    "citizen_portal": "The Citizen Portal (/citizen) uses HTML5 Geolocation to find the nearest safe haven. It provides animated Dijkstra evacuation corridors, English/Hindi Web Speech API voice advisories, an SOS speed dial strip (112, 1078), a 72-hour Go-Bag checklist, and allows citizens to submit geo-tagged ground observations.",
    "disaster_history": "Disaster History records prior events for each zone, including severity and descriptions. It should be treated as supporting evidence for priority and composite-risk decisions, not as a replacement for current hazard data.",
    "data_source": "The current frontend records are synthetic planning data for demonstration purposes. In a production deployment, this would be replaced with verified hazard, census, event-history, and site-assessment datasets.",
    "goodbye": "Goodbye! Stay safe. Feel free to ask if you need more details about Bhoomi Rakshak.",
    "fallback": "I am specifically trained on the Bhoomi Rakshak prototype documentation. I can answer questions about our geospatial engine, evacuation routing, priority scoring, reverse insurance economics, or our tech stack. Could you rephrase your question?"
}

def train_model():
    print("Preparing data...")
    texts = [item["text"] for item in training_data]
    labels = [item["intent"] for item in training_data]
    
    print("Training TF-IDF Vectorizer...")
    vectorizer = TfidfVectorizer(ngram_range=(1, 2), max_features=1000)
    X = vectorizer.fit_transform(texts)
    
    print("Encoding labels...")
    label_encoder = LabelEncoder()
    y = label_encoder.fit_transform(labels)
    
    print("Training XGBoost Classifier...")
    model = xgb.XGBClassifier(
        objective='multi:softprob',
        num_class=len(set(labels)),
        eval_metric='mlogloss',
        use_label_encoder=False,
        random_state=42,
        max_depth=10,
        min_child_weight=0,
        n_estimators=100
    )
    model.fit(X.toarray(), y)
    
    print("Saving models...")
    with open('app/model_assets.pkl', 'wb') as f:
        pickle.dump({
            'vectorizer': vectorizer,
            'label_encoder': label_encoder,
            'responses': responses
        }, f)
        
    model.save_model('app/xgboost_chatbot.json')
    
    print("Training complete! XGBoost chatbot is fully trained on prototype data.")

if __name__ == "__main__":
    train_model()
