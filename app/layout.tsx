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
      <body>
        <div className="bgl" aria-hidden="true"><svg className="bb" viewBox="0 0 24 24" style={{left:'-8%',top:'8%',width:300,transform:'rotate(-8deg)'}}><path d="M4 4h16a3 3 0 013 3v8a3 3 0 01-3 3h-7l-5 4v-4H4a3 3 0 01-3-3V7a3 3 0 013-3z" fill="none" stroke="#fff" strokeWidth=".35" /></svg><svg className="bb" viewBox="0 0 24 24" style={{left:'62%',top:'34%',width:340,transform:'rotate(10deg)'}}><path d="M4 4h16a3 3 0 013 3v8a3 3 0 01-3 3h-7l-5 4v-4H4a3 3 0 01-3-3V7a3 3 0 013-3z" fill="none" stroke="#fff" strokeWidth=".35" /></svg><svg className="bb" viewBox="0 0 24 24" style={{left:'-4%',top:'64%',width:280,transform:'rotate(6deg)'}}><path d="M4 4h16a3 3 0 013 3v8a3 3 0 01-3 3h-7l-5 4v-4H4a3 3 0 01-3-3V7a3 3 0 013-3z" fill="none" stroke="#fff" strokeWidth=".35" /></svg></div>
        {children}
      </body>
    </html>
  );
}
