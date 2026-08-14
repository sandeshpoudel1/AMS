<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>@yield('title', 'MOPL Admin')</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg: #f3f4ee;
            --bg-2: #e8ebdb;
            --card: #ffffff;
            --ink: #1f2a24;
            --muted: #58675e;
            --line: #d9ddce;
            --brand: #0f766e;
            --brand-2: #f97316;
            --ok: #166534;
            --warn: #9a3412;
            --radius: 16px;
            --shadow: 0 12px 30px rgba(26, 42, 35, 0.08);
        }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            color: var(--ink);
            font-family: 'IBM Plex Sans', sans-serif;
            background:
                radial-gradient(800px 400px at 8% -10%, rgba(15, 118, 110, 0.18), transparent 60%),
                radial-gradient(900px 500px at 95% -20%, rgba(249, 115, 22, 0.14), transparent 55%),
                linear-gradient(180deg, var(--bg), var(--bg-2));
            min-height: 100vh;
        }
        .shell {
            display: grid;
            grid-template-columns: 280px 1fr;
            min-height: 100vh;
        }
        .sidebar {
            border-right: 1px solid var(--line);
            background: rgba(255, 255, 255, 0.82);
            backdrop-filter: blur(6px);
            padding: 24px 18px;
            position: sticky;
            top: 0;
            height: 100vh;
            overflow-y: auto;
        }
        .brand {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 22px;
            font-family: 'Space Grotesk', sans-serif;
            font-weight: 700;
            letter-spacing: 0.3px;
        }
        .badge {
            width: 36px;
            height: 36px;
            border-radius: 12px;
            background: linear-gradient(135deg, var(--brand), #0ea5a1);
            color: #fff;
            display: grid;
            place-items: center;
            font-weight: 700;
        }
        .nav-title {
            margin: 18px 8px 8px;
            color: var(--muted);
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .nav a {
            text-decoration: none;
            display: block;
            padding: 9px 12px;
            margin: 4px 0;
            border-radius: 10px;
            color: var(--ink);
            transition: transform .15s ease, background-color .15s ease;
        }
        .nav a:hover {
            background: #e7f3f1;
            transform: translateX(3px);
        }
        .main { padding: 24px; }
        .topbar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }
        .topbar h1 {
            margin: 0;
            font-family: 'Space Grotesk', sans-serif;
            font-size: 26px;
        }
        .muted { color: var(--muted); }
        .card {
            background: var(--card);
            border: 1px solid var(--line);
            border-radius: var(--radius);
            box-shadow: var(--shadow);
            padding: 18px;
        }
        .grid { display: grid; gap: 16px; }
        .grid-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .grid-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .kpi {
            border: 1px solid var(--line);
            border-radius: 14px;
            padding: 14px;
            background: linear-gradient(180deg, #ffffff, #f8faf8);
        }
        .kpi .label { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .6px; }
        .kpi .value { font-family: 'Space Grotesk', sans-serif; font-size: 28px; margin-top: 6px; }
        .toolbar { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
        input, select, textarea {
            width: 100%;
            border: 1px solid var(--line);
            border-radius: 10px;
            padding: 10px 12px;
            background: #fff;
            font: inherit;
        }
        .btn {
            border: 0;
            border-radius: 10px;
            padding: 10px 14px;
            cursor: pointer;
            font-weight: 600;
        }
        .btn-brand { background: var(--brand); color: #fff; }
        .btn-accent { background: var(--brand-2); color: #fff; }
        .btn-ghost { background: #edf2ef; color: var(--ink); }
        table { width: 100%; border-collapse: collapse; }
        th, td { text-align: left; padding: 11px 9px; border-bottom: 1px solid var(--line); }
        th { color: var(--muted); font-weight: 600; font-size: 13px; }
        .chip {
            padding: 4px 8px;
            border-radius: 999px;
            font-size: 12px;
            background: #ecfdf5;
            color: var(--ok);
        }
        .chip.warn { background: #fff7ed; color: var(--warn); }
        .section-title {
            font-family: 'Space Grotesk', sans-serif;
            margin: 0 0 6px;
            font-size: 20px;
        }
        .reveal {
            animation: rise .35s ease;
        }
        @keyframes rise {
            from { opacity: 0; transform: translateY(6px); }
            to { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 1040px) {
            .shell { grid-template-columns: 1fr; }
            .sidebar { position: relative; height: auto; }
            .grid-3, .grid-2 { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
<div class="shell">
    <aside class="sidebar">
        <div class="brand">
            <div class="badge">M</div>
            <div>MOPL Control Hub</div>
        </div>
        <nav class="nav">
            <div class="nav-title">Core</div>
            <a href="{{ url('/admin') }}">Dashboard</a>
            <a href="{{ url('/admin/candidates') }}">Candidates</a>
            <a href="{{ url('/admin/assessments') }}">Assessments</a>
            <a href="{{ url('/admin/certificates') }}">Certificates</a>
            <a href="{{ url('/admin/deployments') }}">Deployments</a>

            <div class="nav-title">Training</div>
            <a href="{{ url('/admin/training/programs') }}">Programs</a>
            <a href="{{ url('/admin/training/registrations') }}">Registrations</a>

            <div class="nav-title">Operations</div>
            <a href="{{ url('/admin/companies') }}">Companies</a>
            <a href="{{ url('/admin/hr/staff') }}">HR Staff</a>
            <a href="{{ url('/admin/hr/payroll') }}">Payroll</a>
            <a href="{{ url('/admin/finance/daybook') }}">Daybook</a>
            <a href="{{ url('/admin/reports') }}">Reports</a>
        </nav>
    </aside>
    <main class="main reveal">
        @yield('content')
    </main>
</div>
</body>
</html>
