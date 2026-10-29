import './globals.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import { AuthProvider } from '../lib/auth/AuthProvider';
import ProfileGate from '../components/Auth/ProfileGate';
import AccessGate from '../components/Access/AccessGate';
import Navbar from '../components/Navbar';
import PageLoader from '../components/PageLoader';
import FollowUs from '../components/Follow/FollowUs';
import Footer from '../components/Follow/Footer';
import PendingScoreSaver from '../components/Game/PendingScoreSaver';
import { Analytics } from '@vercel/analytics/next';

export const metadata = {
  title: '300 Par Arena',
  description: 'Private beta: 300 Par, 1v1 duels and round-robin tournaments',
};

export default function RootLayout({ children }) {
  return (
    <AuthProvider>
      <html lang="en">
        <body className="bg-bg text-text">
          <div className="app min-h-screen bg-bg">
            <PageLoader />
            <ProfileGate />
            <PendingScoreSaver />
            <FollowUs />
            <Navbar />
            <AccessGate>{children}</AccessGate>
            <Footer />
          </div>
          <Analytics />
        </body>
      </html>
    </AuthProvider>
  );
}
