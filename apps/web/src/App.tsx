const metrics = [
  { label: "Global cash position", value: "$0.00", note: "Connect demo accounts to populate" },
  { label: "Available liquidity", value: "$0.00", note: "Across configured entities" },
  { label: "Open exceptions", value: "0", note: "Reconciliation and control alerts" },
  { label: "Forecast horizon", value: "90 days", note: "Scenario-ready planning window" }
];

export default function App() {
  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">L</span><span>Lumen<span className="muted">Treasury</span></span></div>
        <p className="nav-label">WORKSPACE</p>
        <a className="nav-item active">Overview</a>
        <a className="nav-item">Cash positions</a>
        <a className="nav-item">Bank accounts</a>
        <a className="nav-item">Transactions</a>
        <a className="nav-item">Forecasts</a>
        <a className="nav-item">Risk & exposure</a>
        <a className="nav-item">Approvals</a>
        <div className="sidebar-footer">DEMO ENVIRONMENT<br/><span>Sample data only · no live banking</span></div>
      </aside>
      <section className="content">
        <header className="topbar"><div><p className="eyebrow">TREASURY WORKSPACE / OVERVIEW</p><h1>Good morning, Treasury Team</h1><p className="subheading">A consolidated view of liquidity, controls and financial activity.</p></div><div className="profile">TT</div></header>
        <section className="notice"><strong>Workspace initialized</strong><span>Connect or import demo accounts to begin building your treasury position.</span></section>
        <section className="metrics">{metrics.map((item) => <article className="metric" key={item.label}><p>{item.label}</p><strong>{item.value}</strong><span>{item.note}</span></article>)}</section>
        <section className="panels"><article className="panel"><div className="panel-head"><div><p className="eyebrow">LIQUIDITY INTELLIGENCE</p><h2>Cash position trend</h2></div><span className="pill">Demo pending</span></div><div className="empty-chart"><div className="chart-line"></div><span>Import transactions to visualize cash movement</span></div></article><article className="panel"><p className="eyebrow">CONTROL CENTER</p><h2>Priority actions</h2><div className="empty-state">No outstanding actions. Treasury controls will appear here.</div></article></section>
        <footer> LumenTreasury · Early development · Financial decisions require authorized human review.</footer>
      </section>
    </main>
  );
}