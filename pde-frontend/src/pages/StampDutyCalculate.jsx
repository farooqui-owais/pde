import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios.js";
import HeaderSarita from "../components/HeaderSarita.jsx";
import Footer from "../components/Footer.jsx";
import "./StampDutyCalculate.css";

function TreeNode({ node, selectedId, onSelect }) {
  const isLeaf = !node.children;
  return (
    <li>
      <span
        className={"calc-node " + (isLeaf ? "leaf" : "branch") + (selectedId === node.id ? " selected" : "")}
        onClick={() => isLeaf && onSelect(node.id)}
      >
        {node.label}
      </span>
      {node.children && (
        <ul>
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} selectedId={selectedId} onSelect={onSelect} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function StampDutyCalculate() {
  const navigate = useNavigate();
  const [tree, setTree] = useState(null);
  const [selectedClause, setSelectedClause] = useState("");
  const [marketValue, setMarketValue] = useState("");
  const [considerationAmount, setConsiderationAmount] = useState("");
  const [surcharge, setSurcharge] = useState("1");
  const [metroCess, setMetroCess] = useState("0");
  const [railwayCess, setRailwayCess] = useState("0");
  const [isInvestor, setIsInvestor] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/api/stamp/clause-tree").then((r) => setTree(r.data)).catch(() => {});
  }, []);

  async function handleCalculate() {
    setError("");
    if (!selectedClause) { setError("Select a clause from the tree above."); return; }
    if (!marketValue || !considerationAmount) { setError("Enter market value and consideration amount."); return; }
    try {
      const { data } = await api.post("/api/stamp/calculate-advanced", {
        clause_id: selectedClause,
        market_value: marketValue,
        consideration_amount: considerationAmount,
        surcharge_percent: surcharge,
        metro_cess_percent: metroCess,
        railway_cess_percent: railwayCess,
        is_investor_clause: isInvestor,
      });
      setResult(data);
    } catch (err) {
      setError(err?.response?.data?.detail || "Could not calculate stamp duty for this clause.");
    }
  }

  return (
    <div className="page-shell">
      <HeaderSarita />
      <div className="page-body calc-body">
        <h1 className="calc-title">Stamp Duty Calculate</h1>

        {error && <div className="banner banner-error">{error}</div>}

        <div style={{ display: "flex", gap: 20, marginBottom: 16 }}>
          <div className="field" style={{ marginBottom: 0, flex: 1 }}>
            <label>Market Value</label>
            <input type="number" min="0" value={marketValue} onChange={(e) => setMarketValue(e.target.value)} />
          </div>
          <div className="field" style={{ marginBottom: 0, flex: 1 }}>
            <label>Consideration Amount</label>
            <input type="number" min="0" value={considerationAmount} onChange={(e) => setConsiderationAmount(e.target.value)} />
          </div>
        </div>

        <div className="calc-tree">
          {tree ? (
            <ul>
              <TreeNode node={tree} selectedId={selectedClause} onSelect={setSelectedClause} />
            </ul>
          ) : (
            <div style={{ color: "#777" }}>Loading clauses\u2026</div>
          )}
        </div>

        <div className="calc-controls">
          <label>Percentage Surcharge :</label>
          <select value={surcharge} onChange={(e) => setSurcharge(e.target.value)}>
            <option value="0">0</option><option value="1">1</option><option value="2">2</option>
          </select>

          <label>Metrocess :</label>
          <select value={metroCess} onChange={(e) => setMetroCess(e.target.value)}>
            <option value="0">0</option><option value="1">1</option>
          </select>

          <label>RailwayCess :</label>
          <select value={railwayCess} onChange={(e) => setRailwayCess(e.target.value)}>
            <option value="0">0</option><option value="1">1</option>
          </select>

          <label>Is Investor clause under 5-G-A-2 ?</label>
          <div className="calc-check">
            <input type="checkbox" checked={isInvestor} onChange={(e) => setIsInvestor(e.target.checked)} />
          </div>
        </div>

        <div className="calc-results">
          <div>Actual Stamp Duty : {result ? `\u20b9 ${result.actual_stamp_duty}` : "\u2014"}</div>
          <div>Surcharge : {result ? `\u20b9 ${result.surcharge}` : "\u2014"}</div>
          <div>Total Stamp Duty : {result ? `\u20b9 ${result.total_stamp_duty}` : "\u2014"}</div>
        </div>

        <div className="calc-actions">
          <button className="btn btn-blue" onClick={handleCalculate}>Calculate</button>
          <button className="btn btn-outline" onClick={handleCalculate} disabled={!result}>Save &amp; Close</button>
          <button className="btn btn-blue" onClick={() => navigate(-1)}>Exit Without Change</button>
        </div>

        <div className="field-hint" style={{ marginTop: 14 }}>
          Illustrative clause rates for demonstration only \u2014 verify the current
          official Maharashtra Stamp Act schedule before relying on this for any real
          transaction.
        </div>
      </div>
      <Footer />
    </div>
  );
}
