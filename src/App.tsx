import { useState, useEffect } from "react";

// ─── Storage ────────────────────────────────────────────────────────────────
const STORAGE_KEY = "rsp_v2";
function load() {
  try { const r = localStorage.getItem(STORAGE_KEY); if (r) return JSON.parse(r); } catch {}
  return {
    recruiters: ["SSG Smith","SGT Johnson","SFC Williams","SSG Brown","SGT Davis","SFC Miller","SSG Wilson","SGT Moore","SFC Taylor"],
    applicants: [],
    archived: [],
  };
}
function save(d) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch {} }

// ─── Helpers ─────────────────────────────────────────────────────────────────
let _id = Date.now();
const uid = () => `id_${_id++}`;
const todayStr = () => new Date().toISOString().split("T")[0];

function daysDiff(ds) {
  if (!ds) return null;
  return Math.ceil((new Date(ds) - new Date(todayStr())) / 86400000);
}
function dateLabel(ds) {
  if (!ds) return null;
  const d = daysDiff(ds);
  if (d < 0) return { text: `${Math.abs(d)}d overdue`, color: "#EF4444" };
  if (d === 0) return { text: "TODAY", color: "#F59E0B" };
  if (d <= 3) return { text: `${d}d`, color: "#FCD34D" };
  return { text: ds, color: "#64748B" };
}

const EMPTY_APPLICANT = (recruiter) => ({
  id: uid(), recruiter,
  name: "",
  dateProcess: "", dateMet: "",
  docs: false, livescan: false,
  mos: "",
  vcnHeld: false,
  datDate: "",
  picatScore: "",
  waiversExpected: "", waiversNeeded: "",
  projectionDate: "",
  createdAt: todayStr(),
});

