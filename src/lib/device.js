export async function requestWakeLock() {
  if (!navigator.wakeLock) return () => {};
  try {
    const sentinel = await navigator.wakeLock.request('screen');
    return () => {
      try { sentinel.release(); } catch { /* ignore */ }
    };
  } catch {
    return () => {};
  }
}

export async function shareText({ title, text }) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text });
      return 'shared';
    } catch (e) {
      if (e && e.name === 'AbortError') return 'cancelled';
    }
  }
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return 'copied';
    } catch {
      return 'failed';
    }
  }
  return 'failed';
}
