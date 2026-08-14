<div class="topbar">
    <div>
        <h1>{{ $title }}</h1>
        <div class="muted">{{ $subtitle }}</div>
    </div>
    <div class="toolbar">
        <button class="btn btn-ghost">Edit</button>
        <button class="btn btn-accent">Print</button>
    </div>
</div>

<div class="grid grid-2">
    <section class="card">
        <h2 class="section-title">Overview</h2>
        <p><strong>ID:</strong> MOPL-DETAIL-001</p>
        <p><strong>Status:</strong> <span class="chip">Active</span></p>
        <p><strong>Created:</strong> 2026-06-25</p>
        <p><strong>Owner:</strong> Admin User</p>
    </section>
    <section class="card">
        <h2 class="section-title">Timeline</h2>
        <p>Submitted -> Reviewed -> Approved</p>
        <p class="muted">Latest update happened 2 hours ago.</p>
    </section>
</div>

<section class="card" style="margin-top: 16px;">
    <h2 class="section-title">Notes</h2>
    <p class="muted">This page is ready for dynamic data binding from controller methods.</p>
</section>
