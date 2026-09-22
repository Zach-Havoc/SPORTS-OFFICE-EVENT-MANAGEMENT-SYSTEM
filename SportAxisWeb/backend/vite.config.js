import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import { bunny } from 'laravel-vite-plugin/fonts';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.js'],
            refresh: true,
            fonts: [
                bunny('Instrument Sans', {
                    weights: [400, 500, 600],
                }),
            ],
        }),
        tailwindcss(),
    ],
    server: {
        // Fixed, off-default port so this never fights the real frontend app
        // (SportAxisWeb/'s own Vite instance) for 5173 when both run at once
        // via `composer run dev` — this backend-only Vite just compiles the
        // Blade scaffold's CSS/JS, it's not the actual product UI.
        port: 5199,
        strictPort: true,
        watch: {
            ignored: ['**/storage/framework/views/**'],
        },
    },
});
