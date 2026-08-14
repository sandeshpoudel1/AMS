@extends('layouts.app')
@section('title', 'Edit Company')
@section('content')
@include('admin.partials.form-page', ['title' => 'Edit Company', 'subtitle' => 'Update company profile and contacts.', 'mode' => 'Edit'])
@endsection
