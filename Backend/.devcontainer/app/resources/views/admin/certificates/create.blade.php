@extends('layouts.app')
@section('title', 'Create Certificate')
@section('content')
@include('admin.partials.form-page', ['title' => 'Create Certificate', 'subtitle' => 'Generate certificate records for completion.', 'mode' => 'Create'])
@endsection
