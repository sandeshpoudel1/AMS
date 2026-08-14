<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Candidate;
use App\Models\TrainingProgram;
use App\Models\TrainingRegistration;
use App\Models\Daybook;
use App\Models\AuditLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;

class TrainingRegistrationController extends Controller
{
    public function index(Request $request)
    {
        $query = TrainingRegistration::with([
            'candidate', 
            'trainingProgram', 
            'creator'
        ]);

        if ($request->has('status') && $request->status) {
            $query->where('status', $request->status);
        }

        if ($request->has('candidate_id') && $request->candidate_id) {
            $query->where('candidate_id', $request->candidate_id);
        }

        if ($request->has('program_id') && $request->program_id) {
            $query->where('training_program_id', $request->program_id);
        }

        $registrations = $query->latest()->paginate(20);
        
        $candidates = Candidate::where('status', 'registered')
            ->orWhere('status', 'in_training')
            ->get();
            
        $programs = TrainingProgram::where('status', 'active')->get();

        return view('admin.training.registrations.index', compact('registrations', 'candidates', 'programs'));
    }

    public function create()
    {
        $candidates = Candidate::where('status', 'registered')
            ->orWhere('status', 'in_training')
            ->get();
        $programs = TrainingProgram::where('status', 'active')->get();
        
        return view('admin.training.registrations.create', compact('candidates', 'programs'));
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'candidate_id' => 'required|exists:candidates,id',
            'training_program_id' => 'required|exists:training_programs,id',
            'start_date' => 'required|date',
            'total_fee' => 'required|numeric|min:0',
            'discount_code' => 'nullable|string|max:50',
            'discount_amount' => 'nullable|numeric|min:0',
            'remarks' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return redirect()->back()
                ->withErrors($validator)
                ->withInput();
        }

        // Check if candidate is already registered for this program
        $existing = TrainingRegistration::where('candidate_id', $request->candidate_id)
            ->where('training_program_id', $request->training_program_id)
            ->whereIn('status', ['registered', 'ongoing'])
            ->first();

        if ($existing) {
            return redirect()->back()
                ->with('error', 'Candidate is already registered for this training program!')
                ->withInput();
        }

        $registration = TrainingRegistration::create([
            'candidate_id' => $request->candidate_id,
            'training_program_id' => $request->training_program_id,
            'registration_date' => now(),
            'start_date' => $request->start_date,
            'end_date' => $request->end_date,
            'status' => 'registered',
            'payment_status' => 'pending',
            'total_fee' => $request->total_fee,
            'paid_amount' => 0,
            'discount_code' => $request->discount_code,
            'discount_amount' => $request->discount_amount ?? 0,
            'remarks' => $request->remarks,
            'created_by' => Auth::id(),
        ]);

        // Update candidate status
        $candidate = Candidate::find($request->candidate_id);
        $candidate->status = 'in_training';
        $candidate->save();

        // Log the action
        AuditLog::create([
            'user_id' => Auth::id(),
            'action' => 'register_training',
            'module' => 'training_registration',
            'auditable_id' => $registration->id,
            'auditable_type' => TrainingRegistration::class,
            'new_values' => $registration->toArray(),
        ]);

        return redirect()->route('admin.training.registrations.index')
            ->with('success', 'Candidate registered for training successfully!');
    }

    public function show(TrainingRegistration $registration)
    {
        $registration->load([
            'candidate', 
            'trainingProgram', 
            'creator',
            'assessment',
            'certificate',
            'daybookEntries'
        ]);
        return view('admin.training.registrations.show', compact('registration'));
    }

    public function edit(TrainingRegistration $registration)
    {
        $candidates = Candidate::all();
        $programs = TrainingProgram::where('status', 'active')->get();
        return view('admin.training.registrations.edit', compact('registration', 'candidates', 'programs'));
    }

    public function update(Request $request, TrainingRegistration $registration)
    {
        $validator = Validator::make($request->all(), [
            'candidate_id' => 'required|exists:candidates,id',
            'training_program_id' => 'required|exists:training_programs,id',
            'start_date' => 'required|date',
            'status' => 'required|in:registered,ongoing,completed,dropped,cancelled',
            'total_fee' => 'required|numeric|min:0',
            'discount_code' => 'nullable|string|max:50',
            'discount_amount' => 'nullable|numeric|min:0',
            'remarks' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return redirect()->back()
                ->withErrors($validator)
                ->withInput();
        }

        $oldValues = $registration->toArray();
        $registration->update($request->all());

        // If registration is completed or dropped, update candidate status
        if (in_array($request->status, ['completed', 'dropped', 'cancelled'])) {
            $candidate = Candidate::find($request->candidate_id);
            if ($candidate->status === 'in_training') {
                $candidate->status = $request->status === 'completed' ? 'assessed' : 'registered';
                $candidate->save();
            }
        }

        AuditLog::create([
            'user_id' => Auth::id(),
            'action' => 'update',
            'module' => 'training_registration',
            'auditable_id' => $registration->id,
            'auditable_type' => TrainingRegistration::class,
            'old_values' => $oldValues,
            'new_values' => $registration->toArray(),
        ]);

        return redirect()->route('admin.training.registrations.index')
            ->with('success', 'Registration updated successfully!');
    }

    public function recordPayment(Request $request, TrainingRegistration $registration)
    {
        $validator = Validator::make($request->all(), [
            'amount' => 'required|numeric|min:0.01',
            'payment_method' => 'required|string|max:255',
            'remarks' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return redirect()->back()
                ->withErrors($validator)
                ->withInput();
        }

        $oldPaidAmount = $registration->paid_amount;
        $registration->paid_amount += $request->amount;
        
        // Update payment status
        if ($registration->paid_amount >= $registration->total_fee) {
            $registration->payment_status = 'paid';
        } elseif ($registration->paid_amount > 0) {
            $registration->payment_status = 'partial';
        }
        $registration->save();

        // Create daybook entry
        $daybook = Daybook::create([
            'transaction_date' => now(),
            'type' => 'receipt',
            'category' => 'training_fee',
            'sub_category' => $registration->trainingProgram->name,
            'description' => "Training fee payment from " . $registration->candidate->full_name,
            'amount' => $request->amount,
            'balance' => Daybook::sum('amount'), // This needs proper balance calculation
            'reference_number' => 'TRAIN-' . $registration->id . '-' . now()->timestamp,
            'payment_method' => $request->payment_method,
            'candidate_id' => $registration->candidate_id,
            'training_registration_id' => $registration->id,
            'created_by' => Auth::id(),
            'remarks' => $request->remarks,
        ]);

        AuditLog::create([
            'user_id' => Auth::id(),
            'action' => 'record_payment',
            'module' => 'training_registration',
            'auditable_id' => $registration->id,
            'auditable_type' => TrainingRegistration::class,
            'old_values' => ['paid_amount' => $oldPaidAmount],
            'new_values' => ['paid_amount' => $registration->paid_amount],
        ]);

        return redirect()->back()
            ->with('success', 'Payment recorded successfully!');
    }
}