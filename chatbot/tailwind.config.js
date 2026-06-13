/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    theme: {
        extend: {
            fontFamily: {
                sans: ['"DM Sans"', 'sans-serif'],
                display: ['"Syne"', 'sans-serif'],
                mono: ['"JetBrains Mono"', 'monospace'],
            },
            colors: {
                ink: {
                    50: '#f0f4ff',
                    100: '#dde5f4',
                    200: '#b8c9e8',
                    300: '#8aa8d8',
                    400: '#5c86c8',
                    500: '#3a6ab8',
                    600: '#2a50a0',
                    700: '#1e3a7a',
                    800: '#142758',
                    900: '#0c1a38',
                    950: '#070f22',
                },
                surface: '#0d1117',
                card: '#161b27',
                border: '#1e2535',
                muted: '#4a5568',
                accent: '#38bdf8',
                warm: '#fb923c',
            }
        }
    },
    plugins: []
}
