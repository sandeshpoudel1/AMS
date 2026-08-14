<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\AgencyController;
use App\Http\Controllers\Api\AppSettingController;
use App\Http\Controllers\Api\BdSourceController;
use App\Http\Controllers\Api\CandidateController;
use App\Http\Controllers\Api\CandidateDeploymentController;
use App\Http\Controllers\Api\DaybookController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\FinanceController;
use App\Http\Controllers\Api\ExpenseHeadController;
use App\Http\Controllers\Api\PayrollController;
use App\Http\Controllers\Api\ProjectSettingController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\ReferenceController;
use App\Http\Controllers\Api\ReferenceSourceController;
use App\Http\Controllers\Api\SalaryController;
use App\Http\Controllers\Api\StaffController;
use App\Http\Controllers\Api\SubHeadCandidateChargeController;
use App\Http\Controllers\Api\TrainingController;
use App\Http\Controllers\Api\TrainingCompanyController;
use App\Http\Controllers\Api\UserController;
use Illuminate\Support\Facades\Route;

// Public routes
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);
Route::post('/login/2fa/verify', [AuthController::class, 'verifyLoginTwoFactor']);
Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
Route::post('/reset-password', [AuthController::class, 'resetPassword']);

// Protected routes
Route::middleware('auth:sanctum')->group(function () {
    // Auth routes
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user', [AuthController::class, 'user']);
    Route::post('/refresh-token', [AuthController::class, 'refreshToken']);
    Route::post('/change-password', [AuthController::class, 'changePassword']);
    Route::post('/2fa/setup', [AuthController::class, 'setupTwoFactor']);
    Route::post('/2fa/setup/verify', [AuthController::class, 'verifyTwoFactorSetup']);
    Route::post('/2fa/disable', [AuthController::class, 'disableTwoFactor']);

    // User management (Admin only, guarded in controller)
    Route::get('/users', [UserController::class, 'index']);
    Route::get('/users/{id}', [UserController::class, 'show']);
    Route::post('/users', [UserController::class, 'store']);
    Route::put('/users/{id}', [UserController::class, 'update']);
    Route::delete('/users/{id}', [UserController::class, 'destroy']);
    Route::post('/users/{id}/activate', [UserController::class, 'activate']);
    Route::post('/users/{id}/deactivate', [UserController::class, 'deactivate']);
    Route::post('/users/{id}/change-role', [UserController::class, 'changeRole']);

    // Staff management
    Route::get('/staff', [StaffController::class, 'index']);
    Route::post('/staff', [StaffController::class, 'store']);
    Route::get('/staff/{staff}', [StaffController::class, 'show']);
    Route::put('/staff/{staff}', [StaffController::class, 'update']);
    Route::delete('/staff/{staff}', [StaffController::class, 'destroy']);

    // Agency management (Settings)
    Route::get('/agencies', [AgencyController::class, 'index']);
    Route::post('/agencies', [AgencyController::class, 'store']);
    Route::put('/agencies/{id}', [AgencyController::class, 'update']);
    Route::delete('/agencies/{id}', [AgencyController::class, 'destroy']);
    Route::get('/reference-sources', [ReferenceSourceController::class, 'index']);
    Route::post('/reference-sources', [ReferenceSourceController::class, 'store']);
    Route::put('/reference-sources/{id}', [ReferenceSourceController::class, 'update']);
    Route::delete('/reference-sources/{id}', [ReferenceSourceController::class, 'destroy']);
    Route::get('/bd-sources', [BdSourceController::class, 'index']);
    Route::post('/bd-sources', [BdSourceController::class, 'store']);
    Route::put('/bd-sources/{id}', [BdSourceController::class, 'update']);
    Route::delete('/bd-sources/{id}', [BdSourceController::class, 'destroy']);

    // Salary management
    Route::get('/salary/all', [SalaryController::class, 'getAllStaffSalary']);
    Route::get('/salary/{staff}', [SalaryController::class, 'getStaffSalaryDetails']);
    Route::post('/salary/{staff}/set', [SalaryController::class, 'setSalary']);
    Route::post('/salary/{staff}/bonus', [SalaryController::class, 'addBonus']);
    Route::post('/salary/advance', [SalaryController::class, 'giveAdvance']);
    Route::put('/salary/advance/{salaryAdvance}/repay', [SalaryController::class, 'repayAdvance']);

    // Candidate management
    Route::get('/candidates', [CandidateController::class, 'index']);
    Route::post('/candidates', [CandidateController::class, 'store']);
    Route::post('/candidates/import', [CandidateController::class, 'import']);
    Route::get('/candidates/export', [CandidateController::class, 'export']);
    Route::get('/candidates/{id}', [CandidateController::class, 'show']);
    Route::get('/candidates/{id}/payment-bookings', [CandidateController::class, 'paymentBookings']);
    Route::get('/payment-bookings', [CandidateController::class, 'paymentBookings']);
    Route::put('/candidates/{id}', [CandidateController::class, 'update']);
    Route::delete('/candidates/{id}', [CandidateController::class, 'destroy']);
    Route::post('/candidates/{id}/activate', [CandidateController::class, 'activate']);
    Route::post('/candidates/{id}/deactivate', [CandidateController::class, 'deactivate']);
    Route::post('/candidates/{id}/status', [CandidateController::class, 'changeStatus']);
    Route::post('/candidates/{id}/login-account', [CandidateController::class, 'createLoginAccount']);
    Route::get('/candidates/{id}/timeline', [CandidateController::class, 'timeline']);
    Route::get('/candidates/{id}/documents', [CandidateController::class, 'documents']);
    Route::post('/candidates/{id}/documents', [CandidateController::class, 'uploadDocument']);
    Route::post('/candidate-documents/batch-download', [CandidateController::class, 'batchDownloadDocuments']);
    Route::get('/candidate-documents/{documentId}/download', [CandidateController::class, 'downloadDocument']);
    Route::put('/candidate-documents/{documentId}/title', [CandidateController::class, 'updateDocumentTitle']);
    Route::delete('/candidate-documents/{documentId}', [CandidateController::class, 'deleteDocument']);

    // Candidate references
    Route::get('/candidates/{id}/references', [ReferenceController::class, 'index']);
    Route::post('/candidates/{id}/references', [ReferenceController::class, 'store']);
    Route::put('/references/{id}', [ReferenceController::class, 'update']);
    Route::delete('/references/{id}', [ReferenceController::class, 'destroy']);

    // Candidate deployments
    Route::get('/candidates/{id}/deployments', [CandidateDeploymentController::class, 'index']);
    Route::post('/candidates/{id}/deployments', [CandidateDeploymentController::class, 'store']);
    Route::put('/deployments/{id}', [CandidateDeploymentController::class, 'update']);
    Route::delete('/deployments/{id}', [CandidateDeploymentController::class, 'destroy']);

    // Finance management
    Route::get('/finance/candidates', [FinanceController::class, 'index']);
    Route::put('/finance/candidates/{id}/payment', [FinanceController::class, 'updatePayment']);
    Route::get('/finance/training-enrollments', [FinanceController::class, 'listTrainingEnrollments']);
    Route::put('/finance/training-enrollments/{id}/payment', [FinanceController::class, 'updateTrainingPayment']);
    Route::get('/finance/payment-statistics', [FinanceController::class, 'paymentStatistics']);

    // Daybook management
    Route::get('/daybook', [DaybookController::class, 'index']);
    Route::post('/daybook', [DaybookController::class, 'store']);
    Route::get('/daybook/{id}', [DaybookController::class, 'show']);
    Route::put('/daybook/{id}', [DaybookController::class, 'update']);
    Route::delete('/daybook/{id}', [DaybookController::class, 'destroy']);
    Route::get('/daybook/summary', [DaybookController::class, 'summary']);
    // Daybook approval and settings
    Route::get('/daybook/settings', [DaybookController::class, 'getSettings']);
    Route::post('/daybook/settings', [DaybookController::class, 'setSettings']);
    Route::post('/daybook/{id}/approve', [DaybookController::class, 'approve']);
    Route::post('/daybook/{id}/reject', [DaybookController::class, 'reject']);

    // Expense head management (Settings)
    Route::get('/expense-heads', [ExpenseHeadController::class, 'index']);
    Route::post('/expense-heads', [ExpenseHeadController::class, 'store']);
    Route::put('/expense-heads/{id}', [ExpenseHeadController::class, 'update']);
    Route::delete('/expense-heads/{id}', [ExpenseHeadController::class, 'destroy']);
    Route::get('/sub-head-candidate-charges', [SubHeadCandidateChargeController::class, 'index']);
    Route::post('/sub-head-candidate-charges', [SubHeadCandidateChargeController::class, 'store']);
    Route::put('/sub-head-candidate-charges/{id}', [SubHeadCandidateChargeController::class, 'update']);
    Route::delete('/sub-head-candidate-charges/{id}', [SubHeadCandidateChargeController::class, 'destroy']);
    Route::get('/project-settings', [ProjectSettingController::class, 'index']);
    Route::post('/project-settings', [ProjectSettingController::class, 'store']);
    Route::put('/project-settings/{id}', [ProjectSettingController::class, 'update']);
    Route::delete('/project-settings/{id}', [ProjectSettingController::class, 'destroy']);
    Route::get('/settings/status-templates', [AppSettingController::class, 'getStatusTemplates']);
    Route::post('/settings/status-templates', [AppSettingController::class, 'saveStatusTemplates']);

    // Payroll management
    Route::get('/payroll', [PayrollController::class, 'index']);
    Route::post('/payroll', [PayrollController::class, 'store']);
    Route::get('/payroll/{payroll}', [PayrollController::class, 'show']);
    Route::put('/payroll/{payroll}', [PayrollController::class, 'update']);
    Route::put('/payroll/{payroll}/payment', [PayrollController::class, 'updatePayment']);
    Route::delete('/payroll/{payroll}', [PayrollController::class, 'destroy']);

    // Reports
    Route::get('/reports/overall', [ReportController::class, 'overall']);

    // Training management
    Route::get('/training-enrollments', [TrainingController::class, 'listEnrollments']);
    Route::post('/training-enrollments', [TrainingController::class, 'enrollTraining']);
    Route::get('/training-enrollments/{id}', [TrainingController::class, 'getEnrollmentDetail']);
    Route::put('/training-enrollments/{id}', [TrainingController::class, 'updateEnrollment']);
    Route::put('/training-enrollments/{id}/payment', [TrainingController::class, 'updateEnrollmentPayment']);
    Route::delete('/training-enrollments/{id}', [TrainingController::class, 'destroyEnrollment']);
    Route::post('/training-enrollments/{id}/certification', [TrainingController::class, 'saveCertification']);
    Route::get('/trainings', [TrainingController::class, 'getTrainings']);
    Route::post('/trainings', [TrainingController::class, 'storeTraining']);
    Route::put('/trainings/{id}', [TrainingController::class, 'updateTraining']);
    Route::delete('/trainings/{id}', [TrainingController::class, 'destroyTraining']);
    Route::get('/candidates/{id}/trainings', [TrainingController::class, 'getCandidateTrainings']);
    Route::get('/training-statistics', [TrainingController::class, 'getTrainingStatistics']);

    // Training companies
    Route::get('/training-companies', [TrainingCompanyController::class, 'index']);
    Route::post('/training-companies', [TrainingCompanyController::class, 'store']);
    Route::put('/training-companies/{id}', [TrainingCompanyController::class, 'update']);
    Route::delete('/training-companies/{id}', [TrainingCompanyController::class, 'destroy']);

    // Training assessments & certification
    Route::get('/training-assessments', [TrainingController::class, 'listAssessments']);
    Route::post('/training-assessments', [TrainingController::class, 'storeAssessment']);
    Route::put('/training-assessments/{id}', [TrainingController::class, 'updateAssessment']);
    Route::delete('/training-assessments/{id}', [TrainingController::class, 'destroyAssessment']);

    // Candidate Flown (new routes) — keep existing visa-pipeline routes for backwards compatibility
    Route::get('/candidates/{id}/candidate-flown', [\App\Http\Controllers\Api\CandidateFlownController::class, 'candidateIndex']);
    Route::get('/candidate-flown', [\App\Http\Controllers\Api\CandidateFlownController::class, 'index']);
    Route::get('/candidate-flown/export', [\App\Http\Controllers\Api\CandidateFlownController::class, 'export']);
    Route::post('/candidate-flown', [\App\Http\Controllers\Api\CandidateFlownController::class, 'store']);
    Route::put('/candidate-flown/{id}', [\App\Http\Controllers\Api\CandidateFlownController::class, 'update']);
    Route::delete('/candidate-flown/{id}', [\App\Http\Controllers\Api\CandidateFlownController::class, 'destroy']);

    // Backwards-compatible visa-pipeline routes (alias to CandidateFlownController)
    Route::get('/candidates/{id}/visa-pipeline', [\App\Http\Controllers\Api\CandidateFlownController::class, 'candidateIndex']);
    Route::get('/visa-pipeline', [\App\Http\Controllers\Api\CandidateFlownController::class, 'index']);
    Route::get('/visa-pipeline/export', [\App\Http\Controllers\Api\CandidateFlownController::class, 'export']);
    Route::post('/visa-pipeline', [\App\Http\Controllers\Api\CandidateFlownController::class, 'store']);
    Route::put('/visa-pipeline/{id}', [\App\Http\Controllers\Api\CandidateFlownController::class, 'update']);
    Route::delete('/visa-pipeline/{id}', [\App\Http\Controllers\Api\CandidateFlownController::class, 'destroy']);

    // Dashboard
    Route::get('/dashboard/stats', [DashboardController::class, 'stats']);
    Route::get('/dashboard/activities', [DashboardController::class, 'activities']);
    Route::get('/dashboard/candidate-status', [DashboardController::class, 'candidateStatus']);
    Route::get('/dashboard/monthly-trends', [DashboardController::class, 'monthlyTrends']);
    Route::get('/dashboard/top-performers', [DashboardController::class, 'topPerformers']);
    Route::get('/dashboard/health', [DashboardController::class, 'health']);
});
