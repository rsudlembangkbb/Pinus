import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PINUS - RSUD Lembang',
  description: 'Sistem Pembagian Insentif daN Jasa Pelayanan Untuk Semua - RSUD Lembang'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
