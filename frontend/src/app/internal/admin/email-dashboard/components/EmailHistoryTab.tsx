'use client';

import { useState, useEffect, useRef } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/Button';
import { EmailPreviewModal } from '@/components/ui/EmailPreviewModal';
import { api } from '@/services/api';
import styles from './EmailHistoryTab.module.css';

interface EmailDigest {
  id: string;
  type: 'manual' | 'usda_daily' | 'fda_weekly' | 'test';
  sentAt: Date;
  sentBy: string;
  recallCount: number;
  totalRecipients: number;
  recalls: Array<{
    id: string;
    title: string;
    source: 'USDA' | 'FDA';
  }>;
  emailHtml?: string; // For preview functionality
}

type SortField = 'sentAt' | 'type' | 'sentBy' | 'recallCount';
type SortDirection = 'asc' | 'desc';

export function EmailHistoryTab() {
  const { currentTheme } = useTheme();
  const [digests, setDigests] = useState<EmailDigest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortField, setSortField] = useState<SortField>('sentAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  // Ref to prevent double API calls in development (React StrictMode)
  const hasFetched = useRef(false);
  const lastPageFetched = useRef<number>(0);
  const [previewModal, setPreviewModal] = useState<{
    isOpen: boolean;
    digest: EmailDigest | null;
  }>({ isOpen: false, digest: null });
  const itemsPerPage = 10;

  useEffect(() => {
    // Prevent double API calls in React StrictMode (development)
    // Allow legitimate page changes but prevent duplicate calls for same page
    if (hasFetched.current && lastPageFetched.current === currentPage) return;
    
    hasFetched.current = true;
    lastPageFetched.current = currentPage;
    
    loadHistory();
  }, [currentPage]);

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const response = await api.getEmailHistory(currentPage, itemsPerPage);
      const digests = response.digests || []; // Default to empty array if undefined
      setDigests(digests.map((digest: any) => ({
        ...digest,
        sentAt: new Date(digest.sentAt)
      })));
      setTotalPages(response.totalPages || 1);
    } catch (error) {
      console.error('Failed to load email history:', error);
      setDigests([]);
      setTotalPages(1);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  };

  const getTypeLabel = (type: EmailDigest['type']) => {
    switch (type) {
      case 'manual': return 'Manual';
      case 'usda_daily': return 'USDA Auto';
      case 'fda_weekly': return 'FDA Weekly';
      case 'test': return 'Test';
      default: return 'Unknown';
    }
  };

  const getTypeColor = (type: EmailDigest['type']) => {
    switch (type) {
      case 'manual': return currentTheme.primary;
      case 'usda_daily': return currentTheme.success;
      case 'fda_weekly': return currentTheme.info;
      case 'test': return currentTheme.warning;
      default: return currentTheme.textSecondary;
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSortedDigests = () => {
    return [...digests].sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];
      
      if (sortField === 'sentAt') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      } else if (sortField === 'type') {
        aValue = getTypeLabel(a.type);
        bValue = getTypeLabel(b.type);
      }
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const handlePreview = (digest: EmailDigest) => {
    setPreviewModal({ isOpen: true, digest });
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return '↕️';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading} style={{ color: currentTheme.textSecondary }}>
          Loading email history...
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title} style={{ color: currentTheme.text }}>
          Email Send History
        </h2>
        <Button onClick={loadHistory} variant="secondary" size="small">
          Refresh
        </Button>
      </div>

      {/* History Table */}
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr style={{ borderBottomColor: currentTheme.cardBorder }}>
              <th 
                className={styles.sortableHeader}
                onClick={() => handleSort('sentAt')}
                style={{ color: currentTheme.text }}
              >
                Date {getSortIcon('sentAt')}
              </th>
              <th 
                className={styles.sortableHeader}
                onClick={() => handleSort('type')}
                style={{ color: currentTheme.text }}
              >
                Type {getSortIcon('type')}
              </th>
              <th 
                className={styles.sortableHeader}
                onClick={() => handleSort('sentBy')}
                style={{ color: currentTheme.text }}
              >
                Sender {getSortIcon('sentBy')}
              </th>
              <th 
                className={styles.sortableHeader}
                onClick={() => handleSort('recallCount')}
                style={{ color: currentTheme.text }}
              >
                Recalls {getSortIcon('recallCount')}
              </th>
              <th style={{ color: currentTheme.text }}>Recipients</th>
              <th style={{ color: currentTheme.text }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {getSortedDigests().map((digest) => (
              <tr key={digest.id} style={{ borderBottomColor: currentTheme.cardBorder }}>
                <td style={{ color: currentTheme.text }}>
                  {formatDate(digest.sentAt)}
                </td>
                <td>
                  <span 
                    className={styles.typeLabel}
                    style={{ 
                      backgroundColor: `${getTypeColor(digest.type)}20`,
                      color: getTypeColor(digest.type)
                    }}
                  >
                    {getTypeLabel(digest.type)}
                  </span>
                </td>
                <td style={{ color: currentTheme.text }}>
                  {digest.sentBy}
                </td>
                <td style={{ color: currentTheme.text }}>
                  {digest.recallCount}
                </td>
                <td style={{ color: currentTheme.text }}>
                  {digest.totalRecipients.toLocaleString()}
                </td>
                <td>
                  <Button 
                    onClick={() => handlePreview(digest)}
                    variant="secondary"
                    size="small"
                  >
                    Preview
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <Button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            variant="secondary"
            size="small"
          >
            Previous
          </Button>
          <span className={styles.pageInfo} style={{ color: currentTheme.text }}>
            Page {currentPage} of {totalPages}
          </span>
          <Button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            variant="secondary"
            size="small"
          >
            Next
          </Button>
        </div>
      )}

      {/* Email Preview Modal */}
      {previewModal.isOpen && previewModal.digest && (
        <EmailPreviewModal
          digest={previewModal.digest}
          onClose={() => setPreviewModal({ isOpen: false, digest: null })}
        />
      )}
    </div>
  );
}