<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const NOTES_META_PREFIX = "\n\n[MOPL_PASSPORT_META]";

    public function up(): void
    {
        if (!Schema::hasTable('candidates')) {
            return;
        }

        $requiredColumns = [
            'passport_issue_date',
            'passport_expiry_date',
            'passport_renewal_day',
        ];

        foreach ($requiredColumns as $column) {
            if (!Schema::hasColumn('candidates', $column)) {
                return;
            }
        }

        $fallbackByCandidateId = [];

        if (Schema::hasTable('app_settings')) {
            $rows = DB::table('app_settings')
                ->select('key', 'value')
                ->where('key', 'like', 'candidate_passport_dates:%')
                ->get();

            foreach ($rows as $row) {
                $candidateId = (int) str_replace('candidate_passport_dates:', '', (string) $row->key);
                if ($candidateId <= 0) {
                    continue;
                }

                $value = $row->value;
                if (is_string($value)) {
                    $decoded = json_decode($value, true);
                    $value = is_array($decoded) ? $decoded : [];
                } elseif (!is_array($value)) {
                    $value = [];
                }

                $fallbackByCandidateId[$candidateId] = $value;
            }
        }

        DB::table('candidates')
            ->select('id', 'notes', 'passport_issue_date', 'passport_expiry_date', 'passport_renewal_day')
            ->orderBy('id')
            ->chunkById(200, function ($candidates) use ($fallbackByCandidateId) {
                foreach ($candidates as $candidate) {
                    $fallbackFromSettings = $fallbackByCandidateId[(int) $candidate->id] ?? [];
                    $fallbackFromNotes = $this->extractMetaFromNotes($candidate->notes);

                    $nextIssueDate = $candidate->passport_issue_date
                        ?: ($fallbackFromSettings['passport_issue_date'] ?? $fallbackFromNotes['passport_issue_date'] ?? null);
                    $nextExpiryDate = $candidate->passport_expiry_date
                        ?: ($fallbackFromSettings['passport_expiry_date'] ?? $fallbackFromNotes['passport_expiry_date'] ?? null);
                    $nextRenewalDay = $candidate->passport_renewal_day
                        ?: ($fallbackFromSettings['passport_renewal_day'] ?? $fallbackFromNotes['passport_renewal_day'] ?? null);

                    $cleanNotes = $this->stripMetaFromNotes($candidate->notes);

                    $updates = [];

                    if ($nextIssueDate !== $candidate->passport_issue_date) {
                        $updates['passport_issue_date'] = $nextIssueDate;
                    }

                    if ($nextExpiryDate !== $candidate->passport_expiry_date) {
                        $updates['passport_expiry_date'] = $nextExpiryDate;
                    }

                    if ($nextRenewalDay !== $candidate->passport_renewal_day) {
                        $updates['passport_renewal_day'] = $nextRenewalDay;
                    }

                    if ((string) ($cleanNotes ?? '') !== (string) ($candidate->notes ?? '')) {
                        $updates['notes'] = $cleanNotes;
                    }

                    if (!empty($updates)) {
                        $updates['updated_at'] = now();
                        DB::table('candidates')->where('id', $candidate->id)->update($updates);
                    }
                }
            }, 'id');

        if (Schema::hasTable('app_settings')) {
            DB::table('app_settings')
                ->where('key', 'like', 'candidate_passport_dates:%')
                ->delete();
        }
    }

    public function down(): void
    {
        // Irreversible data migration.
    }

    private function extractMetaFromNotes($notes): array
    {
        $value = (string) ($notes ?? '');
        $position = strrpos($value, self::NOTES_META_PREFIX);

        if ($position === false) {
            return [];
        }

        $json = substr($value, $position + strlen(self::NOTES_META_PREFIX));
        $decoded = json_decode(trim($json), true);

        return is_array($decoded) ? $decoded : [];
    }

    private function stripMetaFromNotes($notes): string
    {
        $value = (string) ($notes ?? '');
        return preg_replace('/\\n\\n\\[MOPL_PASSPORT_META\\]\\{.*\\}\\s*$/s', '', $value) ?? $value;
    }
};
