import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 50+ major districts & regions spanning North, South, East, West, Central, Northeast, and Coastal India
const DISTRICT_DATA = [
  // North India
  { district: "East Delhi, Delhi", state: "Delhi", region: "North", baseCoords: [28.668, 77.302], defaultHazard: "Yamuna riverine flood", icon: "flood", spread: 0.12 },
  { district: "North Delhi, Delhi", state: "Delhi", region: "North", baseCoords: [28.724, 77.202], defaultHazard: "Urban waterlogging / flood", icon: "flood", spread: 0.12 },
  { district: "South Delhi, Delhi", state: "Delhi", region: "North", baseCoords: [28.545, 77.252], defaultHazard: "Seismic risk / soil liquefaction", icon: "slide", spread: 0.12 },
  { district: "West Delhi, Delhi", state: "Delhi", region: "North", baseCoords: [28.668, 77.110], defaultHazard: "Air pollution / heat island", icon: "alert", spread: 0.12 },
  { district: "Central Delhi, Delhi", state: "Delhi", region: "North", baseCoords: [28.641, 77.222], defaultHazard: "Flash flood / heat stress", icon: "flood", spread: 0.10 },
  { district: "Shahdara, Delhi", state: "Delhi", region: "North", baseCoords: [28.672, 77.288], defaultHazard: "Industrial pollution / flood overlap", icon: "alert", spread: 0.10 },
  { district: "Kinnaur, Himachal Pradesh", state: "Himachal Pradesh", region: "North", baseCoords: [31.650, 78.475], defaultHazard: "Rockfall / debris flow", icon: "slide", spread: 0.35 },
  { district: "Kullu, Himachal Pradesh", state: "Himachal Pradesh", region: "North", baseCoords: [31.958, 77.109], defaultHazard: "Flash flood & cloudburst", icon: "flood", spread: 0.35 },
  { district: "Shimla, Himachal Pradesh", state: "Himachal Pradesh", region: "North", baseCoords: [31.104, 77.173], defaultHazard: "Slope subsidence & landslides", icon: "slide", spread: 0.30 },
  { district: "Chamoli, Uttarakhand", state: "Uttarakhand", region: "North", baseCoords: [30.418, 79.336], defaultHazard: "Glacial lake outburst & debris flow", icon: "slide", spread: 0.40 },
  { district: "Rudraprayag, Uttarakhand", state: "Uttarakhand", region: "North", baseCoords: [30.285, 78.981], defaultHazard: "Landslides & river bank breach", icon: "slide", spread: 0.30 },
  { district: "Uttarkashi, Uttarakhand", state: "Uttarakhand", region: "North", baseCoords: [30.726, 78.435], defaultHazard: "Steep slope creep & avalanches", icon: "slide", spread: 0.35 },
  { district: "Anantnag, Jammu & Kashmir", state: "Jammu & Kashmir", region: "North", baseCoords: [33.731, 75.155], defaultHazard: "Jhelum river flood & soil liquefaction", icon: "flood", spread: 0.30 },
  { district: "Srinagar, Jammu & Kashmir", state: "Jammu & Kashmir", region: "North", baseCoords: [34.083, 74.797], defaultHazard: "Urban basin flood & river inundation", icon: "flood", spread: 0.20 },
  { district: "Leh, Ladakh", state: "Ladakh", region: "North", baseCoords: [34.152, 77.577], defaultHazard: "Flash flood & permafrost thaw", icon: "flood", spread: 0.45 },
  { district: "Amritsar, Punjab", state: "Punjab", region: "North", baseCoords: [31.634, 74.872], defaultHazard: "Ravi river overflow & water table drop", icon: "flood", spread: 0.25 },
  { district: "Gurugram, Haryana", state: "Haryana", region: "North", baseCoords: [28.459, 77.026], defaultHazard: "Urban runoff waterlogging", icon: "flood", spread: 0.20 },
  { district: "Varanasi, Uttar Pradesh", state: "Uttar Pradesh", region: "North", baseCoords: [25.317, 82.973], defaultHazard: "Ganga floodplain inundation", icon: "flood", spread: 0.25 },
  { district: "Gorakhpur, Uttar Pradesh", state: "Uttar Pradesh", region: "North", baseCoords: [26.760, 83.373], defaultHazard: "Rapti river seasonal flood", icon: "flood", spread: 0.30 },
  { district: "Prayagraj, Uttar Pradesh", state: "Uttar Pradesh", region: "North", baseCoords: [25.435, 81.846], defaultHazard: "Sangam riverbank erosion", icon: "flood", spread: 0.25 },

  // West India & Desert
  { district: "Barmer, Rajasthan", state: "Rajasthan", region: "West", baseCoords: [25.752, 71.396], defaultHazard: "Water scarcity & extreme heatwave", icon: "alert", spread: 0.50 },
  { district: "Jodhpur, Rajasthan", state: "Rajasthan", region: "West", baseCoords: [26.238, 73.024], defaultHazard: "Flash drought & groundwater depletion", icon: "alert", spread: 0.40 },
  { district: "Jaisalmer, Rajasthan", state: "Rajasthan", region: "West", baseCoords: [26.915, 70.908], defaultHazard: "Sand encroachment & thermal surge", icon: "alert", spread: 0.60 },
  { district: "Kutch, Gujarat", state: "Gujarat", region: "West", baseCoords: [23.733, 69.859], defaultHazard: "Seismic active fault & storm surge", icon: "slide", spread: 0.55 },
  { district: "Surat, Gujarat", state: "Gujarat", region: "West", baseCoords: [21.170, 72.831], defaultHazard: "Tapi river discharge & coastal flooding", icon: "flood", spread: 0.25 },
  { district: "Ahmedabad, Gujarat", state: "Gujarat", region: "West", baseCoords: [23.022, 72.571], defaultHazard: "Sabarmati basin waterlogging", icon: "flood", spread: 0.25 },
  { district: "Mumbai Suburban, Maharashtra", state: "Maharashtra", region: "West", baseCoords: [19.076, 72.877], defaultHazard: "Mithi river flood & coastal surge", icon: "flood", spread: 0.20 },
  { district: "Raigad, Maharashtra", state: "Maharashtra", region: "West", baseCoords: [18.515, 73.181], defaultHazard: "Western Ghats debris flow", icon: "slide", spread: 0.35 },
  { district: "Pune, Maharashtra", state: "Maharashtra", region: "West", baseCoords: [18.520, 73.856], defaultHazard: "Mutha river breach & urban flooding", icon: "flood", spread: 0.30 },
  { district: "Ratnagiri, Maharashtra", state: "Maharashtra", region: "West", baseCoords: [16.990, 73.312], defaultHazard: "Coastal erosion & monsoon landslides", icon: "slide", spread: 0.35 },
  { district: "North Goa, Goa", state: "Goa", region: "West", baseCoords: [15.498, 73.827], defaultHazard: "Estuary inundation & beach erosion", icon: "flood", spread: 0.25 },

  // South India
  { district: "Wayanad, Kerala", state: "Kerala", region: "South", baseCoords: [11.685, 76.132], defaultHazard: "Slope instability / landslide", icon: "slide", spread: 0.30 },
  { district: "Idukki, Kerala", state: "Kerala", region: "South", baseCoords: [9.850, 76.970], defaultHazard: "High-range flash landslide & reservoir surge", icon: "slide", spread: 0.35 },
  { district: "Alappuzha, Kerala", state: "Kerala", region: "South", baseCoords: [9.498, 76.338], defaultHazard: "Kuttanad below-sea-level flood", icon: "flood", spread: 0.25 },
  { district: "Chennai, Tamil Nadu", state: "Tamil Nadu", region: "South", baseCoords: [13.082, 80.270], defaultHazard: "Adyar/Cooum cyclone surge & urban flood", icon: "flood", spread: 0.22 },
  { district: "Cuddalore, Tamil Nadu", state: "Tamil Nadu", region: "South", baseCoords: [11.748, 79.771], defaultHazard: "Bay of Bengal cyclone inundation", icon: "flood", spread: 0.30 },
  { district: "Nilgiris, Tamil Nadu", state: "Tamil Nadu", region: "South", baseCoords: [11.491, 76.733], defaultHazard: "Mountain slope failure & mudslides", icon: "slide", spread: 0.30 },
  { district: "Bengaluru Urban, Karnataka", state: "Karnataka", region: "South", baseCoords: [12.971, 77.594], defaultHazard: "Lake encroachment urban flash flood", icon: "flood", spread: 0.25 },
  { district: "Kodagu, Karnataka", state: "Karnataka", region: "South", baseCoords: [12.424, 75.738], defaultHazard: "Brahmagiri slope slip & heavy monsoon rain", icon: "slide", spread: 0.30 },
  { district: "Uttara Kannada, Karnataka", state: "Karnataka", region: "South", baseCoords: [14.795, 74.686], defaultHazard: "Kali river basin flood & coastal erosion", icon: "flood", spread: 0.35 },
  { district: "Hyderabad, Telangana", state: "Telangana", region: "South", baseCoords: [17.385, 78.486], defaultHazard: "Musi river overflow & urban inundation", icon: "flood", spread: 0.25 },
  { district: "Visakhapatnam, Andhra Pradesh", state: "Andhra Pradesh", region: "South", baseCoords: [17.686, 83.218], defaultHazard: "Severe cyclonic storm surge", icon: "flood", spread: 0.30 },
  { district: "East Godavari, Andhra Pradesh", state: "Andhra Pradesh", region: "South", baseCoords: [16.989, 81.783], defaultHazard: "Godavari delta estuarine flooding", icon: "flood", spread: 0.35 },

  // East & Central India
  { district: "Kandhamal, Odisha", state: "Odisha", region: "East", baseCoords: [20.400, 84.100], defaultHazard: "Flash flood & torrential runoff", icon: "flood", spread: 0.40 },
  { district: "Puri, Odisha", state: "Odisha", region: "East", baseCoords: [19.813, 85.831], defaultHazard: "Super-cyclone storm surge & coastal retreat", icon: "flood", spread: 0.30 },
  { district: "Kendrapara, Odisha", state: "Odisha", region: "East", baseCoords: [20.500, 86.420], defaultHazard: "Mahanadi sea ingress & delta flood", icon: "flood", spread: 0.35 },
  { district: "Darjeeling, West Bengal", state: "West Bengal", region: "East", baseCoords: [27.041, 88.266], defaultHazard: "Landslide / road cut collapse", icon: "slide", spread: 0.30 },
  { district: "South 24 Parganas, West Bengal", state: "West Bengal", region: "East", baseCoords: [22.135, 88.545], defaultHazard: "Sundarbans embankment breach & tidal surge", icon: "flood", spread: 0.40 },
  { district: "Kolkata, West Bengal", state: "West Bengal", region: "East", baseCoords: [22.572, 88.363], defaultHazard: "Hooghly river tidal waterlogging", icon: "flood", spread: 0.18 },
  { district: "Patna, Bihar", state: "Bihar", region: "East", baseCoords: [25.594, 85.137], defaultHazard: "Ganga-Punpun confluence flooding", icon: "flood", spread: 0.25 },
  { district: "Katihar, Bihar", state: "Bihar", region: "East", baseCoords: [25.543, 87.572], defaultHazard: "Kosi river course shift & flood", icon: "flood", spread: 0.35 },
  { district: "Ranchi, Jharkhand", state: "Jharkhand", region: "East", baseCoords: [23.344, 85.309], defaultHazard: "Mining subsidence & ground collapse", icon: "slide", spread: 0.30 },
  { district: "Bhopal, Madhya Pradesh", state: "Madhya Pradesh", region: "Central", baseCoords: [23.259, 77.412], defaultHazard: "Upper Lake drainage waterlogging", icon: "flood", spread: 0.25 },
  { district: "Jabalpur, Madhya Pradesh", state: "Madhya Pradesh", region: "Central", baseCoords: [23.181, 79.986], defaultHazard: "Narmada gorge surge & flash runoff", icon: "flood", spread: 0.30 },
  { district: "Bastar, Chhattisgarh", state: "Chhattisgarh", region: "Central", baseCoords: [19.074, 82.030], defaultHazard: "Indravati river flash flood & soil erosion", icon: "flood", spread: 0.45 },

  // Northeast India
  { district: "Majuli, Assam", state: "Assam", region: "Northeast", baseCoords: [27.000, 94.200], defaultHazard: "River erosion & flood", icon: "flood", spread: 0.30 },
  { district: "Guwahati, Assam", state: "Assam", region: "Northeast", baseCoords: [26.144, 91.736], defaultHazard: "Brahmaputra bank inundation & hill slide", icon: "flood", spread: 0.22 },
  { district: "Dima Hasao, Assam", state: "Assam", region: "Northeast", baseCoords: [25.180, 93.020], defaultHazard: "Hill track slope failure & mudflow", icon: "slide", spread: 0.35 },
  { district: "East Khasi Hills, Meghalaya", state: "Meghalaya", region: "Northeast", baseCoords: [25.578, 91.893], defaultHazard: "Ultra-heavy rainfall & gorge landslide", icon: "slide", spread: 0.30 },
  { district: "Papum Pare, Arunachal Pradesh", state: "Arunachal Pradesh", region: "Northeast", baseCoords: [27.100, 93.600], defaultHazard: "Trans-Himalayan landslide & seismic fault", icon: "slide", spread: 0.40 },
  { district: "Aizawl, Mizoram", state: "Mizoram", region: "Northeast", baseCoords: [23.727, 92.717], defaultHazard: "Steep shale slope failure & subsidence", icon: "slide", spread: 0.30 },
  { district: "Kohima, Nagaland", state: "Nagaland", region: "Northeast", baseCoords: [25.675, 94.108], defaultHazard: "Ridge-line sinking & monsoon slips", icon: "slide", spread: 0.30 },
  { district: "Gangtok, Sikkim", state: "Sikkim", region: "Northeast", baseCoords: [27.338, 88.606], defaultHazard: "Teesta basin flash flood & rock avalanche", icon: "slide", spread: 0.35 },
  { district: "Imphal West, Manipur", state: "Manipur", region: "Northeast", baseCoords: [24.817, 93.936], defaultHazard: "Imphal river valley inundation", icon: "flood", spread: 0.25 },
  { district: "West Tripura, Tripura", state: "Tripura", region: "Northeast", baseCoords: [23.831, 91.286], defaultHazard: "Howrah river flood & siltation", icon: "flood", spread: 0.25 },

  // Islands & Extreme Coastal
  { district: "South Andaman, Andaman & Nicobar", state: "Andaman & Nicobar", region: "Islands", baseCoords: [11.623, 92.726], defaultHazard: "Tsunami exposure & coastal cliff erosion", icon: "flood", spread: 0.40 },
  { district: "Kavaratti, Lakshadweep", state: "Lakshadweep", region: "Islands", baseCoords: [10.566, 72.641], defaultHazard: "Atoll sea-level rise & coral surge", icon: "flood", spread: 0.30 },
];

