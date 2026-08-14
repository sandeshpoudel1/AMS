@extends('layouts.app')
@section('title', 'Login | MOPL')
@section('content')
<div class="topbar">
    <div>
        <h1>Welcome Back</h1>
        <div class="muted">Sign in to access the MOPL management console.</div>
    </div>
</div>

<div class="card" style="max-width: 560px;">
    <h2 class="section-title">Account Login</h2>
    <div class="grid" style="margin-top: 12px; gap: 12px;">
        <div>
            <label>Email</label>
            <input type="email" placeholder="you@company.com">
        </div>
        <div>
            <label>Password</label>
            <input type="password" placeholder="Enter password">
        </div>
        <div class="toolbar" style="justify-content: space-between; align-items: center;">
            <label><input type="checkbox" style="width: auto;"> Remember me</label>
            <a href="#" class="muted">Forgot password?</a>
        </div>
        <button class="btn btn-brand">Sign In</button>
    </div>
</div>
@endsection
