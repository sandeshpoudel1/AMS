@extends('layouts.app')
@section('title', 'Payroll Report')
@section('content')
@include('admin.partials.report-page', ['title' => 'Payroll Report', 'subtitle' => 'Salary disbursement and payroll compliance.'])
@endsection
