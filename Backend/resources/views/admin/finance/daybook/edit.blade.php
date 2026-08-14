@extends('layouts.app')
@section('title', 'Edit Daybook Entry')
@section('content')
@include('admin.partials.form-page', ['title' => 'Edit Daybook Entry', 'subtitle' => 'Correct or update a financial entry.', 'mode' => 'Edit'])
@endsection
