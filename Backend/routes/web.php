<?php

use App\Http\Controllers\Admin\CompanyController;
use App\Http\Controllers\Admin\PayrollController;
use App\Http\Controllers\Admin\ReportController;
use App\Http\Controllers\Admin\SalaryAdvanceController;
use App\Http\Controllers\Api\AuthController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return response()->json([
        'success' => true,
        'message' => 'MOPL backend is running.',
        'source' => 'Backend/.devcontainer/app',
    ]);
})->name('home');

Route::post('/login', [AuthController::class, 'login'])->name('login');
Route::post('/logout', [AuthController::class, 'logout'])->name('logout');

Route::prefix('admin')->middleware(['auth'])->group(function () {
    Route::get('/', function () {
        return view('admin.dashboard');
    })->name('admin.dashboard');

    Route::resource('companies', CompanyController::class);

    Route::resource('hr/payroll', PayrollController::class);
    Route::post('hr/payroll/process', [PayrollController::class, 'processPayroll'])
        ->name('admin.hr.payroll.process');

    Route::resource('hr/advances', SalaryAdvanceController::class);
    Route::post('hr/advances/{advance}/approve', [SalaryAdvanceController::class, 'approve'])
        ->name('admin.hr.advances.approve');

    Route::prefix('reports')->group(function () {
        Route::get('/', [ReportController::class, 'index'])->name('admin.reports.index');
        Route::get('candidates', [ReportController::class, 'candidateReport'])->name('admin.reports.candidates');
        Route::get('training', [ReportController::class, 'trainingReport'])->name('admin.reports.training');
        Route::get('financial', [ReportController::class, 'financialReport'])->name('admin.reports.financial');
        Route::get('deployment', [ReportController::class, 'deploymentReport'])->name('admin.reports.deployment');
        Route::get('payroll', [ReportController::class, 'payrollReport'])->name('admin.reports.payroll');
        Route::get('export/{type}', [ReportController::class, 'export'])->name('admin.reports.export');
    });
});
