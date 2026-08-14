@extends('layouts.app')
@section('title', 'Create Daybook Entry')
@section('content')
@include('admin.partials.form-page', ['title' => 'Create Daybook Entry', 'subtitle' => 'Record a new financial transaction.', 'mode' => 'Create'])
@endsection
