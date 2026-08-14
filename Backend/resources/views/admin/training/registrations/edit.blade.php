@extends('layouts.app')
@section('title', 'Edit Registration')
@section('content')
@include('admin.partials.form-page', ['title' => 'Edit Registration', 'subtitle' => 'Adjust assignment and registration details.', 'mode' => 'Edit'])
@endsection