const LOCALITY_PREFIXES = [
  "Sector", "Ward", "Hamlet", "Basti", "Nagar", "Colony", "Palli", "Puram",
  "Ghat", "Vihar", "Pur", "Gram", "Tola", "Khadar", "Ridge", "Patti", "Enclave"
];

const LOCALITY_NAMES = [
  "Shanti", "Vikas", "Adarsh", "Amrit", "Suraksha", "Prabhat", "Ganga", "Yamuna",
  "Narmada", "Kaveri", "Godavari", "Brahmaputra", "Indus", "Saraswati", "Mahanadi",
  "Shiv", "Krishna", "Neelkanth", "Kailash", "Himalaya", "Vindhya", "Sahyadri",
  "Greenfield", "Sunrise", "Riverbed", "Lakeside", "Hillview", "Valley", "Seacoast",
  "Delta", "Uday", "Pawan", "Surya", "Chandani", "Navodaya", "Janata", "Ashok"
];

const HAZARD_TYPES = [
  { hazard: "Riverine flood & bank erosion", icon: "flood" },
  { hazard: "Slope instability / landslide", icon: "slide" },
  { hazard: "Flash flood & cloudburst", icon: "flood" },
  { hazard: "Water scarcity & heat stress", icon: "alert" },
  { hazard: "Seismic risk / soil liquefaction", icon: "slide" },
  { hazard: "Coastal surge & tidal ingress", icon: "flood" },
  { hazard: "Mining subsidence / ground sink", icon: "slide" },
  { hazard: "Urban stormwater waterlogging", icon: "flood" },
  { hazard: "Industrial runoff & flood overlap", icon: "alert" },
];

