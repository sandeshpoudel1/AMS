@extends('layouts.app')
@section('title', 'Edit Assessment')
@section('content')
@include('admin.partials.form-page', ['title' => 'Edit Assessment', 'subtitle' => 'Update grading structure and metadata.', 'mode' => 'Edit'])
@endsection
