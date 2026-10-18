import React, { useState, useMemo } from "react";
import {
  Scale, AlertTriangle, ShieldCheck, TrendingDown, Clock,
  ArrowRight, Download, CheckCircle2, DollarSign, Building,
  HeartHandshake, Flame, RefreshCw, Info, HelpCircle
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from "recharts";

export default function ReverseInsurance({ zones = [], initialZoneId = null }) {
  const [selectedId, setSelectedId] = useState(initialZoneId || (zones[0]?.id || ""));
  const [delayMonths, setDelayMonths] = useState(12);
  const [disasterSeverity, setDisasterSeverity] = useState("severe"); // moderate, severe, catastrophic

  const selectedZone = useMemo(() => {
    return zones.find((z) => z.id === selectedId) || zones[0] || {
      id: "RZ-DEMO",
      name: "High-Risk Habitation",
      district: "Chamoli",
      population: 480,
      priorityScore: 88,
      hazard: "Landslide / Slope Movement"
    };
  }, [zones, selectedId]);

  // Calculations based on population and risk
  const population = selectedZone.population || 450;
  const households = Math.ceil(population / 4.2);

  // Proactive Costs (in Crores INR)
  const proactiveCosts = useMemo(() => {
    const landDev = Number(((households * 0.75) / 100).toFixed(2)); // ₹75k per hh site prep & land
    const housing = Number(((households * 2.5) / 100).toFixed(2));   // ₹2.5L per hh resilient housing (PMAY-G convergence)
    const infrastructure = Number(((households * 1.0) / 100).toFixed(2)); // ₹1L per hh utilities & road
    const livelihoodTransit = Number(((households * 0.5) / 100).toFixed(2)); // ₹50k per hh transit & seed grant
    const total = Number((landDev + housing + infrastructure + livelihoodTransit).toFixed(2));
    return {
      landDev,
      housing,
      infrastructure,
      livelihoodTransit,
      total: Math.max(1.8, total)
    };
  }, [households]);

  // Post Disaster Costs (in Crores INR)
  const postDisasterCosts = useMemo(() => {
    const severityMultiplier = disasterSeverity === "moderate" ? 0.7 : disasterSeverity === "severe" ? 1.0 : 1.45;
    
    // Emergency search & rescue + NDRF airlifts
    const rescueNDRF = Number((1.85 * severityMultiplier).toFixed(2));
    // Temporary relief camps, food rations & healthcare (6-12 months)
    const reliefCamps = Number((2.40 * severityMultiplier).toFixed(2));
    // Ex-gratia loss of life, injury & livestock compensation
    const exGratia = Number((3.10 * severityMultiplier).toFixed(2));
    // Emergency rebuilding of shattered homes & roads at emergency rates
    const reconstruction = Number((7.80 * severityMultiplier).toFixed(2));
    // Economic productivity, farm loss & business interruption
    const economicLoss = Number((3.20 * severityMultiplier).toFixed(2));

    // Additional compounding cost due to delay (delayed mitigation worsens slope degradation & increases exposure)
    const monthlyDelayFactor = 0.14; // ₹14 Lakhs per month of delay in vulnerability compounding
    const delayPenalty = Number(((delayMonths * monthlyDelayFactor) * severityMultiplier).toFixed(2));

    const total = Number((rescueNDRF + reliefCamps + exGratia + reconstruction + economicLoss + delayPenalty).toFixed(2));

    return {
      rescueNDRF,
      reliefCamps,
      exGratia,
      reconstruction,
      economicLoss,
      delayPenalty,
      total: Math.max(12.5, total)
    };
  }, [disasterSeverity, delayMonths]);

  // Benefit Cost Ratio & Savings
  const savings = Number((postDisasterCosts.total - proactiveCosts.total).toFixed(2));
  const bcr = Number((postDisasterCosts.total / proactiveCosts.total).toFixed(1));

  // Visual tilt calculation for scale (max +/- 18 deg)
  const scaleTilt = Math.min(18, Math.max(8, (postDisasterCosts.total / proactiveCosts.total) * 2));

  const chartData = [
    { name: "Proactive Resettlement", cost: proactiveCosts.total, type: "proactive" },
    { name: "Post-Disaster (Act Today)", cost: Number((postDisasterCosts.total - postDisasterCosts.delayPenalty).toFixed(2)), type: "post" },
    { name: `Post-Disaster (+${delayMonths}m Delay)`, cost: postDisasterCosts.total, type: "delay" },
  ];

  return (
    <div className="reverse-insurance-container" style={{ animation: "rise-in 0.4s ease both" }}>
      {/* Header Banner */}
      <div style={{
        background: "linear-gradient(135deg, #143b5d 0%, #1c527e 60%, #1e7890 100%)",
        borderRadius: "14px",
        padding: "24px 28px",
        color: "#ffffff",
        marginBottom: "20px",
        boxShadow: "0 10px 30px rgba(20, 59, 93, 0.2)",
        position: "relative",
        overflow: "hidden"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px", position: "relative", zIndex: 1 }}>
          <div style={{ maxWidth: "680px" }}>
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              background: "rgba(255,255,255,0.15)",
              backdropFilter: "blur(8px)",
              padding: "4px 10px",
              borderRadius: "20px",
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              marginBottom: "10px",
              border: "1px solid rgba(255,255,255,0.2)"
            }}>
              <Scale size={13} /> Feature 1 · Reverse Insurance (Cost of Delay)
            </div>
            <h2 style={{ margin: "0 0 8px", fontSize: "24px", fontFamily: "Space Grotesk, sans-serif", fontWeight: 700 }}>
              Compare proactive resettlement cost vs projected post disaster cost
            </h2>
            <p style={{ margin: 0, opacity: 0.9, fontSize: "13px", lineHeight: "1.5" }}>
              Every ₹1 spent on planned, dignifying proactive resettlement saves up to <strong>₹9 in avoided disaster response</strong>, emergency reconstruction, and human catastrophe. Act today, save tomorrow.
            </p>
          </div>

          <div style={{
            background: "rgba(255, 255, 255, 0.12)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255, 255, 255, 0.25)",
            borderRadius: "12px",
            padding: "12px 18px",
            textAlign: "right"
          }}>
            <div style={{ fontSize: "11px", opacity: 0.85, textTransform: "uppercase", letterSpacing: "0.5px" }}>Benefit-Cost Ratio (BCR)</div>
            <div style={{ fontSize: "32px", fontWeight: 800, fontFamily: "Space Grotesk, sans-serif", color: "#6fe3b4" }}>{bcr}x ROI</div>
            <div style={{ fontSize: "11.5px", color: "#e0f2fe" }}>₹{savings} Cr Net Public Savings</div>
          </div>
        </div>

        {/* Ambient glow decoration */}
        <div style={{
          position: "absolute",
          top: "-50%",
          right: "-10%",
          width: "350px",
          height: "350px",
          background: "radial-gradient(circle, rgba(111,227,180,0.2) 0%, rgba(20,59,93,0) 70%)",
          pointerEvents: "none"
        }} />
      </div>

      {/* Control Bar: Zone Selector & Delay Simulator */}
      <div style={{
        background: "var(--panel)",
        border: "1px solid var(--line)",
        borderRadius: "12px",
        padding: "16px 20px",
        marginBottom: "20px",
        display: "flex",
        flexWrap: "wrap",
        gap: "18px",
        alignItems: "center",
        justifyContent: "space-between",
        boxShadow: "0 2px 10px rgba(0,0,0,0.03)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--ink-soft)", textTransform: "uppercase", marginBottom: "4px" }}>
              Target Red Zone
            </label>
            <select
              value={selectedZone.id}
              onChange={(e) => setSelectedId(e.target.value)}
              style={{
                padding: "8px 12px",
                border: "1px solid var(--line)",
                borderRadius: "8px",
                fontSize: "13px",
                fontFamily: "Inter, sans-serif",
                background: "var(--panel-2)",
                color: "var(--ink)",
                fontWeight: 500,
                minWidth: "220px"
              }}
            >
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.id} — {z.name} ({z.district}, Pop: {z.population})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--ink-soft)", textTransform: "uppercase", marginBottom: "4px" }}>
              Scenario Severity
            </label>
            <div style={{ display: "flex", background: "var(--panel-2)", padding: "3px", borderRadius: "8px", border: "1px solid var(--line)" }}>
              {["moderate", "severe", "catastrophic"].map((sev) => (
                <button
                  key={sev}
                  onClick={() => setDisasterSeverity(sev)}
                  style={{
                    border: "none",
                    background: disasterSeverity === sev ? "var(--brand)" : "transparent",
                    color: disasterSeverity === sev ? "#fff" : "var(--ink-soft)",
                    padding: "6px 12px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: 600,
                    textTransform: "capitalize",
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                >
                  {sev}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Delay Slider */}
        <div style={{ minWidth: "260px", flex: 1, maxWidth: "380px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
            <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--ink-soft)", textTransform: "uppercase" }}>
              Relocation Delay Duration
            </span>
            <span style={{
              fontSize: "12px",
              fontWeight: 700,
              color: delayMonths > 0 ? "var(--immediate)" : "var(--safe)",
              background: delayMonths > 0 ? "rgba(200, 75, 75, 0.1)" : "rgba(46, 139, 104, 0.1)",
              padding: "2px 8px",
              borderRadius: "6px"
            }}>
              {delayMonths === 0 ? "Immediate Action (0 mos)" : `+${delayMonths} Months Inaction`}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="36"
            step="3"
            value={delayMonths}
            onChange={(e) => setDelayMonths(Number(e.target.value))}
            style={{ width: "100%", accentColor: delayMonths > 12 ? "var(--immediate)" : "var(--brand-2)" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10.5px", color: "var(--ink-soft)", marginTop: "2px" }}>
            <span>0m (Proactive)</span>
            <span>12m</span>
            <span>24m</span>
            <span>36m (High Hazard Degradation)</span>
          </div>
        </div>
      </div>

      {/* Main Feature Display: The Balance Scale & Act Today, Save Tomorrow */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 270px), 1fr))",
        gap: "16px",
        marginBottom: "24px"
      }}>
        {/* Visual Balance Scale Card */}
        <div style={{
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: "14px",
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          boxShadow: "0 4px 16px rgba(0,0,0,0.04)",
          position: "relative"
        }}>
          <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 700, color: "var(--brand)" }}>
              <Scale size={16} /> Cost of Inaction Balance
            </div>
            <span style={{
              fontSize: "11px",
              fontWeight: 700,
              padding: "4px 10px",
              borderRadius: "20px",
              background: "#ecfdf5",
              color: "#065f46",
              border: "1px solid #a7f3d0"
            }}>
              Act Today, Save Tomorrow
            </span>
          </div>

          {/* SVG Balance Scale Visual */}
          <div style={{ width: "100%", height: "230px", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
            <svg viewBox="0 0 400 240" style={{ width: "100%", maxWidth: "380px", height: "100%", overflow: "visible" }}>
              {/* Stand base & fulcrum */}
              <path d="M170 210 L230 210 L210 90 L190 90 Z" fill="#475569" opacity="0.8" />
              <rect x="150" y="210" width="100" height="10" rx="4" fill="#334155" />
              <circle cx="200" cy="90" r="10" fill="#0f172a" />
              <circle cx="200" cy="90" r="4" fill="#38bdf8" />

              {/* Lever arm tilting based on difference */}
              <g transform={`rotate(${scaleTilt} 200 90)`} style={{ transition: "transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)" }}>
                {/* Horizontal balance beam */}
                <rect x="50" y="87" width="300" height="6" rx="3" fill="#1e293b" />
                <circle cx="65" cy="90" r="4" fill="#0284c7" />
                <circle cx="335" cy="90" r="4" fill="#ef4444" />

                {/* Left side strings (Proactive - Higher up / lighter burden) */}
                <line x1="65" y1="90" x2="45" y2="135" stroke="#94a3b8" strokeWidth="1.8" />
                <line x1="65" y1="90" x2="85" y2="135" stroke="#94a3b8" strokeWidth="1.8" />
                {/* Left Pan */}
                <path d="M35 135 Q65 150 95 135 Z" fill="#2e8b68" opacity="0.9" />

                {/* Right side strings (Post-Disaster - Heavy burden tilted down) */}
                <line x1="335" y1="90" x2="315" y2="155" stroke="#94a3b8" strokeWidth="1.8" />
                <line x1="335" y1="90" x2="355" y2="155" stroke="#94a3b8" strokeWidth="1.8" />
                {/* Right Pan */}
                <path d="M305 155 Q335 170 365 155 Z" fill="#c84b4b" opacity="0.95" />
              </g>

              {/* Badges overlaid on pans */}
              {/* Left Proactive Cost Box */}
              <g transform="translate(10, 40)">
                <rect width="115" height="54" rx="8" fill="#f0fdf4" stroke="#86efac" strokeWidth="1.5" />
                <text x="57" y="18" textAnchor="middle" fontSize="10" fontWeight="600" fill="#166534">PROACTIVE COST</text>
                <text x="57" y="42" textAnchor="middle" fontSize="18" fontWeight="800" fill="#15803d">₹{proactiveCosts.total} Cr</text>
              </g>

              {/* Right Post Disaster Cost Box */}
              <g transform="translate(275, 140)">
                <rect width="120" height="54" rx="8" fill="#fef2f2" stroke="#fca5a5" strokeWidth="1.5" />
                <text x="60" y="18" textAnchor="middle" fontSize="9.5" fontWeight="600" fill="#991b1b">POST DISASTER COST</text>
                <text x="60" y="42" textAnchor="middle" fontSize="18" fontWeight="800" fill="#b91c1c">₹{postDisasterCosts.total} Cr</text>
              </g>
            </svg>
          </div>

          <div style={{
            width: "100%",
            background: "var(--panel-2)",
            borderRadius: "10px",
            padding: "12px 14px",
            marginTop: "12px",
            fontSize: "12px",
            color: "var(--ink)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}>
            <span><strong>Cost of Delay Penalty:</strong> {delayMonths} months inaction</span>
            <span style={{ color: "var(--immediate)", fontWeight: 700 }}>+₹{postDisasterCosts.delayPenalty} Cr added burden</span>
          </div>
        </div>

        {/* Cost Comparison Chart & Insights */}
        <div style={{
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: "14px",
          padding: "22px",
          boxShadow: "0 4px 16px rgba(0,0,0,0.04)",
          display: "flex",
          flexDirection: "column"
        }}>
          <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--brand)", marginBottom: "4px" }}>
            Fiscal Impact Comparison (₹ Crores)
          </div>
          <div style={{ fontSize: "12px", color: "var(--ink-soft)", marginBottom: "16px" }}>
            Planned relocation outlay vs emergency disaster expenditure for {selectedZone.name} ({population} citizens, {households} households).
          </div>

          <div style={{ height: "200px", width: "100%", marginBottom: "16px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10.5, fill: "var(--ink-soft)" }} axisLine={{ stroke: "var(--line)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--ink-soft)" }} axisLine={{ stroke: "var(--line)" }} />
                <Tooltip
                  formatter={(val) => [`₹${val} Crores`, "Cost"]}
                  contentStyle={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="cost" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, idx) => (
                    <Cell
                      key={idx}
                      fill={entry.type === "proactive" ? "#2e8b68" : entry.type === "post" ? "#c84b4b" : "#991b1b"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "auto" }}>
            <div style={{ padding: "10px", background: "#f0fdf4", borderRadius: "8px", border: "1px solid #bbf7d0" }}>
              <div style={{ fontSize: "10.5px", color: "#166534", fontWeight: 600 }}>TAX-PAYER BENEFIT</div>
              <div style={{ fontSize: "17px", fontWeight: 800, color: "#15803d" }}>₹{savings} Cr Saved</div>
              <div style={{ fontSize: "11px", color: "#166534" }}>Avoids repeat emergency relief</div>
            </div>
            <div style={{ padding: "10px", background: "#eff6ff", borderRadius: "8px", border: "1px solid #bfdbfe" }}>
              <div style={{ fontSize: "10.5px", color: "#1e40af", fontWeight: 600 }}>DELAY EXPOSURE RATE</div>
              <div style={{ fontSize: "17px", fontWeight: 800, color: "#1d4ed8" }}>₹14 Lakhs/mo</div>
              <div style={{ fontSize: "11px", color: "#1e40af" }}>Cost compounded each month</div>
            </div>
          </div>
        </div>
      </div>

      {/* Granular Breakdown Tables */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 270px), 1fr))",
        gap: "16px"
      }}>
        {/* Proactive Plan Breakdown */}
        <div style={{
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: "12px",
          overflow: "hidden"
        }}>
          <div style={{
            background: "#f0fdf4",
            padding: "12px 18px",
            borderBottom: "1px solid #dcfce7",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <span style={{ fontWeight: 700, fontSize: "13px", color: "#166534", display: "flex", alignItems: "center", gap: "6px" }}>
              <ShieldCheck size={15} /> Proactive Relocation Investment (₹{proactiveCosts.total} Cr)
            </span>
            <span style={{ fontSize: "11px", fontWeight: 600, background: "#bbf7d0", color: "#14532d", padding: "2px 8px", borderRadius: "4px" }}>
              Permanent Asset
            </span>
          </div>

          <div style={{ padding: "14px 18px" }}>
            <table style={{ width: "100%", fontSize: "12.5px", borderCollapse: "collapse" }}>
              <tbody>
                <tr style={{ borderBottom: "1px dashed var(--line)" }}>
                  <td style={{ padding: "8px 0", color: "var(--ink-soft)" }}>Safe Site Prep & Land Development</td>
                  <td style={{ padding: "8px 0", textAlign: "right", fontWeight: 600 }}>₹{proactiveCosts.landDev} Cr</td>
                </tr>
                <tr style={{ borderBottom: "1px dashed var(--line)" }}>
                  <td style={{ padding: "8px 0", color: "var(--ink-soft)" }}>Disaster-Resilient Housing (PMAY-G)</td>
                  <td style={{ padding: "8px 0", textAlign: "right", fontWeight: 600 }}>₹{proactiveCosts.housing} Cr</td>
                </tr>
                <tr style={{ borderBottom: "1px dashed var(--line)" }}>
                  <td style={{ padding: "8px 0", color: "var(--ink-soft)" }}>Water, Solar Mini-grid & Access Roads</td>
                  <td style={{ padding: "8px 0", textAlign: "right", fontWeight: 600 }}>₹{proactiveCosts.infrastructure} Cr</td>
                </tr>
                <tr style={{ borderBottom: "1px dashed var(--line)" }}>
                  <td style={{ padding: "8px 0", color: "var(--ink-soft)" }}>Livelihood Rehabilitation Allowance</td>
                  <td style={{ padding: "8px 0", textAlign: "right", fontWeight: 600 }}>₹{proactiveCosts.livelihoodTransit} Cr</td>
                </tr>
                <tr>
                  <td style={{ padding: "10px 0", fontWeight: 700, color: "var(--ink)" }}>Total Proactive Outlay</td>
                  <td style={{ padding: "10px 0", textAlign: "right", fontWeight: 800, color: "#166534", fontSize: "14px" }}>
                    ₹{proactiveCosts.total} Cr
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Post-Disaster Disaster Expense Breakdown */}
        <div style={{
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: "12px",
          overflow: "hidden"
        }}>
          <div style={{
            background: "#fef2f2",
            padding: "12px 18px",
            borderBottom: "1px solid #fee2e2",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <span style={{ fontWeight: 700, fontSize: "13px", color: "#991b1b", display: "flex", alignItems: "center", gap: "6px" }}>
              <AlertTriangle size={15} /> Projected Post-Disaster Cost (₹{postDisasterCosts.total} Cr)
            </span>
            <span style={{ fontSize: "11px", fontWeight: 600, background: "#fecaca", color: "#7f1d1d", padding: "2px 8px", borderRadius: "4px" }}>
              Sunk Losses
            </span>
          </div>

          <div style={{ padding: "14px 18px" }}>
            <table style={{ width: "100%", fontSize: "12.5px", borderCollapse: "collapse" }}>
              <tbody>
                <tr style={{ borderBottom: "1px dashed var(--line)" }}>
                  <td style={{ padding: "8px 0", color: "var(--ink-soft)" }}>NDRF Search, Rescue & Airlifts</td>
                  <td style={{ padding: "8px 0", textAlign: "right", fontWeight: 600 }}>₹{postDisasterCosts.rescueNDRF} Cr</td>
                </tr>
                <tr style={{ borderBottom: "1px dashed var(--line)" }}>
                  <td style={{ padding: "8px 0", color: "var(--ink-soft)" }}>Relief Camps, Food & Medical Supply</td>
                  <td style={{ padding: "8px 0", textAlign: "right", fontWeight: 600 }}>₹{postDisasterCosts.reliefCamps} Cr</td>
                </tr>
                <tr style={{ borderBottom: "1px dashed var(--line)" }}>
                  <td style={{ padding: "8px 0", color: "var(--ink-soft)" }}>Ex-Gratia Loss of Life & Casualty Payouts</td>
                  <td style={{ padding: "8px 0", textAlign: "right", fontWeight: 600 }}>₹{postDisasterCosts.exGratia} Cr</td>
                </tr>
                <tr style={{ borderBottom: "1px dashed var(--line)" }}>
                  <td style={{ padding: "8px 0", color: "var(--ink-soft)" }}>Emergency Road & Grid Reconstruction</td>
                  <td style={{ padding: "8px 0", textAlign: "right", fontWeight: 600 }}>₹{postDisasterCosts.reconstruction} Cr</td>
                </tr>
                <tr style={{ borderBottom: "1px dashed var(--line)" }}>
                  <td style={{ padding: "8px 0", color: "var(--ink-soft)" }}>Local Economic & Agricultural Disruption</td>
                  <td style={{ padding: "8px 0", textAlign: "right", fontWeight: 600 }}>₹{postDisasterCosts.economicLoss} Cr</td>
                </tr>
                {delayMonths > 0 && (
                  <tr style={{ borderBottom: "1px dashed var(--line)", background: "rgba(200,75,75,0.06)" }}>
                    <td style={{ padding: "8px 4px", color: "var(--immediate)", fontWeight: 600 }}>Inaction Delay Surcharge ({delayMonths} mos)</td>
                    <td style={{ padding: "8px 4px", textAlign: "right", fontWeight: 700, color: "var(--immediate)" }}>+₹{postDisasterCosts.delayPenalty} Cr</td>
                  </tr>
                )}
                <tr>
                  <td style={{ padding: "10px 0", fontWeight: 700, color: "var(--ink)" }}>Total Disaster Expenditure</td>
                  <td style={{ padding: "10px 0", textAlign: "right", fontWeight: 800, color: "#991b1b", fontSize: "14px" }}>
                    ₹{postDisasterCosts.total} Cr
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
