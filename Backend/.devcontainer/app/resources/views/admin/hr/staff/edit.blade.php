@extends('layouts.app')
@section('title', 'Edit Staff Profile')
@section('content')
@include('admin.partials.form-page', ['title' => 'Edit Staff Profile', 'subtitle' => 'Update role, contact, and assignment data.', 'mode' => 'Edit'])
@endsection
