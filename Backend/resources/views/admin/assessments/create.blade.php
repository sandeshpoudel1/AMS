@extends('layouts.app')
@section('title', 'Create Assessment')
@section('content')
@include('admin.partials.form-page', ['title' => 'Create Assessment', 'subtitle' => 'Set up evaluation criteria and schedule.', 'mode' => 'Create'])
@endsection
