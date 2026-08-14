@extends('layouts.app')
@section('title', 'Candidate Report')
@section('content')
@include('admin.partials.report-page', ['title' => 'Candidate Report', 'subtitle' => 'Recruitment funnel and candidate outcomes.'])
@endsection
