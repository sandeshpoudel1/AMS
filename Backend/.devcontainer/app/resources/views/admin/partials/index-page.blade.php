<div class="topbar">
    <div>
        <h1>{{ $title }}</h1>
        <div class="muted">{{ $subtitle }}</div>
    </div>
    <div class="toolbar">
        <button class="btn btn-brand">Export</button>
        <button class="btn btn-accent">Add New</button>
    </div>
</div>

<div class="card">
    <div class="toolbar">
        <input type="text" placeholder="Search {{ strtolower($title) }}..." style="max-width: 260px;">
        <select style="max-width: 220px;">
            <option>All Statuses</option>
            <option>Active</option>
            <option>Pending</option>
            <option>Archived</option>
        </select>
        <button class="btn btn-ghost">Apply Filters</button>
    </div>
    <table>
        <thead>
        <tr>
            <th>#</th>
            <th>Name</th>
            <th>Category</th>
            <th>Status</th>
            <th>Updated</th>
            <th>Action</th>
        </tr>
        </thead>
        <tbody>
        <tr>
            <td>001</td>
            <td>Sample Record A</td>
            <td>{{ $title }}</td>
            <td><span class="chip">Active</span></td>
            <td>Today</td>
            <td><button class="btn btn-ghost">View</button></td>
        </tr>
        <tr>
            <td>002</td>
            <td>Sample Record B</td>
            <td>{{ $title }}</td>
            <td><span class="chip warn">Pending</span></td>
            <td>Yesterday</td>
            <td><button class="btn btn-ghost">Edit</button></td>
        </tr>
        </tbody>
    </table>
</div>
