import { Bell } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, Empty, Spinner } from '../components/ui';
import { useUserId } from '../lib/auth';
import { timeAgo } from '../lib/social';
import { supabase } from '../lib/supabase';
import type { NotificationRow } from '../shared/types';

const TEXT: Record<NotificationRow['type'], string> = {
  like: 'liked your fit',
  comment: 'commented on your fit',
  tag: 'tagged you in a fit',
  follow: 'started following you',
  rating: 'rated your fit',
};

export default function Notifications() {
  const me = useUserId();
  const [rows, setRows] = useState<NotificationRow[] | null>(null);

  useEffect(() => {
    if (!me) return;
    (async () => {
      const { data } = await supabase
        .from('notifications')
        .select('id, type, post_id, actor_id, read_at, created_at, actor:profiles!notifications_actor_id_fkey(username, display_name, avatar_path)')
        .eq('user_id', me)
        .order('created_at', { ascending: false })
        .limit(100);
      setRows((data ?? []) as unknown as NotificationRow[]);
      await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', me).is('read_at', null);
    })();
  }, [me]);

  if (!rows) return <Spinner />;
  return (
    <>
      <h1>Activity</h1>
      {rows.length === 0 ? (
        <Empty icon={<Bell size={44} />} title="Nothing yet" body="Likes, comments, tags and follows will show up here." />
      ) : null}
      {rows.map((n) => (
        <Link key={n.id} to={n.post_id ? `/post/${n.post_id}` : `/u/${n.actor_id}`} className="list-row" style={{ opacity: n.read_at ? 0.75 : 1 }}>
          <Avatar path={n.actor?.avatar_path} size={40} />
          <div className="grow">
            <p>
              <strong>{n.actor?.display_name || n.actor?.username} </strong>
              {TEXT[n.type]}
            </p>
            <span className="muted tiny">{timeAgo(n.created_at)}</span>
          </div>
          {!n.read_at ? <span style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--accent)' }} /> : null}
        </Link>
      ))}
    </>
  );
}
