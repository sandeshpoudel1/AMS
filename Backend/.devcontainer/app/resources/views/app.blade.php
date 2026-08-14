<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">

<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>{{ config('app.name', 'MORMS') }} - @yield('title')</title>

    <!-- Bootstrap 5 CSS -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <!-- Font Awesome 6 -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <!-- Chart.js -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <!-- DataTables -->
    <link rel="stylesheet" href="https://cdn.datatables.net/1.13.6/css/dataTables.bootstrap5.min.css">

    <!-- Custom CSS -->
    <link rel="stylesheet" href="{{ asset('css/app.css') }}">
    @stack('styles')
</head>

<body>
    <div class="d-flex" id="wrapper">
        <!-- Sidebar -->
        <div class="bg-dark text-white" id="sidebar-wrapper" style="min-width: 250px;">
            <div class="sidebar-heading text-center py-4 primary-text fs-4 fw-bold text-uppercase border-bottom">
                <i class="fas fa-globe-asia me-2"></i>MORMS
            </div>
            <div class="list-group list-group-flush my-3">
                <a href="{{ route('admin.dashboard') }}"
                    class="list-group-item list-group-item-action bg-transparent text-white">
                    <i class="fas fa-tachometer-alt me-2"></i>Dashboard
                </a>
                <a href="{{ route('admin.candidates.index') }}"
                    class="list-group-item list-group-item-action bg-transparent text-white">
                    <i class="fas fa-users me-2"></i>Candidates
                </a>
                <a href="#" class="list-group-item list-group-item-action bg-transparent text-white"
                    data-bs-toggle="collapse" data-bs-target="#trainingMenu">
                    <i class="fas fa-chalkboard-teacher me-2"></i>Training <i
                        class="fas fa-chevron-down float-end mt-1"></i>
                </a>
                <div class="collapse" id="trainingMenu">
                    <a href="{{ route('admin.training.programs.index') }}"
                        class="list-group-item list-group-item-action bg-transparent text-white ps-5">
                        <i class="fas fa-book me-2"></i>Programs
                    </a>
                    <a href="{{ route('admin.training.registrations.index') }}"
                        class="list-group-item list-group-item-action bg-transparent text-white ps-5">
                        <i class="fas fa-user-graduate me-2"></i>Registrations
                    </a>
                </div>
                <a href="{{ route('admin.assessments.index') }}"
                    class="list-group-item list-group-item-action bg-transparent text-white">
                    <i class="fas fa-clipboard-check me-2"></i>Assessments
                </a>
                <a href="{{ route('admin.certificates.index') }}"
                    class="list-group-item list-group-item-action bg-transparent text-white">
                    <i class="fas fa-certificate me-2"></i>Certificates
                </a>
                <a href="{{ route('admin.deployments.index') }}"
                    class="list-group-item list-group-item-action bg-transparent text-white">
                    <i class="fas fa-plane-departure me-2"></i>Deployments
                </a>
                <a href="#" class="list-group-item list-group-item-action bg-transparent text-white"
                    data-bs-toggle="collapse" data-bs-target="#financeMenu">
                    <i class="fas fa-coins me-2"></i>Finance <i class="fas fa-chevron-down float-end mt-1"></i>
                </a>
                <div class="collapse" id="financeMenu">
                    <a href="{{ route('admin.finance.daybook.index') }}"
                        class="list-group-item list-group-item-action bg-transparent text-white ps-5">
                        <i class="fas fa-book me-2"></i>Daybook
                    </a>
                </div>
                <a href="#" class="list-group-item list-group-item-action bg-transparent text-white"
                    data-bs-toggle="collapse" data-bs-target="#hrMenu">
                    <i class="fas fa-user-tie me-2"></i>HR <i class="fas fa-chevron-down float-end mt-1"></i>
                </a>
                <div class="collapse" id="hrMenu">
                    <a href="{{ route('admin.hr.staff.index') }}"
                        class="list-group-item list-group-item-action bg-transparent text-white ps-5">
                        <i class="fas fa-id-badge me-2"></i>Staff
                    </a>
                    <a href="{{ route('admin.hr.payroll.index') }}"
                        class="list-group-item list-group-item-action bg-transparent text-white ps-5">
                        <i class="fas fa-wallet me-2"></i>Payroll
                    </a>
                </div>
                <a href="{{ route('admin.reports.index') }}"
                    class="list-group-item list-group-item-action bg-transparent text-white">
                    <i class="fas fa-chart-bar me-2"></i>Reports
                </a>
            </div>
        </div>

        <!-- Page Content -->
        <div id="page-content-wrapper" class="w-100">
            <nav class="navbar navbar-expand-lg navbar-light bg-light border-bottom">
                <div class="container-fluid">
                    <button class="btn btn-primary" id="menu-toggle">
                        <i class="fas fa-bars"></i>
                    </button>
                    <div class="ms-auto">
                        <span class="me-3">
                            <i class="fas fa-user-circle"></i> {{ auth()->user()->name }}
                            <small class="text-muted">({{ auth()->user()->role->name ?? 'User' }})</small>
                        </span>
                        <form action="{{ route('logout') }}" method="POST" class="d-inline">
                            @csrf
                            <button type="submit" class="btn btn-outline-danger btn-sm">
                                <i class="fas fa-sign-out-alt"></i> Logout
                            </button>
                        </form>
                    </div>
                </div>
            </nav>

            <div class="container-fluid px-4 py-4">
                @if(session('success'))
                    <div class="alert alert-success alert-dismissible fade show" role="alert">
                        {{ session('success') }}
                        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                    </div>
                @endif

                @if(session('error'))
                    <div class="alert alert-danger alert-dismissible fade show" role="alert">
                        {{ session('error') }}
                        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                    </div>
                @endif

                @yield('content')
            </div>
        </div>
    </div>

    <!-- Bootstrap 5 JS -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <!-- jQuery -->
    <script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
    <!-- DataTables -->
    <script src="https://cdn.datatables.net/1.13.6/js/jquery.dataTables.min.js"></script>
    <script src="https://cdn.datatables.net/1.13.6/js/dataTables.bootstrap5.min.js"></script>

    <!-- Custom JS -->
    <script>
        // Toggle sidebar
        document.getElementById("menu-toggle").addEventListener("click", function (e) {
            e.preventDefault();
            document.getElementById("wrapper").classList.toggle("toggled");
        });

        // Initialize DataTables
        $(document).ready(function () {
            $('.datatable').DataTable({
                responsive: true,
                lengthMenu: [[10, 25, 50, -1], [10, 25, 50, "All"]],
                pageLength: 25
            });
        });
    </script>
    @stack('scripts')
</body>

</html>