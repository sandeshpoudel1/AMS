@extends('layouts.app')
@section('title', 'Training Report')
@section('content')
@include('admin.partials.report-page', ['title' => 'Training Report', 'subtitle' => 'Program efficiency and completion metrics.'])
@endsection
