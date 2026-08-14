@extends('layouts.app')
@section('title', 'Edit Candidate')
@section('content')
@include('admin.partials.form-page', ['title' => 'Edit Candidate', 'subtitle' => 'Update candidate profile and progress.', 'mode' => 'Edit'])
@endsection
