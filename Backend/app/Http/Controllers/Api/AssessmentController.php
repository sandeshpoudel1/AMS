<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Assessment;
use App\Models\TrainingRegistration;
use App\Models\AuditLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;

class AssessmentController extends Controller
{
    public function index(Request $request)
    {
        $query = Assessment::with([
            'trainingRegistration.candidate',
            'trainingRegistration.trainingProgram',
            'assessor'
        ]);

        if ($request->has('result') && $request->result) {
            $query->where('result', $request->result);
        }

        if ($request->has('candidate_id') && $request->candidate_id) {
            $query->whereHas('trainingRegistration', function($q) use ($request) {
                $q->where('candidate_id', $request->candidate_id);
            });
        }

        $assessments = $query->latest()->paginate(20);
        
        $registrations = TrainingRegistration::where('status', 'ongoing')
            ->orWhere('status', 'completed')
            ->with(['candidate', 'trainingProgram'])
            ->get();

        return view('admin.assessments.index', compact('assessments', 'registrations'));
    }

    public function create()
    {
        $registrations = TrainingRegistration::where('status', 'ongoing')
            ->with(['candidate', 'trainingProgram'])
            ->get();
        
        return view('admin.assessments.create', compact('registrations'));
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'training_registration_id' => 'required|exists:training_registrations,id',
            'assessment_date' => 'required|date',
            'type' => 'required|in:written,practical,oral,comprehensive',
            'total_marks' => 'nullable|integer|min:0',
            'obtained_marks' => 'nullable|integer|min:0|max:total_marks',
            'result' => 'required|in:passed,failed,pending',
            'remarks' => 'nullable|string',
            'evaluation_criteria' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return redirect()->back()
                ->withErrors($validator)
                ->withInput();
        }

        // Calculate percentage
        $percentage = null;
        if ($request->total_marks && $request->obtained_marks) {
            $percentage = ($request->obtained_marks / $request->total_marks) * 100;
        }

        $assessment = Assessment::create([
            'training_registration_id' => $request->training_registration_id,
            'assessment_date' => $request->assessment_date,
            'type' => $request->type,
            'total_marks' => $request->total_marks,
            'obtained_marks' => $request->obtained_marks,
            'percentage' => $percentage,
            'result' => $request->result,
            'remarks' => $request->remarks,
            'assessor_id' => Auth::id(),
            'evaluation_criteria' => $request->evaluation_criteria,
        ]);

        // Update training registration status if completed
        if ($request->result !== 'pending') {
            $registration = TrainingRegistration::find($request->training_registration_id);
            if ($registration->status === 'ongoing') {
                $registration->status = 'completed';
                $registration->save();

                // Update candidate status
                $candidate = $registration->candidate;
                if ($request->result === 'passed') {
                    $candidate->status = 'assessed';
                } else {
                    $candidate->status = 'registered';
                }
                $candidate->save();
            }
        }

        AuditLog::create([
            'user_id' => Auth::id(),
            'action' => 'create_assessment',
            'module' => 'assessment',
            'auditable_id' => $assessment->id,
            'auditable_type' => Assessment::class,
            'new_values' => $assessment->toArray(),
        ]);

        return redirect()->route('admin.assessments.index')
            ->with('success', 'Assessment recorded successfully!');
    }

    public function show(Assessment $assessment)
    {
        $assessment->load([
            'trainingRegistration.candidate',
            'trainingRegistration.trainingProgram',
            'assessor'
        ]);
        return view('admin.assessments.show', compact('assessment'));
    }

    public function edit(Assessment $assessment)
    {
        $registrations = TrainingRegistration::with(['candidate', 'trainingProgram'])->get();
        return view('admin.assessments.edit', compact('assessment', 'registrations'));
    }

    public function update(Request $request, Assessment $assessment)
    {
        $validator = Validator::make($request->all(), [
            'assessment_date' => 'required|date',
            'type' => 'required|in:written,practical,oral,comprehensive',
            'total_marks' => 'nullable|integer|min:0',
            'obtained_marks' => 'nullable|integer|min:0|max:total_marks',
            'result' => 'required|in:passed,failed,pending',
            'remarks' => 'nullable|string',
            'evaluation_criteria' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return redirect()->back()
                ->withErrors($validator)
                ->withInput();
        }

        $oldValues = $assessment->toArray();

        // Calculate percentage
        $percentage = null;
        if ($request->total_marks && $request->obtained_marks) {
            $percentage = ($request->obtained_marks / $request->total_marks) * 100;
        }

        $assessment->update([
            'assessment_date' => $request->assessment_date,
            'type' => $request->type,
            'total_marks' => $request->total_marks,
            'obtained_marks' => $request->obtained_marks,
            'percentage' => $percentage,
            'result' => $request->result,
            'remarks' => $request->remarks,
            'evaluation_criteria' => $request->evaluation_criteria,
        ]);

        AuditLog::create([
            'user_id' => Auth::id(),
            'action' => 'update',
            'module' => 'assessment',
            'auditable_id' => $assessment->id,
            'auditable_type' => Assessment::class,
            'old_values' => $oldValues,
            'new_values' => $assessment->toArray(),
        ]);

        return redirect()->route('admin.assessments.index')
            ->with('success', 'Assessment updated successfully!');
    }

    public function destroy(Assessment $assessment)
    {
        $oldValues = $assessment->toArray();
        $assessment->delete();

        AuditLog::create([
            'user_id' => Auth::id(),
            'action' => 'delete',
            'module' => 'assessment',
            'auditable_id' => $assessment->id,
            'auditable_type' => Assessment::class,
            'old_values' => $oldValues,
        ]);

        return redirect()->route('admin.assessments.index')
            ->with('success', 'Assessment deleted successfully!');
    }
}