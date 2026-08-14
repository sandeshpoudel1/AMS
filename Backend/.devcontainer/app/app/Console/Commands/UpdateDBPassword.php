<?php

namespace App\Console\Commands;

use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;

#[Signature('app:update-db-password')]
#[Description('Update DB_PASSWORD in the .env file using a hidden terminal prompt')]
class UpdateDBPassword extends Command
{
    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $envPath = base_path('.env');

        if (!is_file($envPath) || !is_readable($envPath) || !is_writable($envPath)) {
            $this->error('.env file is not accessible for update.');

            return self::FAILURE;
        }

        $password = $this->secret('Enter the new database password');

        if (!is_string($password) || $password === '') {
            $this->warn('No password entered. Nothing was changed.');

            return self::INVALID;
        }

        $envContents = file_get_contents($envPath);

        if ($envContents === false) {
            $this->error('Failed to read the .env file.');

            return self::FAILURE;
        }

        $replacementLine = 'DB_PASSWORD=' . $password;

        if (preg_match('/^DB_PASSWORD=.*$/m', $envContents) === 1) {
            $updatedContents = preg_replace('/^DB_PASSWORD=.*$/m', $replacementLine, $envContents, 1);
        } else {
            $updatedContents = rtrim($envContents) . PHP_EOL . $replacementLine . PHP_EOL;
        }

        if (!is_string($updatedContents) || file_put_contents($envPath, $updatedContents) === false) {
            $this->error('Failed to write the new password to .env.');

            return self::FAILURE;
        }

        Artisan::call('config:clear');

        $this->info('DB_PASSWORD updated successfully.');
        $this->line(Artisan::output());

        return self::SUCCESS;
    }
}