// ─── Icons ───────────────────────────────────────────────────────────────────
const CheckIcon = ({ checked, onToggle }) => (
  <div onClick={onToggle} style={{
    width: 26, height: 26, borderRadius: 6, border: `2px solid ${checked ? "#10B981" : "#334155"}`,
    background: checked ? "#10B981" : "transparent", display: "flex", alignItems: "center",
    justifyContent: "center", cursor: "pointer", flexShrink: 0, transition: "all .15s",
  }}>
    {checked && <span style={{ color: "#fff", fontSize: 14, fontWeight: 900 }}>✓</span>}
  </div>
);

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [data, setData] = useState(load);
  const [activeTab, setActiveTab] = useState(0); // recruiter index or "archive"
  const [expandedId, setExpandedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newForm, setNewForm] = useState({});
  const [editingRecruiterIdx, setEditingRecruiterIdx] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => { save(data); }, [data]);

  const recruiters = data.recruiters;

  // current tab's applicants
  const tabApplicants = activeTab === "archive"
    ? data.archived
    : (data.applicants || []).filter(a => a.recruiter === recruiters[activeTab]);

  // ── mutations ──────────────────────────────────────────────────────────────
  function addApplicant() {
    if (!newForm.name?.trim()) return;
    const a = { ...EMPTY_APPLICANT(recruiters[activeTab]), ...newForm, id: uid() };
    setData(d => ({ ...d, applicants: [...d.applicants, a] }));
    setShowAddForm(false);
    setNewForm({});
    setExpandedId(a.id);
  }

  function updateApplicant(id, patch) {
    setData(d => ({ ...d, applicants: d.applicants.map(a => a.id === id ? { ...a, ...patch } : a) }));
  }

  function archiveApplicant(id) {
    const target = data.applicants.find(a => a.id === id);
    if (!target) return;
    setData(d => ({
      ...d,
      applicants: d.applicants.filter(a => a.id !== id),
      archived: [...(d.archived || []), { ...target, archivedAt: todayStr() }],
    }));
    if (expandedId === id) setExpandedId(null);
  }

  function restoreApplicant(id) {
    const target = data.archived.find(a => a.id === id);
    if (!target) return;
    const { archivedAt, ...rest } = target;
    setData(d => ({
      ...d,
      archived: d.archived.filter(a => a.id !== id),
      applicants: [...d.applicants, rest],
    }));
  }

  function deleteArchived(id) {
    if (!window.confirm("Permanently delete? This cannot be undone.")) return;
    setData(d => ({ ...d, archived: d.archived.filter(a => a.id !== id) }));
  }

  function updateRecruiterName(idx, name) {
    const old = recruiters[idx];
    setData(d => ({
      ...d,
      recruiters: d.recruiters.map((r, i) => i === idx ? name : r),
      applicants: d.applicants.map(a => a.recruiter === old ? { ...a, recruiter: name } : a),
      archived: d.archived.map(a => a.recruiter === old ? { ...a, recruiter: name } : a),
    }));
  }

  function exportCSV() {
    const headers = ["Recruiter","Applicant","Date to Process","Date Met","Docs","Livescan","MOS","VCN Held","DAT Date","PICAT Score","Waivers Expected","Waivers Needed","Projection Date","Created","Status"];
    const rows = [...data.applicants, ...data.archived.map(a => ({ ...a, _arch: true }))].map(a => [
      a.recruiter, a.name, a.dateProcess, a.dateMet,
      a.docs ? "Yes" : "No", a.livescan ? "Yes" : "No",
      a.mos, a.vcnHeld ? "Yes" : "No",
      a.datDate, a.picatScore,
      a.waiversExpected, a.waiversNeeded,
      a.projectionDate, a.createdAt,
      a._arch ? "Archived" : "Active",
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c ?? ""}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `RSP_Export_${todayStr()}.csv`; a.click();
  }

  // ── inline field update for expanded card ─────────────────────────────────
  function setField(id, key, val) {
    setData(d => ({ ...d, applicants: d.applicants.map(a => a.id === id ? { ...a, [key]: val } : a) }));
  }

  // ── urgency summary ────────────────────────────────────────────────────────
  const overdueTotal = data.applicants.filter(a => { const d = daysDiff(a.dateProcess); return d !== null && d < 0; }).length;

  // ─── SETTINGS VIEW ────────────────────────────────────────────────────────
  if (showSettings) return (
    <div style={C.screen}>
      <div style={C.topBar}>
        <button style={C.backBtn} onClick={() => setShowSettings(false)}>← Back</button>
        <span style={C.topTitle}>Settings</span>
        <span style={{ width: 60 }} />
      </div>
      <div style={C.scroll}>
        <div style={C.sectionHead}>RECRUITER NAMES</div>
        {recruiters.map((r, i) => (
          <div key={i} style={C.settingsRow}>
            <span style={C.settingsNum}>{i + 1}</span>
            {editingRecruiterIdx === i ? (
              <input style={C.inlineIn}
                defaultValue={r} autoFocus
                onBlur={e => { updateRecruiterName(i, e.target.value.trim() || r); setEditingRecruiterIdx(null); }}
                onKeyDown={e => { if (e.key === "Enter") e.target.blur(); }}
              />
            ) : (
              <span style={{ flex: 1, color: "#F1F5F9", fontSize: 15 }}>{r}</span>
            )}
            <button style={C.iconBtn} onClick={() => setEditingRecruiterIdx(i)}>✏️</button>
            <span style={C.subCount}>{data.applicants.filter(a => a.recruiter === r).length} active</span>
          </div>
        ))}
        <div style={{ padding: "20px 16px" }}>
          <button style={C.exportBtn} onClick={exportCSV}>📤 Export All to CSV</button>
        </div>
      </div>
    </div>
  );

  // ─── MAIN VIEW ────────────────────────────────────────────────────────────
  return (
    <div style={C.screen}>
      {/* Header */}
      <div style={C.header}>
        <div>
          <div style={C.appTitle}>RSP TRACKER</div>
          <div style={C.appSub}>Illinois ARNG · {data.applicants.length} Active</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {overdueTotal > 0 && <div style={C.overduePill}>⚠️ {overdueTotal} due</div>}
          <button style={C.iconBtn} onClick={() => setShowSettings(true)}>⚙️</button>
        </div>
      </div>

      {/* Recruiter tabs (horizontal scroll) */}
      <div style={C.tabRow}>
        {recruiters.map((r, i) => {
          const cnt = data.applicants.filter(a => a.recruiter === r).length;
          const od = data.applicants.filter(a => a.recruiter === r && (() => { const d = daysDiff(a.dateProcess); return d !== null && d < 0; })()).length;
          return (
            <button key={r} style={{ ...C.tab, ...(activeTab === i ? C.tabActive : {}) }}
              onClick={() => { setActiveTab(i); setExpandedId(null); setShowAddForm(false); }}>
              <span style={C.tabName}>{r}</span>
              <span style={C.tabCount}>{cnt}</span>
              {od > 0 && <span style={C.tabOD}>⚠️</span>}
            </button>
          );
        })}
        <button style={{ ...C.tab, ...(activeTab === "archive" ? C.tabActive : {}) }}
          onClick={() => { setActiveTab("archive"); setExpandedId(null); setShowAddForm(false); }}>
          <span style={C.tabName}>Archive</span>
          <span style={C.tabCount}>{data.archived.length}</span>
        </button>
      </div>

      {/* Content */}
      <div style={C.scroll}>

        {/* Add button (not on archive tab) */}
        {activeTab !== "archive" && (
          <div style={{ padding: "12px 14px 4px" }}>
            {!showAddForm ? (
              <button style={C.addApplicantBtn} onClick={() => {
                setNewForm({ recruiter: recruiters[activeTab] });
                setShowAddForm(true);
              }}>+ Add Applicant</button>
            ) : (
              <AddForm
                form={newForm} setForm={setNewForm}
                recruiterName={recruiters[activeTab]}
                onSave={addApplicant}
                onCancel={() => { setShowAddForm(false); setNewForm({}); }}
              />
            )}
          </div>
        )}

        {/* Archive tab */}
        {activeTab === "archive" && (
          <>
            {data.archived.length === 0 && <div style={C.empty}>No archived applicants.</div>}
            {data.archived.map(a => (
              <div key={a.id} style={C.archivedCard}>
                <div style={C.archivedTop}>
                  <div>
                    <div style={C.applicantName}>{a.name}</div>
                    <div style={C.archivedMeta}>{a.recruiter} · Archived {a.archivedAt}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button style={C.restoreBtn} onClick={() => restoreApplicant(a.id)}>↩ Restore</button>
                    <button style={C.trashBtn} onClick={() => deleteArchived(a.id)}>🗑</button>
                  </div>
                </div>
                <div style={C.archivedDetails}>
                  {a.mos && <span style={C.chip}>MOS: {a.mos}</span>}
                  {a.projectionDate && <span style={C.chip}>Proj: {a.projectionDate}</span>}
                  {a.picatScore && <span style={C.chip}>PICAT: {a.picatScore}</span>}
                </div>
              </div>
            ))}
          </>
        )}

        {/* Applicant list */}
        {activeTab !== "archive" && tabApplicants.length === 0 && !showAddForm && (
          <div style={C.empty}>No applicants yet.<br />Tap + Add Applicant above.</div>
        )}

        {activeTab !== "archive" && tabApplicants.map(a => {
          const isOpen = expandedId === a.id;
          const dl = dateLabel(a.dateProcess);
          const completeness = [a.docs, a.livescan, a.vcnHeld, !!a.mos, !!a.dateProcess, !!a.projectionDate].filter(Boolean).length;

          return (
            <div key={a.id} style={C.appCard}>
              {/* Row header — always visible */}
              <div style={C.appRow} onClick={() => setExpandedId(isOpen ? null : a.id)}>
                <div style={C.appLeft}>
                  <div style={C.chevron}>{isOpen ? "▾" : "▸"}</div>
                  <div>
                    <div style={C.applicantName}>{a.name || <span style={{ color: "#475569" }}>Unnamed</span>}</div>
                    <div style={C.appMeta}>
                      {dl && <span style={{ color: dl.color, fontWeight: 700, marginRight: 8 }}>{dl.text}</span>}
                      <span style={{ color: "#475569" }}>{completeness}/6 fields</span>
                    </div>
                  </div>
                </div>
                <button style={C.archiveIconBtn} onClick={e => { e.stopPropagation(); if (window.confirm(`Archive ${a.name}?`)) archiveApplicant(a.id); }}>
                  🗄
                </button>
              </div>

              {/* Expanded detail */}
              {isOpen && <ApplicantDetail a={a} setField={setField} />}
            </div>
          );
        })}
        <div style={{ height: 48 }} />
      </div>
    </div>
  );
}

