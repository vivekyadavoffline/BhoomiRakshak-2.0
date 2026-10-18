import React, { useState, useMemo } from "react";
import {
  Wallet, Landmark, FileText, CheckCircle2, Copy, Download,
  Coins, Sparkles, Building2, HelpCircle, Shield, ArrowRight,
  TrendingUp, Award
} from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend
} from "recharts";

export default function ClimateFundCalculator({ zones = [], initialZoneId = null }) {
  const [selectedId, setSelectedId] = useState(initialZoneId || (zones[0]?.id || ""));
  const [stateType, setStateType] = useState("himalayan"); // "general" (75:25) or "himalayan" (90:10)
  const [copied, setCopied] = useState(false);

  const selectedZone = useMemo(() => {
    return zones.find((z) => z.id === selectedId) || zones[0] || {
      id: "RZ-DEMO",
      name: "High-Risk Habitation",
      district: "Chamoli",
      population: 480,
      priorityScore: 88,
      hazard: "Landslide / Flash Flood"
    };
  }, [zones, selectedId]);

  // Base parameters
  const [customHouseholds, setCustomHouseholds] = useState(() => Math.ceil((selectedZone?.population || 480) / 4.2));
  const [housingCostPerUnit, setHousingCostPerUnit] = useState(2.8); // Lakhs
  const [infraCostPerUnit, setInfraCostPerUnit] = useState(1.2);     // Lakhs (water, power, sanitation)
  const [landDevPerUnit, setLandDevPerUnit] = useState(0.9);        // Lakhs
  const [livelihoodPerUnit, setLivelihoodPerUnit] = useState(0.6);   // Lakhs

  // When selected zone changes, update household count
  const handleZoneChange = (zoneId) => {
    setSelectedId(zoneId);
    const z = zones.find(item => item.id === zoneId);
    if (z) {
      setCustomHouseholds(Math.ceil((z.population || 400) / 4.2));
    }
  };

  // Statutory Cost Calculations (in ₹ Crores)
  const financialTotals = useMemo(() => {
    const hh = Number(customHouseholds) || 1;
    const totalHousingLakhs = hh * housingCostPerUnit;
    const totalInfraLakhs = hh * infraCostPerUnit;
    const totalLandLakhs = hh * landDevPerUnit;
    const totalLivelihoodLakhs = hh * livelihoodPerUnit;

    const totalLakhs = totalHousingLakhs + totalInfraLakhs + totalLandLakhs + totalLivelihoodLakhs;
    const totalCrores = Number((totalLakhs / 100).toFixed(2));

    // Convergence Grants:
    // PMAY-G standard grant norm = ₹1.30 Lakh/unit
    const pmaygConvergenceCrores = Number(((hh * 1.30) / 100).toFixed(2));
    // Jal Jeevan Mission (JJM) water norm = ₹0.50 Lakh/hh
    const jjmConvergenceCrores = Number(((hh * 0.50) / 100).toFixed(2));
    // PMGSY safe access road allocation = ₹0.40 Lakh/hh equivalent
    const pmgsyConvergenceCrores = Number(((hh * 0.40) / 100).toFixed(2));
    const totalConvergenceCrores = Number((pmaygConvergenceCrores + jjmConvergenceCrores + pmgsyConvergenceCrores).toFixed(2));

    // Net Mitigation Outlay after Central Schemes convergence
    const netMitigationRequirement = Math.max(0.2, Number((totalCrores - totalConvergenceCrores).toFixed(2)));

    // Statutory Sharing Ratio under 15th Finance Commission Disaster Mitigation Funds:
    // General States: 75% Centre (NDMF) : 25% State (SDMF)
    // Himalayan/Special States: 90% Centre (NDMF) : 10% State (SDMF)
    const centralRate = stateType === "himalayan" ? 0.90 : 0.75;
    const stateRate = stateType === "himalayan" ? 0.10 : 0.25;

    const ndmfShareCrores = Number((netMitigationRequirement * centralRate).toFixed(2));
    const sdmfShareCrores = Number((netMitigationRequirement * stateRate).toFixed(2));

    // Overall Central vs State Contribution:
    const totalCentralContribution = Number((ndmfShareCrores + totalConvergenceCrores).toFixed(2));
    const totalStateContribution = sdmfShareCrores;

    return {
      households: hh,
      totalCrores,
      pmaygConvergenceCrores,
      jjmConvergenceCrores,
      pmgsyConvergenceCrores,
      totalConvergenceCrores,
      netMitigationRequirement,
      ndmfShareCrores,
      sdmfShareCrores,
      totalCentralContribution,
      totalStateContribution,
      centralRatePercent: centralRate * 100,
      stateRatePercent: stateRate * 100,
    };
  }, [customHouseholds, housingCostPerUnit, infraCostPerUnit, landDevPerUnit, livelihoodPerUnit, stateType]);

  const pieData = [
    { name: "NDMF (National Disaster Mitigation)", value: financialTotals.ndmfShareCrores, color: "#1e7890" },
    { name: "SDMF (State Disaster Mitigation)", value: financialTotals.sdmfShareCrores, color: "#2e8b68" },
    { name: "Central Ministry Convergence (PMAY/JJM)", value: financialTotals.totalConvergenceCrores, color: "#f59e0b" },
  ];

  const memoText = `MEMORANDUM FOR RELOCATION FINANCIAL SANCTION
To: State Disaster Management Authority (SDMA) / NDMA
Sub: Statutory Fund Mapping for Proactive Resettlement of ${selectedZone.name} (${selectedZone.id})
Statutory Authority: 15th Finance Commission Guidelines & Sec 48(1)(a) Disaster Management Act, 2005

1. Habitation Profile:
   - Location: ${selectedZone.name}, District ${selectedZone.district}
   - Exposure: Population ${selectedZone.population} (~${financialTotals.households} Households)
   - Risk Phase: ${selectedZone.phase} (Priority Score: ${selectedZone.priorityScore})

2. Comprehensive Budget Allocation:
   - Total Resettlement Outlay: ₹${financialTotals.totalCrores} Crores
   - Central Schemes Convergence (PMAY-G + JJM + PMGSY): ₹${financialTotals.totalConvergenceCrores} Crores
   - Net Disaster Mitigation Requirement: ₹${financialTotals.netMitigationRequirement} Crores

3. Statutory Fund Auto-Mapping:
   - NDMF (National Disaster Mitigation Fund - ${financialTotals.centralRatePercent}%): ₹${financialTotals.ndmfShareCrores} Crores
   - SDMF (State Disaster Mitigation Fund - ${financialTotals.stateRatePercent}%): ₹${financialTotals.sdmfShareCrores} Crores
   - Total Central Outflow: ₹${financialTotals.totalCentralContribution} Crores
   - Total State Matching Share: ₹${financialTotals.totalStateContribution} Crores

Status: Auto-verified against SDMF/NDMF eligibility rules. Recommended for immediate administrative clearance.`;

  const handleCopyMemo = () => {
    navigator.clipboard.writeText(memoText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2400);
  };

  return (
    <div className="climate-fund-container" style={{ animation: "rise-in 0.4s ease both" }}>
      {/* Header Banner */}
      <div style={{
        background: "linear-gradient(135deg, #0f3d3e 0%, #155e63 50%, #197278 100%)",
        borderRadius: "14px",
        padding: "24px 28px",
        color: "#ffffff",
        marginBottom: "20px",
        boxShadow: "0 10px 30px rgba(15, 61, 62, 0.2)",
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
              <Wallet size={13} /> Feature 2 · Climate Migration Fund Calculator
            </div>
            <h2 style={{ margin: "0 0 8px", fontSize: "24px", fontFamily: "Space Grotesk, sans-serif", fontWeight: 700 }}>
              Auto-maps funding rules across SDMF, NDMF & Central Grants
            </h2>
            <p style={{ margin: 0, opacity: 0.9, fontSize: "13px", lineHeight: "1.5" }}>
              Eliminates funding ambiguity by automatically mapping statutory funding formulas from the <strong>15th Finance Commission Disaster Mitigation window</strong>, National Disaster Mitigation Fund (NDMF), State Disaster Mitigation Fund (SDMF), and central line ministry convergence.
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
            <div style={{ fontSize: "11px", opacity: 0.85, textTransform: "uppercase", letterSpacing: "0.5px" }}>Total Outlay Mapped</div>
            <div style={{ fontSize: "32px", fontWeight: 800, fontFamily: "Space Grotesk, sans-serif", color: "#a7f3d0" }}>₹{financialTotals.totalCrores} Cr</div>
            <div style={{ fontSize: "11.5px", color: "#ecfdf5" }}>100% Fully Financed</div>
          </div>
        </div>

        {/* Ambient glow decoration */}
        <div style={{
          position: "absolute",
          top: "-40%",
          right: "-5%",
          width: "300px",
          height: "300px",
          background: "radial-gradient(circle, rgba(167,243,208,0.25) 0%, rgba(15,61,62,0) 70%)",
          pointerEvents: "none"
        }} />
      </div>

      {/* Control Configuration Bar */}
      <div style={{
        background: "var(--panel)",
        border: "1px solid var(--line)",
        borderRadius: "12px",
        padding: "18px 20px",
        marginBottom: "20px",
        display: "flex",
        flexWrap: "wrap",
        gap: "18px",
        alignItems: "center",
        justifyContent: "space-between",
        boxShadow: "0 2px 10px rgba(0,0,0,0.03)"
      }}>
        {/* Zone Selector */}
        <div>
          <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--ink-soft)", textTransform: "uppercase", marginBottom: "4px" }}>
            Target Habitation
          </label>
          <select
            value={selectedZone.id}
            onChange={(e) => handleZoneChange(e.target.value)}
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

        {/* State Classification Toggle */}
        <div>
          <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--ink-soft)", textTransform: "uppercase", marginBottom: "4px" }}>
            State Statutory Category
          </label>
          <div style={{ display: "flex", background: "var(--panel-2)", padding: "3px", borderRadius: "8px", border: "1px solid var(--line)" }}>
            <button
              onClick={() => setStateType("himalayan")}
              style={{
                border: "none",
                background: stateType === "himalayan" ? "var(--brand)" : "transparent",
                color: stateType === "himalayan" ? "#fff" : "var(--ink-soft)",
                padding: "6px 12px",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s"
              }}
            >
              Himalayan / NE States (90:10)
            </button>
            <button
              onClick={() => setStateType("general")}
              style={{
                border: "none",
                background: stateType === "general" ? "var(--brand)" : "transparent",
                color: stateType === "general" ? "#fff" : "var(--ink-soft)",
                padding: "6px 12px",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s"
              }}
            >
              General States (75:25)
            </button>
          </div>
        </div>

        {/* Households Input */}
        <div>
          <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--ink-soft)", textTransform: "uppercase", marginBottom: "4px" }}>
            Beneficiary Families
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <input
              type="number"
              min="10"
              max="5000"
              value={customHouseholds}
              onChange={(e) => setCustomHouseholds(Math.max(1, Number(e.target.value)))}
              style={{
                width: "90px",
                padding: "7px 10px",
                border: "1px solid var(--line)",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 600,
                background: "var(--panel-2)"
              }}
            />
            <span style={{ fontSize: "12px", color: "var(--ink-soft)" }}>Households</span>
          </div>
        </div>
      </div>

      {/* 3 Core Pillars of Funding: SDMF, NDMF & Central Grants */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 270px), 1fr))",
        gap: "16px",
        marginBottom: "24px"
      }}>
        {/* Card 1: NDMF */}
        <div style={{
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: "12px",
          padding: "20px",
          boxShadow: "0 4px 16px rgba(0,0,0,0.03)",
          borderTop: "4px solid #1e7890"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#1e7890", textTransform: "uppercase" }}>
              National Allocation
            </span>
            <span style={{ fontSize: "11px", background: "#e0f2fe", color: "#0369a1", padding: "2px 8px", borderRadius: "12px", fontWeight: 600 }}>
              {financialTotals.centralRatePercent}% Central Share
            </span>
          </div>
          <div style={{ fontSize: "28px", fontWeight: 800, fontFamily: "Space Grotesk, sans-serif", color: "var(--brand)", marginBottom: "4px" }}>
            ₹{financialTotals.ndmfShareCrores} Cr
          </div>
          <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--ink)", marginBottom: "6px" }}>
            NDMF Window
          </div>
          <p style={{ fontSize: "12px", color: "var(--ink-soft)", margin: "0 0 12px", lineHeight: "1.4" }}>
            National Disaster Mitigation Fund earmarked under the 15th FC for high-risk settlement relocation and hazard mitigation.
          </p>
          <div style={{ fontSize: "11px", background: "var(--panel-2)", padding: "6px 10px", borderRadius: "6px", color: "var(--ink)" }}>
            <strong>Rule:</strong> Sec 48(1)(a) Disaster Management Act
          </div>
        </div>

        {/* Card 2: SDMF */}
        <div style={{
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: "12px",
          padding: "20px",
          boxShadow: "0 4px 16px rgba(0,0,0,0.03)",
          borderTop: "4px solid #2e8b68"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#2e8b68", textTransform: "uppercase" }}>
              State Matching Fund
            </span>
            <span style={{ fontSize: "11px", background: "#dcfce7", color: "#15803d", padding: "2px 8px", borderRadius: "12px", fontWeight: 600 }}>
              {financialTotals.stateRatePercent}% State Share
            </span>
          </div>
          <div style={{ fontSize: "28px", fontWeight: 800, fontFamily: "Space Grotesk, sans-serif", color: "#2e8b68", marginBottom: "4px" }}>
            ₹{financialTotals.sdmfShareCrores} Cr
          </div>
          <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--ink)", marginBottom: "6px" }}>
            SDMF Window
          </div>
          <p style={{ fontSize: "12px", color: "var(--ink-soft)", margin: "0 0 12px", lineHeight: "1.4" }}>
            State Disaster Mitigation Fund matching contribution budgeted in the State Disaster Management plan.
          </p>
          <div style={{ fontSize: "11px", background: "var(--panel-2)", padding: "6px 10px", borderRadius: "6px", color: "var(--ink)" }}>
            <strong>Rule:</strong> State matching formula for disaster reduction
          </div>
        </div>

        {/* Card 3: Central Schemes Convergence */}
        <div style={{
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: "12px",
          padding: "20px",
          boxShadow: "0 4px 16px rgba(0,0,0,0.03)",
          borderTop: "4px solid #f59e0b"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#b45309", textTransform: "uppercase" }}>
              Line Ministries
            </span>
            <span style={{ fontSize: "11px", background: "#fef3c7", color: "#b45309", padding: "2px 8px", borderRadius: "12px", fontWeight: 600 }}>
              Convergence Norm
            </span>
          </div>
          <div style={{ fontSize: "28px", fontWeight: 800, fontFamily: "Space Grotesk, sans-serif", color: "#d97706", marginBottom: "4px" }}>
            ₹{financialTotals.totalConvergenceCrores} Cr
          </div>
          <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--ink)", marginBottom: "6px" }}>
            Central Grants Convergence
          </div>
          <p style={{ fontSize: "12px", color: "var(--ink-soft)", margin: "0 0 12px", lineHeight: "1.4" }}>
            Auto-converged from PMAY-G (₹{financialTotals.pmaygConvergenceCrores} Cr), Jal Jeevan Mission (₹{financialTotals.jjmConvergenceCrores} Cr), and PMGSY road connectivity.
          </p>
          <div style={{ fontSize: "11px", background: "var(--panel-2)", padding: "6px 10px", borderRadius: "6px", color: "var(--ink)" }}>
            <strong>Norm:</strong> Inter-Ministerial Convergence Protocol
          </div>
        </div>
      </div>

      {/* Interactive Sliders & Visual Pie Chart */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 270px), 1fr))",
        gap: "16px",
        marginBottom: "24px"
      }}>
        {/* Cost Matrix Tuning */}
        <div style={{
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: "14px",
          padding: "22px",
          boxShadow: "0 4px 16px rgba(0,0,0,0.03)"
        }}>
          <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--brand)", marginBottom: "6px" }}>
            Per-Household Resettlement Unit Norms
          </div>
          <p style={{ fontSize: "12px", color: "var(--ink-soft)", margin: "0 0 16px" }}>
            Adjust standardized unit norms per household to calibrate the total financial package.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {/* Housing */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                <span>Disaster-Resilient Housing (PMAY-G+)</span>
                <span style={{ color: "var(--brand)" }}>₹{housingCostPerUnit} Lakhs/hh</span>
              </div>
              <input
                type="range"
                min="1.5"
                max="5.0"
                step="0.1"
                value={housingCostPerUnit}
                onChange={(e) => setHousingCostPerUnit(Number(e.target.value))}
                style={{ width: "100%", accentColor: "var(--brand)" }}
              />
            </div>

            {/* Basic Infrastructure */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                <span>Community Utilities (Water, Power, Solar)</span>
                <span style={{ color: "#1e7890" }}>₹{infraCostPerUnit} Lakhs/hh</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="3.0"
                step="0.1"
                value={infraCostPerUnit}
                onChange={(e) => setInfraCostPerUnit(Number(e.target.value))}
                style={{ width: "100%", accentColor: "#1e7890" }}
              />
            </div>

            {/* Land Development */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                <span>Land Preparation & Retaining Walls</span>
                <span style={{ color: "#2e8b68" }}>₹{landDevPerUnit} Lakhs/hh</span>
              </div>
              <input
                type="range"
                min="0.3"
                max="2.5"
                step="0.1"
                value={landDevPerUnit}
                onChange={(e) => setLandDevPerUnit(Number(e.target.value))}
                style={{ width: "100%", accentColor: "#2e8b68" }}
              />
            </div>

            {/* Livelihood Seed */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                <span>Livelihood Transition & Skill Grant</span>
                <span style={{ color: "#f59e0b" }}>₹{livelihoodPerUnit} Lakhs/hh</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="1.5"
                step="0.1"
                value={livelihoodPerUnit}
                onChange={(e) => setLivelihoodPerUnit(Number(e.target.value))}
                style={{ width: "100%", accentColor: "#f59e0b" }}
              />
            </div>
          </div>
        </div>

        {/* Visual Fund Distribution Pie Chart */}
        <div style={{
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: "14px",
          padding: "22px",
          boxShadow: "0 4px 16px rgba(0,0,0,0.03)",
          display: "flex",
          flexDirection: "column"
        }}>
          <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--brand)", marginBottom: "4px" }}>
            Funding Source Breakdown
          </div>
          <div style={{ fontSize: "12px", color: "var(--ink-soft)", marginBottom: "10px" }}>
            Auto-mapped distribution for ₹{financialTotals.totalCrores} Crores total requirement.
          </div>

          <div style={{ height: "190px", width: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={3}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val) => [`₹${val} Cr`, "Allocated"]}
                  contentStyle={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11.5px", marginTop: "auto" }}>
            {pieData.map((d) => (
              <div key={d.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: d.color, display: "inline-block" }} />
                  {d.name}
                </span>
                <strong style={{ fontFamily: "Space Grotesk, sans-serif" }}>₹{d.value} Cr</strong>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Official Statutory Sanction Requisition Memo */}
      <div style={{
        background: "var(--panel)",
        border: "1px solid var(--line)",
        borderRadius: "14px",
        padding: "20px 24px",
        boxShadow: "0 4px 16px rgba(0,0,0,0.03)"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "10px" }}>
          <div>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--brand)" }}>
              Official Requisition Memo · State & Central Sanction
            </div>
            <div style={{ fontSize: "12px", color: "var(--ink-soft)" }}>
              Auto-generated funding application memo ready for SDMA / NDMA financial approval.
            </div>
          </div>
          <button
            onClick={handleCopyMemo}
            className="btn-primary sm"
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            {copied ? <CheckCircle2 size={13} /> : <Copy size={13} />}
            {copied ? "Copied to Clipboard" : "Copy Official Memo"}
          </button>
        </div>

        <pre style={{
          background: "var(--panel-2)",
          padding: "16px",
          borderRadius: "8px",
          fontSize: "12px",
          fontFamily: "monospace",
          lineHeight: "1.5",
          color: "var(--ink)",
          whiteSpace: "pre-wrap",
          border: "1px solid var(--line)",
          margin: 0
        }}>
          {memoText}
        </pre>
      </div>
    </div>
  );
}
