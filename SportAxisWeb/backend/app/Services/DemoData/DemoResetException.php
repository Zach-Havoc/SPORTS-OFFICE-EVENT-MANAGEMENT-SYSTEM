<?php

namespace App\Services\DemoData;

/** A demo reset that must not run: turned off, already running, or no admin to keep. */
class DemoResetException extends \RuntimeException {}
