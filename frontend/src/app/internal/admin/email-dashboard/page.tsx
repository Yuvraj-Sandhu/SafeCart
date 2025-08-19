'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import styles from './email-dashboard.module.css';

// Tab components (will be implemented separately)
import { ManualDigestTab } from './components/ManualDigestTab';
import { AutomaticQueuesTab } from './components/AutomaticQueuesTab';
import { EmailHistoryTab } from './components/EmailHistoryTab';

type TabType = 'manual' | 'queues' | 'history';

export default function EmailDashboardPage() {
  const { currentTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<TabType>('manual');

  const tabs = [
    { id: 'manual' as TabType, label: 'Manual Digest' },
    { id: 'queues' as TabType, label: 'Automatic Queues' },
    { id: 'history' as TabType, label: 'Email History' }
  ];

  return (
    <ProtectedRoute requireAdmin={true}>
      <div 
        className={styles.container}
        style={{ backgroundColor: currentTheme.background }}
      >
        <Header subtitle="Email Dashboard" />
        
        <main className={styles.main}>
          {/* Dashboard Header */}
          <div className={styles.dashboardHeader}>
            <h1 className={styles.title} style={{ color: currentTheme.text }}>
              Email Digest Management
            </h1>
            <p className={styles.subtitle} style={{ color: currentTheme.textSecondary }}>
              Manage email digests, queues, and history for recalls and alerts
            </p>
          </div>

          {/* Tab Navigation */}
          <div className={styles.tabNavigation}>
            <div className={styles.tabList} role="tablist">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  className={`${styles.tabButton} ${activeTab === tab.id ? styles.active : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    color: activeTab === tab.id ? currentTheme.primary : currentTheme.textSecondary,
                    borderBottomColor: activeTab === tab.id ? currentTheme.primary : 'transparent',
                    backgroundColor: activeTab === tab.id 
                      ? `${currentTheme.primary}10` 
                      : 'transparent'
                  }}
                >
                  <span className={styles.tabLabel}>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div 
            className={styles.tabContent}
            style={{ 
              backgroundColor: currentTheme.cardBackground,
              borderColor: currentTheme.cardBorder 
            }}
          >
            {activeTab === 'manual' && <ManualDigestTab />}
            {activeTab === 'queues' && <AutomaticQueuesTab />}
            {activeTab === 'history' && <EmailHistoryTab />}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}