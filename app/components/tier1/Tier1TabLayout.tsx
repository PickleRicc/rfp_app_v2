'use client';

import React from 'react';

export interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface Tier1TabLayoutProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  children: React.ReactNode;
  tabs: Tab[];
}

export function Tier1TabLayout({
  activeTab,
  onTabChange,
  children,
  tabs,
}: Tier1TabLayoutProps) {
  return (
    <div>
      {/* Sticky tab bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <nav className="flex overflow-x-auto" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`
                flex items-center gap-2 px-6 py-4 text-sm font-medium whitespace-nowrap
                border-b-2 transition-colors duration-150
                ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
              aria-current={activeTab === tab.id ? 'page' : undefined}
            >
              {tab.icon && <span className="flex-shrink-0">{tab.icon}</span>}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="mt-6">{children}</div>
    </div>
  );
}