// ─── Applicant Detail (expanded) ─────────────────────────────────────────────
function ApplicantDetail({ a, setField }) {
  const f = (key, val) => setField(a.id, key, val);

  return (
    <div style={D.wrap}>
      <Row label="Recruiter">
        <div style={D.readOnly}>{a.recruiter}</div>
      </Row>
      <Row label="Applicant Name">
        <input style={D.input} value={a.name} onChange={e => f("name", e.target.value)} placeholder="Full name" />
      </Row>
      <Row label="Date Expected to Process">
        <input style={D.input} type="date" value={a.dateProcess} onChange={e => f("dateProcess", e.target.value)} />
      </Row>
      <Row label="Date Met">
        <input style={D.input} type="date" value={a.dateMet} onChange={e => f("dateMet", e.target.value)} />
      </Row>
      <CheckRow label="Docs" checked={a.docs} onToggle={() => f("docs", !a.docs)} />
      <CheckRow label="Livescan" checked={a.livescan} onToggle={() => f("livescan", !a.livescan)} />
      <Row label="MOS">
        <input style={D.input} value={a.mos} onChange={e => f("mos", e.target.value)} placeholder="e.g. 11B, 25U" />
      </Row>
      <CheckRow label="VCN Held" checked={a.vcnHeld} onToggle={() => f("vcnHeld", !a.vcnHeld)} />
      <Row label="DAT Date">
        <input style={D.input} type="date" value={a.datDate} onChange={e => f("datDate", e.target.value)} />
      </Row>
      <Row label="PICAT Score">
        <input style={D.input} type="number" min="0" max="99" value={a.picatScore} onChange={e => f("picatScore", e.target.value)} placeholder="0–99" />
      </Row>
      <Row label="Waivers Expected">
        <input style={D.input} value={a.waiversExpected} onChange={e => f("waiversExpected", e.target.value)} placeholder="Describe if any" />
      </Row>
      <Row label="Waivers Needed">
        <input style={D.input} value={a.waiversNeeded} onChange={e => f("waiversNeeded", e.target.value)} placeholder="Describe if any" />
      </Row>
      <Row label="Projection Date">
        <input style={D.input} type="date" value={a.projectionDate} onChange={e => f("projectionDate", e.target.value)} />
      </Row>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div style={D.row}>
      <div style={D.label}>{label}</div>
      {children}
    </div>
  );
}

