@extends('layouts.app')
@section('title', 'Create Training Program')
@section('content')
@include('admin.partials.form-page', ['title' => 'Create Training Program', 'subtitle' => 'Define curriculum, duration, and slots.', 'mode' => 'Create'])
@endsection
