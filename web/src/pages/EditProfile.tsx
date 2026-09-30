import { useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { CropDialog } from '../components/CropDialog';
import { Avatar, Spinner } from '../components/ui';
import { useAuth } from '../lib/auth';
import { compressImage, removeImage, uploadImage } from '../lib/images';
import { friendlyError, supabase } from '../lib/supabase';

export default function EditProfile() {
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>();
  const [cropping, setCropping] = useState<File | null>(null);

  if (!profile) return <Spinner />;

  async function changePhoto(file: Blob) {
    setCropping(null);
    setUploading(true);
    try {
      const img = await compressImage(file, 400);
      const path = await uploadImage('avatars', profile!.id, img);
      const { error } = await supabase.from('profiles').update({ avatar_path: path }).eq('id', profile!.id);
      if (error) throw error;
      await removeImage('avatars', profile!.avatar_path);
      await refreshProfile();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setUploading(false);
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: displayName.trim() || null, bio: bio.trim() || null })
      .eq('id', profile!.id);
    setSaving(false);
    if (error) return setError(friendlyError(error));
    await refreshProfile();
    navigate('/profile');
  }

  return (
    <form className="stack" onSubmit={save}>
      <h1>Edit profile</h1>
      <div className="stack" style={{ alignItems: 'center', gap: 8 }}>
        <Avatar path={profile.avatar_path} size={96} />
        <button type="button" className="btn ghost small" onClick={() => fileInput.current?.click()} disabled={uploading}>
          {uploading ? 'Uploading…' : 'Change photo'}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="visually-hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) setCropping(file);
          }}
        />
      </div>
      {cropping ? <CropDialog file={cropping} onCancel={() => setCropping(null)} onDone={changePhoto} /> : null}
      <label className="field">
        <span>Username</span>
        <input className="input" value={`@${profile.username}`} disabled />
      </label>
      <label className="field">
        <span>Display name</span>
        <input className="input" maxLength={40} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
      </label>
      <label className="field">
        <span>Bio</span>
        <textarea className="input" maxLength={160} value={bio} onChange={(e) => setBio(e.target.value)} />
      </label>
      {error ? <p className="error">{error}</p> : null}
      <button className="btn primary block" disabled={saving}>
        {saving ? 'Saving…' : 'Save'}
      </button>
    </form>
  );
}
