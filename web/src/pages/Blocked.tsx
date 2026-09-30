import { Ban } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Avatar, Empty } from '../components/ui';
import { useUserId } from '../lib/auth';
import { unblockUser } from '../lib/social';
import { supabase } from '../lib/supabase';

interface BlockRow {
  blocked_id: string;
  profile: { username: string; avatar_path: string | null } | null;
}

export default function Blocked() {
  const me = useUserId();
  const [rows, setRows] = useState<BlockRow[] | null>(null);

  const fetchRows = useCallback(async () => {
    const { data } = await supabase
      .from('blocks')
      .select('blocked_id, profile:profiles!blocks_blocked_id_fkey(username, avatar_path)')
      .eq('blocker_id', me!);
    return (data ?? []) as unknown as BlockRow[];
  }, [me]);
  const load = () => fetchRows().then(setRows);

  useEffect(() => {
    if (me) fetchRows().then(setRows);
  }, [me, fetchRows]);

  return (
    <>
      <h1>Blocked accounts</h1>
      {rows?.length === 0 ? <Empty icon={<Ban size={44} />} title="No blocked accounts" /> : null}
      {rows?.map((r) => (
        <div key={r.blocked_id} className="row">
          <Avatar path={r.profile?.avatar_path} />
          <strong className="grow">@{r.profile?.username}</strong>
          <button
            type="button"
            className="btn small"
            onClick={async () => {
              await unblockUser(r.blocked_id, me!);
              load();
            }}
          >
            Unblock
          </button>
        </div>
      ))}
    </>
  );
}
