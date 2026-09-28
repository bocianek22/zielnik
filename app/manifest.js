export default function manifest() {
  return {
    name: 'Zielnik',
    short_name: 'Zielnik',
    description: 'Dziennik odmian: stany, oceny, rankingi i koło fortuny',
    start_url: '/',
    display: 'standalone',
    background_color: '#eef3e4',
    theme_color: '#1d3b27',
    shortcuts: [
      { name: 'Nowa odmiana', short_name: 'Nowa', url: '/?new=1', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
      { name: 'Dziennik objawów', short_name: 'Objawy', url: '/dziennik', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
      { name: 'Recepty', short_name: 'Recepty', url: '/recepty', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
      { name: 'Historia', short_name: 'Historia', url: '/historia', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
    ],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