const RELOCATION_NAMES = [
  "Rehabilitation Enclave", "Safe Resettlement Colony", "Transit Housing Block",
  "Disaster Relief Town", "Elevated Model Township", "Integrated Secure Ward",
  "Samarpan Vikas Colony", "Abhay Community Layout", "Green Safe Haven", "Pragati Resettlement Sector"
];

// Generate 2,500+ zones evenly distributed across all districts
const TOTAL_TARGET = 2500;
const ZONES = [];

const perDistrict = Math.ceil(TOTAL_TARGET / DISTRICT_DATA.length);

DISTRICT_DATA.forEach((dist, dIdx) => {
  const stateCode = dist.state.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase();
  const distCode = dist.district.split(',')[0].replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase();

  for (let i = 0; i < perDistrict; i++) {
    if (ZONES.length >= 2500) break;

    const id = `${stateCode}-${distCode}-${String(i + 1).padStart(2, '0')}`;
    const name = `${LOCALITY_NAMES[(dIdx * 7 + i * 3) % LOCALITY_NAMES.length]} ${LOCALITY_PREFIXES[(dIdx + i) % LOCALITY_PREFIXES.length]} ${i + 1}`;

    // Determine hazard & severity
    const isCustomHazard = (i % 4 === 0);
    const hazardObj = isCustomHazard ? HAZARD_TYPES[(dIdx + i) % HAZARD_TYPES.length] : { hazard: dist.defaultHazard, icon: dist.icon };

    // Coordinates with natural geographic scatter around district center
    const angle = (i / perDistrict) * 2 * Math.PI + (dIdx * 0.5);
    const distance = (0.05 + (i % 7) * 0.04) * (dist.spread || 0.3);
    const lat = Number((dist.baseCoords[0] + Math.sin(angle) * distance).toFixed(4));
    const lng = Number((dist.baseCoords[1] + Math.cos(angle) * distance).toFixed(4));

    // Realistic scores
    const hazardIntensity = Math.floor(45 + Math.random() * 54); // 45 - 98
    const exposure = Math.floor(40 + Math.random() * 55); // 40 - 94
    const vulnerability = Math.floor(42 + Math.random() * 53); // 42 - 94

    // Priority score 0 - 100
    const priorityScore = Math.min(98, Math.max(12, Math.round((hazardIntensity * 0.45 + exposure * 0.25 + vulnerability * 0.3) * (0.65 + Math.random() * 0.35))));

    // Phase assignment
    const phase = priorityScore >= 60 ? "Immediate" : priorityScore >= 35 ? "Short-Term" : "Medium-Term";

    // Socio-demographics
    const population = Math.floor(500 + Math.random() * 28000);
    const elderly = Math.floor(8 + Math.random() * 16);
    const disabled = Math.floor(3 + Math.random() * 9);
    const lowIncome = Math.floor(35 + Math.random() * 55);
    const isolated = (priorityScore > 55 && Math.random() > 0.45) || (dist.region === "Northeast" || dist.region === "Islands");
    const incidentHistory = priorityScore > 48 ? (Math.random() > 0.35) : false;

    // Dates
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"];
    const day = String(Math.floor(1 + Math.random() * 28)).padStart(2, '0');
    const month = months[Math.floor(Math.random() * months.length)];
    const lastSurveyed = `${day} ${month} 2026`;

    // Relocation site status
    const siteStatusRoll = Math.random();
    let siteStatus = "matched";
    let utilization = Math.floor(52 + Math.random() * 40);
    if (priorityScore > 75 && siteStatusRoll > 0.6) {
      siteStatus = "shortfall";
      utilization = Math.floor(102 + Math.random() * 25);
    } else if (priorityScore < 30 && siteStatusRoll > 0.5) {
      siteStatus = "pending";
      utilization = null;
    }

    const siteName = siteStatus === "pending" ? null : `${dist.district.split(',')[0]} ${RELOCATION_NAMES[(dIdx * 3 + i) % RELOCATION_NAMES.length]}`;

    // 2D Canvas x, y coords (0 - 100 scale based on India geographic bbox: lat 8 to 36, lng 68 to 97)
    const canvasX = Math.min(95, Math.max(5, Number((((lng - 68.0) / (97.5 - 68.0)) * 90 + 5).toFixed(1))));
    const canvasY = Math.min(95, Math.max(5, Number(((1 - (lat - 8.0) / (36.5 - 8.0)) * 90 + 5).toFixed(1))));

    const explanation = `Ranked ${phase}: ${hazardObj.hazard} vulnerability index (${hazardIntensity}%), ${population.toLocaleString('en-IN')} exposed residents with ${elderly}% elderly & ${disabled}% disabled dependency. Surveyed ${lastSurveyed}.`;

    ZONES.push({
      id,
      name,
      district: dist.district,
      state: dist.state,
      region: dist.region,
      hazard: hazardObj.hazard,
      icon: hazardObj.icon,
      hazardIntensity,
      exposure,
      vulnerability,
      priorityScore,
      phase,
      population,
      elderly,
      disabled,
      lowIncome,
      isolated,
      incidentHistory,
      lastSurveyed,
      lat,
      lng,
      x: canvasX,
      y: canvasY,
      site: {
        status: siteStatus,
        name: siteName,
        utilization
      },
      explanation
    });
  }
});

// Output DISTRICT_COORDS map
const DISTRICT_COORDS = {};
DISTRICT_DATA.forEach(d => {
  DISTRICT_COORDS[d.district] = d.baseCoords;
});

const outputContent = `/* ======================================================================
   BHOOMI RAKSHAK NATIONAL GEO-HAZARD DATABASE (1,000+ PAN-INDIA PLACES)
   Covers North, South, East, West, Central, Northeast, Coastal & Island zones
   ====================================================================== */

export const DISTRICT_COORDS = ${JSON.stringify(DISTRICT_COORDS, null, 2)};

export const ZONES = ${JSON.stringify(ZONES, null, 2)};
`;

const outputPath = path.join(__dirname, 'src', 'data', 'zonesData.js');
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, outputContent, 'utf-8');

console.log(`Successfully generated ${ZONES.length} zones across ${Object.keys(DISTRICT_COORDS).length} districts.`);
