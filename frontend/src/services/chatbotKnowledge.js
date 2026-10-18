/**
 * Intelligent Client-Side Knowledge Base for Bhoomi Rakshak
 * Trained on all Smart India Hackathon 2026 Problem Statement 26191 prototype specifications.
 * Ensures the chatbot remains 100% responsive and smart even if the backend is waking up or offline.
 */

export const BHOOMI_KNOWLEDGE = {
  greeting: {
    keywords: ["hello", "hi", "hey", "good morning", "good evening", "good afternoon", "namaste", "howdy", "hola", "greetings", "wassup"],
    reply: "Hello! I am the Bhoomi Rakshak AI assistant. How can I help you today with disaster mitigation, relocation planning, or platform features?"
  },
  project_info: {
    keywords: ["bhoomi rakshak", "project", "hackathon", "sih", "overview", "purpose", "about", "what is this", "what does this app do", "problem statement", "who is this for", "goal", "summary", "use case", "mission", "objective", "26191"],
    reply: "Bhoomi Rakshak is an AI-assisted geospatial disaster-risk mitigation and proactive relocation planning platform. It was created for Smart India Hackathon 2026 (Problem Statement 26191) to help district and state authorities make data-driven evacuation and relocation decisions before disaster strikes."
  },
  architecture: {
    keywords: ["tech stack", "architecture", "react", "fastapi", "sqlite", "vite", "leaflet", "three.js", "backend", "frontend", "framework", "database", "technology", "libraries", "tools", "stack", "system design"],
    reply: "The architecture is a decoupled client-server model:\n• Frontend: React 19, Vite, Leaflet, and Three.js (for 3D Earth and geospatial layers)\n• Backend: FastAPI (Python), GeoPandas, and Shapely\n• Database: Zero-config local SQLite database (bhoomi_rakshak.db)\n• ML Engine: TF-IDF vectorizer + XGBoost classifier for intent resolution."
  },
  priority_scoring: {
    keywords: ["priority", "score", "scoring", "vulnerability", "red zone", "yellow zone", "green zone", "hazard intensity", "exposure", "phasing", "threshold", "formula", "index", "how is priority decided", "calculation"],
    reply: "Priority Score is calculated using:\nPriority = Hazard Intensity × (Population Exposure / 100) × Vulnerability Index\n\nThe Vulnerability Index weights factors including elderly demographics (>15%), disabilities, kutcha housing quality, and low economic resilience. Scores > 500 trigger 'Immediate' Red Zones (Phase 1 relocation)."
  },
  multi_hazard: {
    keywords: ["multi-hazard", "multi hazard", "overlap", "composite risk", "fusion", "multiple hazards", "compound", "flood and earthquake", "combined hazard", "overlapping risk", "compound disaster"],
    reply: "When multiple hazards overlap (e.g., flash flood + slope landslide), the Multi-Hazard Fusion Engine calculates a Composite Risk:\nComposite = Mean(Active Hazards) + Overlap Bonus\nWhere Overlap Bonus = (Number of Hazards - 1) × 12.5 (capped at 100). This captures cascading vulnerability multiplier effects."
  },
  evacuation_routing: {
    keywords: ["evacuation", "routing", "dijkstra", "impedance", "corridor", "path", "route", "evacuate", "shortest path", "safe corridor", "avoid active", "safe route"],
    reply: "Evacuation routing uses Dijkstra's Algorithm with Dynamic Hazard Impedance. Paths are weighted by disaster exposure: 1.60x impedance multiplier for Red Corridors, 1.25x for Yellow Corridors, and 1.0x (standard) for Green Safe Corridors, ensuring citizens avoid active hazard zones."
  },
  site_suitability: {
    keywords: ["relocation site", "suitability", "carrying capacity", "site selection", "suitable", "candidate site", "safe haven", "resettlement", "candidate"],
    reply: "Candidate relocation sites are evaluated using an 8-Factor Suitability Index:\n1. Hazard Safety Zone (>2km from active risks)\n2. Carrying Capacity & Topography\n3. Road Accessibility & Connectivity\n4. Water Table Availability\n5. Primary Healthcare Proximity\n6. Educational Infrastructure\n7. Livelihood Continuity\n8. Habitation Proximity (<15km preferred).\nScores > 80 are rated 'Highly Suitable'."
  },
  economics: {
    keywords: ["reverse insurance", "economic", "roi", "proactive", "reactive", "cost", "financial", "delay cost", "resilience calculus", "saving", "finance"],
    reply: "Our Reverse Insurance & Economic Resilience Calculus quantifies the financial return of proactive planned relocation versus reactive disaster response. Proactive relocation delivers a 4.8x to 7.2x ROI by eliminating recurring emergency NDRF deployments, ex-gratia compensation, and temporary tent cities."
  },
  climate_fund: {
    keywords: ["climate fund", "pmay", "jjm", "pmgsy", "mgnrega", "ndmf", "sdrf", "grant", "fund calculator", "financing", "convergence", "fiscal", "xv-fc"],
    reply: "The Climate Fund Calculator operationalizes Indian disaster financing (XV-FC NDMF/SDRF). It calculates Multi-Scheme Convergence across PMAY-G (housing), JJM (water), PMGSY (roads), and MGNREGA (wages), applying correct Center:State fiscal ratios (e.g., 90:10 for Himalayan states)."
  },
  certificates: {
    keywords: ["certificate", "pdf", "sha-256", "reportlab", "tamper", "legal", "document", "audit", "verification", "download certificate"],
    reply: "Authorities can generate Official Legal Relocation Certificates dynamically. We use ReportLab to compile A4 Government-style PDFs embedding priority metrics, site data, and cryptographic SHA-256 tamper-evident verification hashes for administrative audit compliance."
  },
  citizen_portal: {
    keywords: ["citizen", "sos", "go-bag", "go bag", "voice advisory", "geolocation", "safe haven", "emergency", "speed dial", "112", "1078", "checklist"],
    reply: "The Citizen Portal (/citizen) uses HTML5 Geolocation to find the nearest safe haven. It provides animated Dijkstra evacuation corridors, English/Hindi Web Speech API voice advisories, an SOS speed dial strip (112, 1078), a 72-hour Go-Bag checklist, and allows citizens to submit geo-tagged ground observations."
  },
  disaster_history: {
    keywords: ["disaster history", "previous events", "past disaster", "historical", "event history", "past flood", "earthquake history", "prior events"],
    reply: "Disaster History records prior events for each zone, including severity and descriptions. It should be treated as supporting evidence for priority and composite-risk decisions, not as a replacement for current hazard data."
  },
  data_source: {
    keywords: ["data source", "real data", "synthetic", "fake data", "demo data", "where does the data come from", "records real", "sample data", "actual data"],
    reply: "The current frontend records are synthetic planning data for demonstration purposes. In a production deployment, this would be replaced with verified hazard, census, event-history, and site-assessment datasets from NDMA, IMD, and Geological Survey of India."
  },
  goodbye: {
    keywords: ["bye", "goodbye", "see you", "take care", "thanks bye", "thank you bye", "ok bye", "exit", "quit"],
    reply: "Goodbye! Stay safe. Feel free to ask if you need more details about Bhoomi Rakshak."
  },
  help: {
    keywords: ["help", "contact", "support", "features", "what can you do", "how to use", "options", "menu"],
    reply: "I can answer questions regarding:\n• Priority Scoring Formula & Thresholds\n• Dynamic Evacuation Routing (Dijkstra)\n• Multi-Hazard Fusion Engine\n• Reverse Insurance & Economic ROI\n• Climate Fund Convergence (PMAY/JJM/NDMF)\n• Legal Relocation Certificates\n• Citizen Portal & 72h Go-Bag Checklist\n\nWhat would you like to explore?"
  }
};

/**
 * Resolve user query against Bhoomi Rakshak knowledge base
 */
export const getOfflineKnowledgeResponse = (userText) => {
  const query = (userText || '').toLowerCase().trim();
  if (!query) {
    return "Please ask a question about Bhoomi Rakshak.";
  }

  let bestIntent = null;
  let maxScore = 0;

  for (const [intentKey, data] of Object.entries(BHOOMI_KNOWLEDGE)) {
    let score = 0;
    for (const kw of data.keywords) {
      if (query.includes(kw)) {
        // Longer phrase matches get higher weight
        score += kw.split(' ').length * 2;
      }
    }
    if (score > maxScore) {
      maxScore = score;
      bestIntent = intentKey;
    }
  }

  if (bestIntent && maxScore > 0) {
    return BHOOMI_KNOWLEDGE[bestIntent].reply;
  }

  return "I am trained on the Bhoomi Rakshak platform documentation. I can answer questions about our geospatial analytics engine, Dijkstra evacuation routing, priority scoring formula, reverse insurance economics, multi-hazard fusion, or system architecture. Feel free to click one of the suggested prompts or ask about any feature!";
};
