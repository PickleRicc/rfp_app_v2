'use client';

import Link from 'next/link';
import Image from 'next/image';
import CompanySelector from './CompanySelector';

export default function AppHeader() {
  return (
    <header className="sticky top-0 z-40 bg-card border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center">
              <Image
                src="/ClicklessAI.png"
                alt="ClicklessAI"
                width={520}
                height={130}
                className="h-32 w-auto"
                priority
              />
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <CompanySelector />
          </div>
        </div>
      </div>

      <div className="border-t border-border bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-6 py-3">
            <Link href="/" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              Upload RFP
            </Link>
            <Link href="/documents" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              Documents
            </Link>
            <Link href="/company" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              Company Data
            </Link>
            <Link href="/companies" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              All Companies
            </Link>
            <Link href="/solicitations" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              Solicitations
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
