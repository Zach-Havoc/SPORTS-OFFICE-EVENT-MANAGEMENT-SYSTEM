<?php

namespace App\Support;

use App\Models\Event;
use chillerlan\QRCode\Output\QROutputInterface;
use chillerlan\QRCode\QRCode;
use chillerlan\QRCode\QROptions;

/**
 * An event's scoring QR code. It encodes the same link the web shows in its
 * QR dialog (/judge-qr/{event}/{token}); the mobile scanner reads the token
 * out of that path, and the web opens its QR scoring page from it.
 */
class EventQr
{
    /** Path part of the link, relative to the web app. */
    public static function path(Event $event): string
    {
        return "/judge-qr/{$event->id}/{$event->qr_token}";
    }

    public static function url(Event $event): string
    {
        return rtrim((string) config('app.frontend_url'), '/').self::path($event);
    }

    /** The QR code as PNG bytes, for attaching to an email. */
    public static function png(Event $event): string
    {
        $options = new QROptions([
            'outputType' => QROutputInterface::GDIMAGE_PNG,
            'outputBase64' => false,
            'scale' => 10,
            'quietzoneSize' => 4,
        ]);

        return (new QRCode($options))->render(self::url($event));
    }
}
