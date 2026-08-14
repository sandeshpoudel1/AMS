@extends('layouts.app')
@section('title', 'Daybook')
@section('content')
@include('admin.partials.index-page', ['title' => 'Daybook', 'subtitle' => 'Track daily financial entries and balances.'])
@endsection
