export default function manifest() {
  return {
    name: 'Zielnik',
    short_name: 'Zielnik',
    description: 'Dziennik odmian: stany, oceny, rankingi i koło fortuny',
    start_url: '/',
    display: 'standalone',
    background_color: '#eef3e4',
    theme_color: '#1d3b27',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
