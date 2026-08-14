<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Certificate;
use App\Models\TrainingRegistration;
use App\Models\AuditLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Storage;

class CertificateController extends Controller
{
    public function index(Request $request)
    {
        $query = Certificate::with(['candidate', 'trainingRegistration.trainingProgram', 'issuer']);

        if ($request->has('status') && $request->status) {
            $query->where('status', $request->status);
        }

        if ($request->has('candidate_id') && $request->candidate_id) {
            $query->where('candidate_id', $request->candidate_id);
        }

        $certificates = $query->latest()->paginate(20);
        
        $registrations = TrainingRegistration::where('status', 'completed')
            ->whereDoesntHave('certificate')
            ->with(['candidate', 'trainingProgram'])
            ->get();

        return view('admin.certificates.index', compact('certificates', 'registrations'));
    }

    public function create()
    {
        $registrations = TrainingRegistration::where('status', 'completed')
            ->whereDoesntHave('certificate')
            ->with(['candidate', 'trainingProgram'])
            ->get();
        
        return view('admin.certificates.create', compact('registrations'));
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'training_registration_id' => 'required|exists:training_registrations,id',
            'issue_date' => 'required|date',
            'expiry_date' => 'nullable|date|after:issue_date',
            'remarks' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return redirect()->back()
                ->withErrors($validator)
                ->withInput();
        }

        $registration = TrainingRegistration::find($request->training_registration_id);
        
        // Check if certificate already exists
        if ($registration->certificate) {
            return redirect()->back()
                ->with('error', 'Certificate already exists for this training!')
                ->withInput();
        }

        // Generate certificate number and verification code
        $certificateNumber = 'MORMS-' . date('Y') . '-' . str_pad(Certificate::count() + 1, 6, '0', STR_PAD_LEFT);
        $verificationCode = strtoupper(Str::random(12));

        $certificate = Certificate::create([
            'candidate_id' => $registration->candidate_id,
            'training_registration_id' => $request->training_registration_id,
            'certificate_number' => $certificateNumber,
            'verification_code' => $verificationCode,
            'issue_date' => $request->issue_date,
            'expiry_date' => $request->expiry_date,
            'status' => 'active',
            'remarks' => $request->remarks,
            'issued_by' => Auth::id(),
        ]);

        // Update candidate status
        $candidate = $registration->candidate;
        if ($candidate->status === 'assessed') {
            $candidate->status = 'certified';
            $candidate->save();
        }

        // Generate PDF certificate (optional - will implement later)
        // $this->generateCertificatePDF($certificate);

        AuditLog::create([
            'user_id' => Auth::id(),
            'action' => 'generate_certificate',
            'module' => 'certificate',
            'auditable_id' => $certificate->id,
            'auditable_type' => Certificate::class,
            'new_values' => $certificate->toArray(),
        ]);

        return redirect()->route('admin.certificates.index')
            ->with('success', 'Certificate generated successfully! Verification Code: ' . $verificationCode);
    }

    public function show(Certificate $certificate)
    {
        $certificate->load(['candidate', 'trainingRegistration.trainingProgram', 'issuer']);
        return view('admin.certificates.show', compact('certificate'));
    }

    public function verify($verificationCode)
    {
        $certificate = Certificate::where('verification_code', $verificationCode)
            ->with(['candidate', 'trainingRegistration.trainingProgram'])
            ->first();

        if (!$certificate) {
            return response()->json([
                'valid' => false,
                'message' => 'Invalid certificate verification code.'
            ], 404);
        }

        return response()->json([
            'valid' => true,
            'certificate' => [
                'number' => $certificate->certificate_number,
                'candidate_name' => $certificate->candidate->full_name,
                'training_program' => $certificate->trainingRegistration->trainingProgram->name,
                'issue_date' => $certificate->issue_date,
                'status' => $certificate->status,
            ]
        ]);
    }

    public function revoke(Request $request, Certificate $certificate)
    {
        $request->validate([
            'reason' => 'required|string',
        ]);

        $oldStatus = $certificate->status;
        $certificate->status = 'revoked';
        $certificate->remarks = ($certificate->remarks ? $certificate->remarks . ' | ' : '') . 
            'Revoked: ' . $request->reason;
        $certificate->save();

        AuditLog::create([
            'user_id' => Auth::id(),
            'action' => 'revoke_certificate',
            'module' => 'certificate',
            'auditable_id' => $certificate->id,
            'auditable_type' => Certificate::class,
            'old_values' => ['status' => $oldStatus],
            'new_values' => ['status' => 'revoked'],
        ]);

        return redirect()->back()
            ->with('success', 'Certificate revoked successfully!');
    }

    public function download(Certificate $certificate)
    {
        // Implement PDF download logic
        // For now, we'll show a message
        return redirect()->back()
            ->with('info', 'PDF download feature coming soon!');
    }
}