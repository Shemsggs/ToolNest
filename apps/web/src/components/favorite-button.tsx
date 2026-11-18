'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api-client';

export function FavoriteButton({ slug, initialFavorite }: { slug: string; initialFavorite: boolean }) {
  const [favorite, setFavorite] = useState(initialFavorite);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  async function toggle() {
    setBusy(true);
    setError('');
    try {
      const result = await apiRequest<{ favorite: boolean }>(`/api/v1/favorites/${slug}`, 'PUT', { favorite: !favorite });
      setFavorite(result.favorite);
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not update favorites.');
    } finally {
      setBusy(false);
    }
  }

  return <div className="mb-4">
    <button type="button" className="btn-secondary" aria-pressed={favorite} disabled={busy} onClick={toggle}>
      {favorite ? '★ Favorited' : '☆ Favorite'}
    </button>
    {error && <p className="text-sm mt-2" role="alert">{error}</p>}
  </div>;
}
