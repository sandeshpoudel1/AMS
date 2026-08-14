<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Staff;
use App\Models\User;
use App\Models\AuditLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Hash;

class StaffController extends Controller
{
    public function index(Request $request)
    {
        $query = Staff::with(['user']);

        if ($request->has('status') && $request->status) {
            $query->where('status', $request->status);
        }

        if ($request->has('department') && $request->department) {
            $query->where('department', $request->department);
        }

        if ($request->has('search') && $request->search) {
            $query->where(function($q) use ($request) {
                $q->where('first_name', 'LIKE', "%{$request->search}%")
                  ->orWhere('last_name', 'LIKE', "%{$request->search}%")
                  ->orWhere('employee_id', 'LIKE', "%{$request->search}%");
            });
        }

        $staff = $query->latest()->paginate(20);
        
        // Get unique departments for filter
        $departments = Staff::distinct('department')->pluck('department');

        return view('admin.hr.staff.index', compact('staff', 'departments'));
    }

    public function create()
    {
        return view('admin.hr.staff.create');
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'employee_id' => 'required|string|unique:staff',
            'first_name' => 'required|string|max:255',
            'last_name' => 'required|string|max:255',
            'designation' => 'required|string|max:255',
            'department' => 'required|string|max:255',
            'joining_date' => 'required|date',
            'base_salary' => 'required|numeric|min:0',
            'employment_type' => 'required|in:permanent,contract,intern',
            'email' => 'required|email|unique:users',
            'password' => 'required|string|min:8|confirmed',
            'address' => 'nullable|string',
            'emergency_contact' => 'nullable|string|max:255',
            'bank_details' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return redirect()->back()
                ->withErrors($validator)
                ->withInput();
        }

        // Create user account
        $user = User::create([
            'name' => $request->first_name . ' ' . $request->last_name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'phone' => $request->emergency_contact,
            'address' => $request->address,
            'employee_id' => $request->employee_id,
            'department' => $request->department,
            'is_active' => true,
        ]);

        // Create staff record
        $staff = Staff::create([
            'user_id' => $user->id,
            'employee_id' => $request->employee_id,
            'first_name' => $request->first_name,
            'last_name' => $request->last_name,
            'designation' => $request->designation,
            'department' => $request->department,
            'joining_date' => $request->joining_date,
            'base_salary' => $request->base_salary,
            'employment_type' => $request->employment_type,
            'status' => 'active',
            'bank_details' => $request->bank_details,
            'address' => $request->address,
            'emergency_contact' => $request->emergency_contact,
        ]);

        AuditLog::create([
            'user_id' => Auth::id(),
            'action' => 'create_staff',
            'module' => 'staff',
            'auditable_id' => $staff->id,
            'auditable_type' => Staff::class,
            'new_values' => $staff->toArray(),
        ]);

        return redirect()->route('admin.hr.staff.index')
            ->with('success', 'Staff member added successfully!');
    }

    public function show(Staff $staff)
    {
        $staff->load(['user', 'payroll', 'salaryAdvances']);
        return view('admin.hr.staff.show', compact('staff'));
    }

    public function edit(Staff $staff)
    {
        return view('admin.hr.staff.edit', compact('staff'));
    }

    public function update(Request $request, Staff $staff)
    {
        $validator = Validator::make($request->all(), [
            'employee_id' => 'required|string|unique:staff,employee_id,' . $staff->id,
            'first_name' => 'required|string|max:255',
            'last_name' => 'required|string|max:255',
            'designation' => 'required|string|max:255',
            'department' => 'required|string|max:255',
            'joining_date' => 'required|date',
            'base_salary' => 'required|numeric|min:0',
            'employment_type' => 'required|in:permanent,contract,intern',
            'status' => 'required|in:active,inactive,terminated',
            'address' => 'nullable|string',
            'emergency_contact' => 'nullable|string|max:255',
            'bank_details' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return redirect()->back()
                ->withErrors($validator)
                ->withInput();
        }

        $oldValues = $staff->toArray();
        $staff->update($request->all());

        // Update associated user
        $user = $staff->user;
        if ($user) {
            $user->name = $request->first_name . ' ' . $request->last_name;
            $user->phone = $request->emergency_contact;
            $user->address = $request->address;
            $user->department = $request->department;
            $user->save();
        }

        AuditLog::create([
            'user_id' => Auth::id(),
            'action' => 'update',
            'module' => 'staff',
            'auditable_id' => $staff->id,
            'auditable_type' => Staff::class,
            'old_values' => $oldValues,
            'new_values' => $staff->toArray(),
        ]);

        return redirect()->route('admin.hr.staff.index')
            ->with('success', 'Staff member updated successfully!');
    }
}