@extends('layouts.app')
@section('title', 'Assessments')
@section('content')
@include('admin.partials.index-page', ['title' => 'Assessments', 'subtitle' => 'Manage tests, scores, and qualification checks.'])
@endsection
