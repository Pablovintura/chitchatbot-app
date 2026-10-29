import { notFound } from 'next/navigation';
import { currentChannel } from '@/lib/session';
import { isAdmin } from '@/lib/admin';
import AdminView from './view';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin - ChitChatBot', robots: { index: false } };

export default async function AdminPage() {
  const ch = await currentChannel('kick');
  if (!ch || !isAdmin(ch)) notFound();
  return <AdminView me={ch.channel_name} />;
}
