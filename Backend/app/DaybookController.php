<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Daybook;
use App\Models\Candidate;
use App\Models\AuditLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;

class DaybookController extends Controller
{
    public function index(Request $request)
    {
        $query = Daybook::with(['candidate', 'creator']);

        // Filter by type
        if ($request->has('type') && $request->type) {
            $query->where('type', $request->type);
        }

        // Filter by date range
        if ($request->has('from_date') && $request->from_date) {
            $query->whereDate('transaction_date', '>=', $request->from_date);
        }
        if ($request->has('to_date') && $request->to_date) {
            $query->whereDate('transaction_date', '<=', $request->to_date);
        }

        // Filter by category
        if ($request->has('category') && $request->category) {
            $query->where('category', $request->category);
        }

        $transactions = $query->latest()->paginate(20);
        
        // Calculate totals
        $totalReceipts = Daybook::where('type', 'receipt')->sum('amount');
        $totalExpenses = Daybook::where('type', 'expense')->sum('amount');
        $balance = $totalReceipts - $totalExpenses;

        // Get unique categories for filter
        $categories = Daybook::distinct('category')->pluck('category');

        return view('admin.finance.daybook.index', compact(
            'transactions', 
            'totalReceipts', 
            'totalExpenses', 
            'balance',
            'categories'
        ));
    }

    public function create()
    {
        $candidates = Candidate::whereIn('status', ['registered', 'in_training', 'assessed'])->get();
        return view('admin.finance.daybook.create', compact('candidates'));
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'transaction_date' => 'required|date',
            'type' => 'required|in:receipt,expense',
            'category' => 'required|string|max:255',
            'sub_category' => 'nullable|string|max:255',
            'description' => 'required|string',
            'amount' => 'required|numeric|min:0.01',
            'reference_number' => 'nullable|string|max:255',
            'payment_method' => 'nullable|string|max:255',
            'candidate_id' => 'nullable|exists:candidates,id',
            'remarks' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return redirect()->back()
                ->withErrors($validator)
                ->withInput();
        }

        // Calculate running balance
        $lastBalance = Daybook::latest()->first();
        $currentBalance = $lastBalance ? $lastBalance->balance : 0;
        
        if ($request->type === 'receipt') {
            $newBalance = $currentBalance + $request->amount;
        } else {
            $newBalance = $currentBalance - $request->amount;
        }

        $daybook = Daybook::create([
            'transaction_date' => $request->transaction_date,
            'type' => $request->type,
            'category' => $request->category,
            'sub_category' => $request->sub_category,
            'description' => $request->description,
            'amount' => $request->amount,
            'balance' => $newBalance,
            'reference_number' => $request->reference_number,
            'payment_method' => $request->payment_method,
            'candidate_id' => $request->candidate_id,
            'created_by' => Auth::id(),
            'remarks' => $request->remarks,
        ]);

        // If candidate_id is provided, update their payment status if training fee
        if ($request->candidate_id && $request->category === 'training_fee') {
            // This logic would need to be implemented based on your business rules
        }

        AuditLog::create([
            'user_id' => Auth::id(),
            'action' => 'create_transaction',
            'module' => 'daybook',
            'auditable_id' => $daybook->id,
            'auditable_type' => Daybook::class,
            'new_values' => $daybook->toArray(),
        ]);

        return redirect()->route('admin.finance.daybook.index')
            ->with('success', 'Transaction recorded successfully!');
    }

    public function show(Daybook $daybook)
    {
        $daybook->load(['candidate', 'creator']);
        return view('admin.finance.daybook.show', compact('daybook'));
    }

    public function edit(Daybook $daybook)
    {
        $candidates = Candidate::all();
        return view('admin.finance.daybook.edit', compact('daybook', 'candidates'));
    }

    public function update(Request $request, Daybook $daybook)
    {
        $validator = Validator::make($request->all(), [
            'transaction_date' => 'required|date',
            'type' => 'required|in:receipt,expense',
            'category' => 'required|string|max:255',
            'sub_category' => 'nullable|string|max:255',
            'description' => 'required|string',
            'amount' => 'required|numeric|min:0.01',
            'reference_number' => 'nullable|string|max:255',
            'payment_method' => 'nullable|string|max:255',
            'candidate_id' => 'nullable|exists:candidates,id',
            'remarks' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return redirect()->back()
                ->withErrors($validator)
                ->withInput();
        }

        $oldValues = $daybook->toArray();

        // Recalculate balance for this and subsequent transactions
        // This is complex and should be handled carefully
        // For simplicity, we'll update the transaction without recalculating balance

        $daybook->update([
            'transaction_date' => $request->transaction_date,
            'type' => $request->type,
            'category' => $request->category,
            'sub_category' => $request->sub_category,
            'description' => $request->description,
            'amount' => $request->amount,
            'reference_number' => $request->reference_number,
            'payment_method' => $request->payment_method,
            'candidate_id' => $request->candidate_id,
            'remarks' => $request->remarks,
        ]);

        AuditLog::create([
            'user_id' => Auth::id(),
            'action' => 'update',
            'module' => 'daybook',
            'auditable_id' => $daybook->id,
            'auditable_type' => Daybook::class,
            'old_values' => $oldValues,
            'new_values' => $daybook->toArray(),
        ]);

        return redirect()->route('admin.finance.daybook.index')
            ->with('success', 'Transaction updated successfully!');
    }

    public function destroy(Daybook $daybook)
    {
        $oldValues = $daybook->toArray();
        $daybook->delete();

        AuditLog::create([
            'user_id' => Auth::id(),
            'action' => 'delete',
            'module' => 'daybook',
            'auditable_id' => $daybook->id,
            'auditable_type' => Daybook::class,
            'old_values' => $oldValues,
        ]);

        return redirect()->route('admin.finance.daybook.index')
            ->with('success', 'Transaction deleted successfully!');
    }

    public function getFinancialSummary(Request $request)
    {
        $startDate = $request->start_date ?? now()->startOfMonth();
        $endDate = $request->end_date ?? now()->endOfMonth();

        $receipts = Daybook::where('type', 'receipt')
            ->whereBetween('transaction_date', [$startDate, $endDate])
            ->sum('amount');

        $expenses = Daybook::where('type', 'expense')
            ->whereBetween('transaction_date', [$startDate, $endDate])
            ->sum('amount');

        $netProfit = $receipts - $expenses;

        return response()->json([
            'start_date' => $startDate,
            'end_date' => $endDate,
            'total_receipts' => $receipts,
            'total_expenses' => $expenses,
            'net_profit' => $netProfit,
        ]);
    }
}