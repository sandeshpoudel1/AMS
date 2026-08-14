@extends('layouts.app')
@section('title', 'Create Company')
@section('content')
@include('admin.partials.form-page', ['title' => 'Create Company', 'subtitle' => 'Add a new hiring partner organization.', 'mode' => 'Create'])
@endsection
