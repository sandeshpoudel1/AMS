@extends('layouts.app')
@section('title', 'Edit Deployment')
@section('content')
@include('admin.partials.form-page', ['title' => 'Edit Deployment', 'subtitle' => 'Revise deployment terms and timelines.', 'mode' => 'Edit'])
@endsection