function CheckRow({ label, checked, onToggle }) {
  return (
    <div style={D.row}>
      <div style={D.label}>{label}</div>
      <CheckIcon checked={checked} onToggle={onToggle} />
    </div>
  );
}

// ─── Add Form ────────────────────────────────────────────────────────────────
function AddForm({ form, setForm, recruiterName, onSave, onCancel }) {
  return (
    <div style={AF.card}>
      <div style={AF.title}>New Applicant — {recruiterName}</div>
      <input style={AF.input} placeholder="Applicant full name *" value={form.name || ""}
        onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
      <input style={AF.input} type="date" placeholder="Date Expected to Process"
        value={form.dateProcess || ""} onChange={e => setForm(f => ({ ...f, dateProcess: e.target.value }))} />
      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <button style={AF.save} onClick={onSave}>Add</button>
        <button style={AF.cancel} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const font = "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif";

const C = {
  screen: { display: "flex", flexDirection: "column", height: "100vh", background: "#080D1A", fontFamily: font, color: "#F1F5F9", overflow: "hidden", maxWidth: 480, margin: "0 auto" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px 8px", background: "#0D1526", borderBottom: "1px solid #1A2540", flexShrink: 0 },
  appTitle: { fontSize: 24, fontWeight: 900, letterSpacing: 3, textTransform: "uppercase" },
  appSub: { fontSize: 11, color: "#4B6080", letterSpacing: 2, textTransform: "uppercase" },
  overduePill: { background: "#7F1D1D", color: "#FCA5A5", fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 20 },
  iconBtn: { background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#94A3B8", padding: "4px 6px" },

  tabRow: { display: "flex", overflowX: "auto", background: "#0D1526", borderBottom: "2px solid #1A2540", flexShrink: 0, scrollbarWidth: "none" },
  tab: { display: "flex", flexDirection: "column", alignItems: "center", padding: "8px 12px", background: "none", border: "none", color: "#4B6080", cursor: "pointer", whiteSpace: "nowrap", borderBottom: "2px solid transparent", marginBottom: -2, gap: 1 },
  tabActive: { color: "#F1F5F9", borderBottom: "2px solid #3B82F6" },
  tabName: { fontSize: 13, fontWeight: 700, letterSpacing: 0.5 },
  tabCount: { fontSize: 11, background: "#1A2540", borderRadius: 10, padding: "1px 6px" },
  tabOD: { fontSize: 10 },

  scroll: { flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" },

  addApplicantBtn: { width: "100%", background: "#1A2A4A", border: "1px dashed #2A3F6A", color: "#60A5FA", borderRadius: 8, padding: "12px", fontSize: 15, fontWeight: 700, cursor: "pointer", letterSpacing: 1 },

  appCard: { margin: "5px 12px", background: "#0D1526", borderRadius: 10, border: "1px solid #1A2540", overflow: "hidden" },
  appRow: { display: "flex", alignItems: "center", padding: "12px 14px", cursor: "pointer", justifyContent: "space-between" },
  appLeft: { display: "flex", alignItems: "center", gap: 10, flex: 1 },
  chevron: { color: "#3B82F6", fontSize: 16, width: 16, flexShrink: 0 },
  applicantName: { fontSize: 16, fontWeight: 700 },
  appMeta: { fontSize: 12, marginTop: 2 },
  archiveIconBtn: { background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#4B6080", padding: "4px 6px", flexShrink: 0 },

  archivedCard: { margin: "5px 12px", background: "#0D1526", borderRadius: 10, border: "1px solid #1A2540", padding: "12px 14px" },
  archivedTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  archivedMeta: { fontSize: 12, color: "#4B6080", marginTop: 3 },
  archivedDetails: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 },
  chip: { background: "#1A2540", color: "#94A3B8", fontSize: 12, padding: "2px 8px", borderRadius: 12 },
  restoreBtn: { background: "#1A3A2A", color: "#34D399", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  trashBtn: { background: "#2A1A1A", color: "#EF4444", border: "none", borderRadius: 6, padding: "5px 8px", fontSize: 14, cursor: "pointer" },

  empty: { textAlign: "center", color: "#2A3F6A", padding: "60px 20px", fontSize: 16, lineHeight: 1.9 },

  topBar: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "#0D1526", borderBottom: "1px solid #1A2540", flexShrink: 0 },
  topTitle: { fontSize: 17, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" },
  backBtn: { background: "none", border: "none", color: "#60A5FA", fontSize: 16, cursor: "pointer" },
  sectionHead: { padding: "14px 16px 6px", fontSize: 11, color: "#4B6080", letterSpacing: 2, textTransform: "uppercase", fontWeight: 700 },
  settingsRow: { display: "flex", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid #1A2540", gap: 10 },
  settingsNum: { color: "#2A3F6A", fontSize: 13, fontWeight: 700, width: 20 },
  inlineIn: { flex: 1, background: "#1A2540", border: "1px solid #3B82F6", borderRadius: 6, color: "#F1F5F9", fontSize: 15, padding: "6px 10px", outline: "none", fontFamily: font },
  subCount: { color: "#4B6080", fontSize: 12 },
  exportBtn: { width: "100%", background: "#1A2540", color: "#60A5FA", border: "1px solid #2A3F6A", borderRadius: 8, padding: "14px", fontSize: 15, fontWeight: 700, cursor: "pointer", letterSpacing: 1 },
};

const D = {
  wrap: { borderTop: "1px solid #1A2540", padding: "4px 0 10px" },
  row: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", borderBottom: "1px solid #0D1526" },
  label: { fontSize: 12, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700, flex: 1, paddingRight: 10 },
  input: { background: "#1A2540", border: "1px solid #2A3F6A", borderRadius: 6, color: "#F1F5F9", fontSize: 15, padding: "6px 10px", width: 180, outline: "none", fontFamily: font, boxSizing: "border-box" },
  readOnly: { color: "#94A3B8", fontSize: 15 },
};

const AF = {
  card: { background: "#0D1526", border: "1px solid #2A3F6A", borderRadius: 10, padding: "14px" },
  title: { fontSize: 13, color: "#4B6080", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700, marginBottom: 10 },
  input: { width: "100%", background: "#1A2540", border: "1px solid #2A3F6A", borderRadius: 6, color: "#F1F5F9", fontSize: 15, padding: "9px 12px", marginBottom: 8, outline: "none", fontFamily: font, boxSizing: "border-box" },
  save: { flex: 1, background: "#1E40AF", color: "#fff", border: "none", borderRadius: 6, padding: "10px", fontSize: 15, fontWeight: 700, cursor: "pointer" },
  cancel: { flex: 1, background: "#1A2540", color: "#94A3B8", border: "none", borderRadius: 6, padding: "10px", fontSize: 15, fontWeight: 700, cursor: "pointer" },
};
