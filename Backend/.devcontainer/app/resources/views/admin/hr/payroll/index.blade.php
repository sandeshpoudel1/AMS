@extends('layouts.app')
@section('title', 'Payroll')
@section('content')
@include('admin.partials.index-page', ['title' => 'Payroll', 'subtitle' => 'Run payroll cycles and review payout logs.'])
@endsection
