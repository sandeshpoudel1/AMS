@extends('layouts.app')
@section('title', 'Admin Dashboard')
@section('content')
<div class="topbar">
    <div>
        <h1>Admin Dashboard</h1>
        <div class="muted">Operational overview across recruitment, training, and finance.</div>
    </div>
    <button class="btn btn-brand">Generate Summary</button>
</div>

<div class="grid grid-3" style="margin-bottom: 16px;">
    <div class="kpi"><div class="label">Candidates</div><div class="value">3,204</div></div>
    <div class="kpi"><div class="label">Active Trainings</div><div class="value">18</div></div>
    <div class="kpi"><div class="label">Monthly Revenue</div><div class="value">$84K</div></div>
</div>

<div class="grid grid-2">
    <section class="card">
        <h2 class="section-title">Pipeline Health</h2>
        <p class="muted">Shortlisted candidates grew by 11% this week.</p>
        <table>
            <tr><th>Stage</th><th>Count</th><th>Status</th></tr>
            <tr><td>Applied</td><td>521</td><td><span class="chip">Healthy</span></td></tr>
            <tr><td>Interview</td><td>212</td><td><span class="chip">Healthy</span></td></tr>
            <tr><td>Offer</td><td>84</td><td><span class="chip warn">Needs review</span></td></tr>
        </table>
    </section>
    <section class="card">
        <h2 class="section-title">Today Actions</h2>
        <ul style="margin: 0; padding-left: 18px; line-height: 1.9;">
            <li>Approve pending payroll for June cycle.</li>
            <li>Finalize 3 deployment confirmations.</li>
            <li>Review training completion certificates.</li>
            <li>Export finance daybook weekly report.</li>
        </ul>
    </section>
</div>
@endsection
