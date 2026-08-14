@extends('layouts.app')
@section('title', 'Add Candidate')
@section('content')
@include('admin.partials.form-page', ['title' => 'Add Candidate', 'subtitle' => 'Register a new candidate profile.', 'mode' => 'Create'])
@endsection
