@extends('layouts.app')
@section('title', 'Create Registration')
@section('content')
@include('admin.partials.form-page', ['title' => 'Create Registration', 'subtitle' => 'Enroll candidate into a program.', 'mode' => 'Create'])
@endsection
