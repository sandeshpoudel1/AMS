@extends('layouts.app')
@section('title', 'Create Deployment')
@section('content')
@include('admin.partials.form-page', ['title' => 'Create Deployment', 'subtitle' => 'Assign candidate to a company placement.', 'mode' => 'Create'])
@endsection
