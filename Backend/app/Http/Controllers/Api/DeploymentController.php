<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Deployment;
use App\Models\Candidate;
use App\Models\Company;
use App\Models\AuditLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class DeploymentController extends Controller
{
    public function index(Request $request)
    {
        $query = Deployment::with(['candidate', 'company', 'creator']);

        if ($request->has('status') && $request->status) {
            $query->where('status', $request->status);
        }

        if ($request->has('candidate_id') && $request->candidate_id) {
            $query->where('candidate_id', $request->candidate_id);
        }

        $deployments = $query->latest()->paginate(20);
        
        $candidates = Candidate::where('status', 'certified')
            ->orWhere('status', 'deployed')
            ->get();
        $companies = DB::table('companies')->where('status', 'active')->get();

        return view('admin.deployments.index', compact('deployments', 'candidates', 'companies'));
    }

    public function create()
    {
        $candidates = Candidate::where('status', 'certified')->get();
        $companies = DB::table('companies')->where('status', 'active')->get();
        
        return view('admin.deployments.create', compact('candidates', 'companies'));
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'candidate_id' => 'required|exists:candidates,id',
            'company_id' => 'required|exists:companies,id',
            'job_title' => 'required|string|max:255',
            'job_description' => 'nullable|string',
            'salary' => 'required|numeric|min:0',
            'contract_duration' => 'nullable|string|max:255',
            'visa_application_date' => 'nullable|date',
            'visa_approval_date' => 'nullable|date|after_or_equal:visa_application_date',
            'visa_number' => 'nullable|string|max:255',
            'flight_date' => 'nullable|date',
            'flight_number' => 'nullable|string|max:255',
            'deployment_date' => 'nullable|date',
            'status' => 'required|in:pending,visa_processing,visa_approved,flight_booked,deployed,completed,cancelled',
            'remarks' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return redirect()->back()
                ->withErrors($validator)
                ->withInput();
        }

        // Check if candidate already has active deployment
        $existing = Deployment::where('candidate_id', $request->candidate_id)
            ->whereNotIn('status', ['completed', 'cancelled'])
            ->first();

        if ($existing) {
            return redirect()->back()
                ->with('error', 'Candidate already has an active deployment!')
                ->withInput();
        }

        $deployment = Deployment::create([
            'candidate_id' => $request->candidate_id,
            'company_id' => $request->company_id,
            'job_title' => $request->job_title,
            'job_description' => $request->job_description,
            'salary' => $request->salary,
            'contract_duration' => $request->contract_duration,
            'visa_application_date' => $request->visa_application_date,
            'visa_approval_date' => $request->visa_approval_date,
            'visa_number' => $request->visa_number,
            'flight_date' => $request->flight_date,
            'flight_number' => $request->flight_number,
            'deployment_date' => $request->deployment_date,
            'status' => $request->status,
            'remarks' => $request->remarks,
            'created_by' => Auth::id(),
        ]);

        // Update candidate status
        $candidate = Candidate::find($request->candidate_id);
        if (in_array($request->status, ['deployed', 'completed'])) {
            $candidate->status = 'deployed';
        } else {
            $candidate->status = 'deployed'; // Actually should be 'in_deployment'
        }
        $candidate->save();

        AuditLog::create([
            'user_id' => Auth::id(),
            'action' => 'create_deployment',
            'module' => 'deployment',
            'auditable_id' => $deployment->id,
            'auditable_type' => Deployment::class,
            'new_values' => $deployment->toArray(),
        ]);

        return redirect()->route('admin.deployments.index')
            ->with('success', 'Deployment created successfully!');
    }

    public function show(Deployment $deployment)
    {
        $deployment->load(['candidate', 'company', 'creator']);
        return view('admin.deployments.show', compact('deployment'));
    }

    public function edit(Deployment $deployment)
    {
        $candidates = Candidate::all();
        $companies = DB::table('companies')->where('status', 'active')->get();
        return view('admin.deployments.edit', compact('deployment', 'candidates', 'companies'));
    }

    public function update(Request $request, Deployment $deployment)
    {
        $validator = Validator::make($request->all(), [
            'candidate_id' => 'required|exists:candidates,id',
            'company_id' => 'required|exists:companies,id',
            'job_title' => 'required|string|max:255',
            'job_description' => 'nullable|string',
            'salary' => 'required|numeric|min:0',
            'contract_duration' => 'nullable|string|max:255',
            'visa_application_date' => 'nullable|date',
            'visa_approval_date' => 'nullable|date|after_or_equal:visa_application_date',
            'visa_number' => 'nullable|string|max:255',
            'flight_date' => 'nullable|date',
            'flight_number' => 'nullable|string|max:255',
            'deployment_date' => 'nullable|date',
            'status' => 'required|in:pending,visa_processing,visa_approved,flight_booked,deployed,completed,cancelled',
            'remarks' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return redirect()->back()
                ->withErrors($validator)
                ->withInput();
        }

        $oldValues = $deployment->toArray();
        $deployment->update($request->all());

        AuditLog::create([
            'user_id' => Auth::id(),
            'action' => 'update',
            'module' => 'deployment',
            'auditable_id' => $deployment->id,
            'auditable_type' => Deployment::class,
            'old_values' => $oldValues,
            'new_values' => $deployment->toArray(),
        ]);

        return redirect()->route('admin.deployments.index')
            ->with('success', 'Deployment updated successfully!');
    }

    public function updateStatus(Request $request, Deployment $deployment)
    {
        $request->validate([
            'status' => 'required|in:pending,visa_processing,visa_approved,flight_booked,deployed,completed,cancelled',
            'remarks' => 'nullable|string',
        ]);

        $oldStatus = $deployment->status;
        $deployment->status = $request->status;
        if ($request->has('remarks')) {
            $deployment->remarks = $request->remarks;
        }
        $deployment->save();

        // Update candidate status based on deployment status
        $candidate = $deployment->candidate;
        if (in_array($request->status, ['deployed', 'completed'])) {
            $candidate->status = 'deployed';
        } elseif ($request->status === 'cancelled') {
            $candidate->status = 'certified';
        }
        $candidate->save();

        AuditLog::create([
            'user_id' => Auth::id(),
            'action' => 'status_change',
            'module' => 'deployment',
            'auditable_id' => $deployment->id,
            'auditable_type' => Deployment::class,
            'old_values' => ['status' => $oldStatus],
            'new_values' => ['status' => $request->status],
        ]);

        return redirect()->back()
            ->with('success', 'Deployment status updated successfully!');
    }
}