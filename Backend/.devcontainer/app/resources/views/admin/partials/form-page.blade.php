<div class="topbar">
    <div>
        <h1>{{ $title }}</h1>
        <div class="muted">{{ $subtitle }}</div>
    </div>
    <button class="btn btn-ghost">Back</button>
</div>

<div class="card">
    <h2 class="section-title">{{ $mode }} Form</h2>
    <div class="grid grid-2" style="margin-top: 12px;">
        <div>
            <label>Name</label>
            <input type="text" placeholder="Enter name">
        </div>
        <div>
            <label>Status</label>
            <select>
                <option>Active</option>
                <option>Pending</option>
                <option>Inactive</option>
            </select>
        </div>
        <div>
            <label>Start Date</label>
            <input type="date">
        </div>
        <div>
            <label>Reference ID</label>
            <input type="text" placeholder="MOPL-0001">
        </div>
        <div style="grid-column: 1 / -1;">
            <label>Description</label>
            <textarea rows="5" placeholder="Add notes or details..."></textarea>
        </div>
    </div>
    <div class="toolbar" style="margin-top: 16px;">
        <button class="btn btn-brand">Save</button>
        <button class="btn btn-ghost">Save as Draft</button>
        <button class="btn btn-accent">Submit</button>
    </div>
</div>
