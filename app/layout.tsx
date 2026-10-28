import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ChitChatBot',
  description: 'Chat in every language. A translation bot for streamers and a free extension for viewers.',
  icons: { icon: '/icon.png' }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
