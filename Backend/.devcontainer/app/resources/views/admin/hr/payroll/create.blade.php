@extends('layouts.app')
@section('title', 'Create Payroll Entry')
@section('content')
@include('admin.partials.form-page', ['title' => 'Create Payroll Entry', 'subtitle' => 'Add a payroll cycle or payout item.', 'mode' => 'Create'])
@endsection
