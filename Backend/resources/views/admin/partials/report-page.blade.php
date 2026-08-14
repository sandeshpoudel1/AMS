<div class="topbar">
    <div>
        <h1>{{ $title }}</h1>
        <div class="muted">{{ $subtitle }}</div>
    </div>
    <div class="toolbar">
        <button class="btn btn-brand">Export PDF</button>
        <button class="btn btn-accent">Export CSV</button>
    </div>
</div>

<div class="grid grid-3" style="margin-bottom: 16px;">
    <div class="kpi">
        <div class="label">Total</div>
        <div class="value">1,248</div>
    </div>
    <div class="kpi">
        <div class="label">This Month</div>
        <div class="value">182</div>
    </div>
    <div class="kpi">
        <div class="label">Completion Rate</div>
        <div class="value">92%</div>
    </div>
</div>

<div class="card">
    <h2 class="section-title">Trend Snapshot</h2>
    <div style="height: 220px; border-radius: 12px; border: 1px dashed var(--line); display: grid; place-items: center; color: var(--muted);">
        Chart placeholder for {{ $title }}
    </div>
</div>
