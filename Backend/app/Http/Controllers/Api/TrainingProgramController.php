<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\TrainingProgram;
use App\Models\AuditLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;

class TrainingProgramController extends Controller
{
    public function index(Request $request)
    {
        $query = TrainingProgram::with(['creator']);

        if ($request->has('status') && $request->status) {
            $query->where('status', $request->status);
        }

        if ($request->has('search') && $request->search) {
            $query->where('name', 'LIKE', "%{$request->search}%")
                  ->orWhere('code', 'LIKE', "%{$request->search}%");
        }

        $programs = $query->latest()->paginate(20);
        return view('admin.training.programs.index', compact('programs'));
    }

    public function create()
    {
        return view('admin.training.programs.create');
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'code' => 'required|string|unique:training_programs',
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'duration_days' => 'required|integer|min:1',
            'duration_hours' => 'nullable|integer|min:0',
            'fee' => 'required|numeric|min:0',
            'discount_fee' => 'nullable|numeric|min:0',
            'requirements' => 'nullable|array',
            'objectives' => 'nullable|array',
            'status' => 'required|in:active,inactive,completed',
        ]);

        if ($validator->fails()) {
            return redirect()->back()
                ->withErrors($validator)
                ->withInput();
        }

        $program = TrainingProgram::create([
            'code' => $request->code,
            'name' => $request->name,
            'description' => $request->description,
            'duration_days' => $request->duration_days,
            'duration_hours' => $request->duration_hours,
            'fee' => $request->fee,
            'discount_fee' => $request->discount_fee,
            'requirements' => $request->requirements,
            'objectives' => $request->objectives,
            'status' => $request->status,
            'created_by' => Auth::id(),
        ]);

        AuditLog::create([
            'user_id' => Auth::id(),
            'action' => 'create',
            'module' => 'training_program',
            'auditable_id' => $program->id,
            'auditable_type' => TrainingProgram::class,
            'new_values' => $program->toArray(),
        ]);

        return redirect()->route('admin.training.programs.index')
            ->with('success', 'Training program created successfully!');
    }

    public function show(TrainingProgram $program)
    {
        $program->load(['registrations.candidate', 'creator']);
        return view('admin.training.programs.show', compact('program'));
    }

    public function edit(TrainingProgram $program)
    {
        return view('admin.training.programs.edit', compact('program'));
    }

    public function update(Request $request, TrainingProgram $program)
    {
        $validator = Validator::make($request->all(), [
            'code' => 'required|string|unique:training_programs,code,' . $program->id,
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'duration_days' => 'required|integer|min:1',
            'duration_hours' => 'nullable|integer|min:0',
            'fee' => 'required|numeric|min:0',
            'discount_fee' => 'nullable|numeric|min:0',
            'requirements' => 'nullable|array',
            'objectives' => 'nullable|array',
            'status' => 'required|in:active,inactive,completed',
        ]);

        if ($validator->fails()) {
            return redirect()->back()
                ->withErrors($validator)
                ->withInput();
        }

        $oldValues = $program->toArray();
        $program->update($request->all());

        AuditLog::create([
            'user_id' => Auth::id(),
            'action' => 'update',
            'module' => 'training_program',
            'auditable_id' => $program->id,
            'auditable_type' => TrainingProgram::class,
            'old_values' => $oldValues,
            'new_values' => $program->toArray(),
        ]);

        return redirect()->route('admin.training.programs.index')
            ->with('success', 'Training program updated successfully!');
    }

    public function destroy(TrainingProgram $program)
    {
        if ($program->registrations()->count() > 0) {
            return redirect()->back()
                ->with('error', 'Cannot delete program with active registrations!');
        }

        $oldValues = $program->toArray();
        $program->delete();

        AuditLog::create([
            'user_id' => Auth::id(),
            'action' => 'delete',
            'module' => 'training_program',
            'auditable_id' => $program->id,
            'auditable_type' => TrainingProgram::class,
            'old_values' => $oldValues,
        ]);

        return redirect()->route('admin.training.programs.index')
            ->with('success', 'Training program deleted successfully!');
    }
}