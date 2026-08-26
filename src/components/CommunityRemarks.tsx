import { useEffect, useState, useCallback, FormEvent } from 'react';

//& crowd-sourced remarks section shown inside every map pin popup reads/writes via /api/remarks which is backed by supabase

interface CommunityRemark {
  content: string;
  updated_at: string;
}

interface CommunityRemarksProps {
  locationId: string;
}

//~ one shared wiki-style remark per location, capped so the popup never bloats
const MAX_REMARK_LENGTH = 280;

//~ short SG-friendly date, eg '23 Aug 2026'
const formatDate = (iso: string): string => {
  try {
    return new Date(iso).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
};

const CommunityRemarks = ({ locationId }: CommunityRemarksProps) => {
  const [remark, setRemark] = useState<CommunityRemark | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  //~ load the shared remark whn the popup opens
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setRemark(null);
    setEditing(false);
    setError(null);

    fetch(`/api/remarks?locationId=${encodeURIComponent(locationId)}`)
      .then(res => (res.ok ? res.json() : Promise.reject(new Error('fetch failed'))))
      .then((data: CommunityRemark | null) => {
        if (!cancelled) setRemark(data);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load community remarks');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [locationId]);

  const startEditing = useCallback(() => {
    setDraft(remark?.content ?? '');
    setEditing(true);
    setError(null);
  }, [remark]);

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/remarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        //~ an empty draft clears the shared remark
        body: JSON.stringify({ locationId, content: draft.trim() }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || 'Failed to save remark');
      }

      const saved: CommunityRemark | null = await res.json();
      setRemark(saved);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save remark');
    } finally {
      setSaving(false);
    }
  }, [draft, saving, locationId]);

  return (
    <div className="mt-1">
      <div className="flex items-center justify-between" style={{ margin: '2px 0 0 0', padding: 0 }}>
        <p className="text-xs" style={{ margin: 0, padding: 0 }}>
          <span className="font-medium">Community:</span>
          {remark && !editing && (
            <span className="text-gray-400 dark:text-gray-500"> (updated {formatDate(remark.updated_at)})</span>
          )}
        </p>
        {!loading && !editing && (
          <button
            type="button"
            onClick={startEditing}
            className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            ✏️ Edit
          </button>
        )}
      </div>

      {loading && (
        <p className="text-xs text-gray-500 dark:text-gray-400" style={{ margin: 0, padding: 0 }}>Loading…</p>
      )}

      {/*~ fixed-height display box so the popup size stays stable regardless of content */}
      {!loading && !editing && (
        <div
          className="text-xs rounded border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 px-2 py-1 overflow-y-auto"
          style={{ height: '3.5rem' }}
        >
          {remark ? (
            <span className="whitespace-pre-wrap break-words">{remark.content}</span>
          ) : (
            <span className="text-gray-500 dark:text-gray-400">No community remarks yet - be the first to add one!</span>
          )}
        </div>
      )}

      {editing && (
        <form onSubmit={handleSubmit}>
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            maxLength={MAX_REMARK_LENGTH}
            rows={3}
            placeholder="Share useful info (bidet type, floor, access…)"
            autoFocus
            className="w-full text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            style={{ height: '3.5rem' }}
            disabled={saving}
          />
          <div className="flex items-center justify-between mt-0.5">
            <span className="text-xs text-gray-400 dark:text-gray-500">{draft.length}/{MAX_REMARK_LENGTH}</span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setEditing(false)}
                disabled={saving}
                className="text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="text-xs px-2 py-0.5 rounded bg-blue-500 text-white disabled:opacity-50 hover:bg-blue-600"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      )}

      {error && (
        <p className="text-xs text-red-600 dark:text-red-400" style={{ margin: '2px 0 0 0', padding: 0 }}>{error}</p>
      )}
    </div>
  );
};

export default CommunityRemarks;
