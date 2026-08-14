@extends('layouts.app')
@section('title', 'Create Staff Profile')
@section('content')
@include('admin.partials.form-page', ['title' => 'Create Staff Profile', 'subtitle' => 'Add internal staff member details.', 'mode' => 'Create'])
@endsection
