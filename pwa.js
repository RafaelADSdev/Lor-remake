/* Installation and optional artwork downloads. Game state stays in the engine. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const base = new URL('./', location.href);
  const prefix = `lor-pwa-${encodeURIComponent(base.pathname)}-`;
  let installPrompt, downloadController;
  const standalone = () => navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  const installed = () => {
    $('pwa-install').hidden = true;
    $('pwa-install-help').textContent = 'Aplicativo aberto em modo instalado.';
  };
  if (standalone()) installed();
  addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    $('pwa-install').hidden = standalone();
  });
  addEventListener('appinstalled', installed);
  $('pwa-install').onclick = async () => {
    if (!installPrompt) return;
    const prompt = installPrompt;
    installPrompt = null;
    $('pwa-install').hidden = true;
    try { await prompt.prompt(); await prompt.userChoice; } catch {}
  };
  $('pwa-cancel').onclick = () => downloadController?.abort();
  $('pwa-download').onclick = async () => {
    if (!navigator.onLine) {
      $('pwa-download-status').textContent = 'Conecte-se à internet para baixar as artes.';
      return;
    }
    downloadController = new AbortController();
    const signal = downloadController.signal;
    $('pwa-download').disabled = true;
    $('pwa-cancel').hidden = false;
    const progress = $('pwa-progress');
    progress.hidden = false;
    try {
      const response = await fetch(new URL('pwa-artwork.json', base), { signal });
      if (!response.ok) throw Error('Lista de artes indisponível.');
      const { files, version } = await response.json();
      const cache = await caches.open(prefix + 'art-' + version);
      const saved = new Set((await cache.keys()).map(request => request.url));
      // Requested only after an explicit download action; browsers may decline.
      await navigator.storage?.persist?.().catch(() => false);
      progress.max = files.length;
      progress.value = 0;
      for (const file of files) {
        signal.throwIfAborted();
        const url = new URL(file, base);
        if (!saved.has(url.href)) {
          const art = await fetch(url, { signal, cache: 'no-store', headers: { 'X-PWA-Artwork': 'download' } });
          if (!art.ok) throw Error('Uma arte não pôde ser baixada.');
          await cache.put(url, art);
        }
        progress.value++;
        $('pwa-download-status').textContent = `${progress.value} de ${files.length} artes salvas. Mantenha o app aberto; você pode pausar e continuar depois.`;
      }
      $('pwa-download-status').textContent = 'Artes de todas as cartas jogáveis salvas para offline. Vídeos e áudios continuam online.';
    } catch (error) {
      $('pwa-download-status').textContent = signal.aborted
        ? 'Download pausado. Toque em baixar para continuar de onde parou.'
        : 'Download interrompido por conexão ou falta de espaço. As artes já salvas foram mantidas; toque em baixar para tentar continuar.';
    } finally {
      $('pwa-download').disabled = false;
      $('pwa-cancel').hidden = true;
      downloadController = null;
    }
  };
  async function prepare() {
    if (!isSecureContext || !('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) {
      $('pwa-status').textContent = 'Para instalar no celular, abra o jogo por um endereço HTTPS. A pasta local continua funcionando no computador.';
      return;
    }
    try {
      const registration = await navigator.serviceWorker.register(new URL('sw.js', base), {
        scope: base.pathname, updateViaCache: 'none',
      });
      const showUpdate = () => {
        if (registration.waiting && navigator.serviceWorker.controller)
          $('pwa-status').textContent = 'Atualização baixada. Feche todas as janelas deste app e abra novamente para usar a nova versão.';
      };
      registration.addEventListener('updatefound', () => {
        registration.installing?.addEventListener('statechange', showUpdate);
      });
      const worker = registration.installing;
      await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((resolve, reject) => {
          if (!worker) return;
          const check = () => {
            if (worker.state === 'redundant') reject(Error('Offline preparation failed'));
            if (worker.state === 'activated') resolve();
          };
          worker.addEventListener('statechange', check);
          check();
        }),
      ]);
      $('pwa-status').textContent = 'Jogo pronto para abrir offline. Artes podem ser baixadas abaixo.';
      showUpdate();
      const response = await fetch(new URL('pwa-artwork.json', base));
      if (response.ok) {
        const { bytes } = await response.json();
        $('pwa-download').textContent = `Baixar artes para offline · ${Math.ceil(bytes / 1048576)} MB`;
      }
      $('pwa-download').disabled = false;
    } catch {
      $('pwa-status').textContent = 'Não foi possível preparar o acesso offline. Verifique a conexão e o espaço disponível e abra o app novamente.';
    }
  }
  if (document.readyState === 'complete') prepare();
  else addEventListener('load', prepare, { once: true });
})();
