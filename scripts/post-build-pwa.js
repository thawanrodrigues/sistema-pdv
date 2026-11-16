#!/usr/bin/env node
// =============================================================
// post-build-pwa.js
// Executado após `npx expo export --platform web`
// Copia manifest.json, sw.js e index.html para a pasta dist/
// =============================================================
const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WEB  = path.join(ROOT, 'web');
const DIST = path.join(ROOT, 'dist');

function copyFile(src, destDir, destName) {
  const dest = path.join(destDir, destName || path.basename(src));
  if (!fs.existsSync(src)) {
    console.warn(`[PWA] AVISO: arquivo não encontrado: ${src}`);
    return;
  }
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(src, dest);
  console.log(`[PWA] Copiado: ${path.relative(ROOT, src)} → ${path.relative(ROOT, dest)}`);
}

function patchIndexHtml() {
  const indexPath = path.join(DIST, 'index.html');
  if (!fs.existsSync(indexPath)) {
    console.warn('[PWA] AVISO: dist/index.html não encontrado — verifique o build.');
    return;
  }

  let html = fs.readFileSync(indexPath, 'utf8');

  // Injeta manifest link se ainda não tiver
  if (!html.includes('manifest.json')) {
    html = html.replace('</head>', '  <link rel="manifest" href="/manifest.json" />\n  </head>');
  }

  // Injeta meta theme-color se ainda não tiver
  if (!html.includes('theme-color')) {
    html = html.replace('</head>', '  <meta name="theme-color" content="#0f172a" />\n  </head>');
  }

  // Injeta registro do Service Worker antes de </body>
  if (!html.includes('serviceWorker')) {
    const swScript = `
  <script>
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js', { scope: '/' })
          .then(r => {
            r.update();
            console.log('[PWA] SW registrado e atualizado:', r.scope);
          })
          .catch(e => console.warn('[PWA] SW falhou:', e));
      });
    }
  </script>`;
    html = html.replace('</body>', swScript + '\n</body>');
  }

  fs.writeFileSync(indexPath, html);
  console.log('[PWA] dist/index.html atualizado com meta tags PWA e SW.');
}

// ── Execução ────────────────────────────────────────────────
console.log('\n[PWA] Iniciando pós-processamento PWA...\n');

// 1. Copiar manifest e service worker para dist
copyFile(path.join(WEB, 'manifest.json'), DIST);
copyFile(path.join(WEB, 'sw.js'),         DIST);

// 2. Copiar ícone PWA para dist/assets/images
const iconsDestDir = path.join(DIST, 'assets', 'images');
copyFile(
  path.join(ROOT, 'assets', 'images', 'pwa-icon-512.png'),
  iconsDestDir
);
copyFile(
  path.join(ROOT, 'assets', 'images', 'favicon.png'),
  iconsDestDir
);

// 3. Corrigir o index.html gerado pelo Expo
patchIndexHtml();

console.log('\n[PWA] ✅ Build PWA finalizado!\n');
console.log('Para testar: sirva a pasta dist/ com um servidor HTTPS.');
console.log('Exemplo: npx serve dist -s\n');
