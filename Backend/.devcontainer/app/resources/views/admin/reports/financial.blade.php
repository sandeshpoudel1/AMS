@extends('layouts.app')
@section('title', 'Financial Report')
@section('content')
@include('admin.partials.report-page', ['title' => 'Financial Report', 'subtitle' => 'Revenue, expenses, and trend performance.'])
@endsection
