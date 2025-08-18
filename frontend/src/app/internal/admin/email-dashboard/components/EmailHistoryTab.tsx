'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/Button';
import { EmailPreviewModal } from '@/components/ui/EmailPreviewModal';
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
  const [previewModal, setPreviewModal] = useState<{
    isOpen: boolean;
    digest: EmailDigest | null;
  }>({ isOpen: false, digest: null });
  const itemsPerPage = 10;

  useEffect(() => {
    loadHistory();
  }, [currentPage]);

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      // TODO: Implement API call
      // const response = await fetch(`/api/admin/email-history?page=${currentPage}&limit=${itemsPerPage}`);
      // const data = await response.json();
      // setDigests(data.digests);
      // setTotalPages(data.totalPages);
      
      // Mock data for now
      const mockDigests: EmailDigest[] = [
        {
          id: '1',
          type: 'usda_daily',
          sentAt: new Date('2024-01-15T17:00:00'),
          sentBy: 'John Admin',
          recallCount: 5,
          totalRecipients: 1247,
          recalls: [
            { id: 'usda-1', title: 'Ground Beef Recall - E. coli contamination', source: 'USDA' },
            { id: 'usda-2', title: 'Chicken Products - Salmonella risk', source: 'USDA' },
            { id: 'usda-3', title: 'Pork Sausages - Undeclared allergens', source: 'USDA' },
            { id: 'usda-4', title: 'Turkey Slices - Listeria concern', source: 'USDA' },
            { id: 'usda-5', title: 'Beef Patties - Foreign material', source: 'USDA' }
          ],
          emailHtml: '<html><body><h1>USDA Daily Digest</h1><p>5 new recalls affecting your area...</p></body></html>'
        },
        {
          id: '2',
          type: 'manual',
          sentAt: new Date('2024-01-14T14:30:00'),
          sentBy: 'Sarah Admin',
          recallCount: 8,
          totalRecipients: 892,
          recalls: [
            { id: 'mix-1', title: 'Frozen Vegetables - Listeria risk', source: 'FDA' },
            { id: 'mix-2', title: 'Canned Soup - Botulism concern', source: 'FDA' },
            { id: 'mix-3', title: 'Ground Turkey - Salmonella contamination', source: 'USDA' }
          ],
          emailHtml: '<html><body><h1>Manual Safety Alert</h1><p>8 critical recalls require immediate attention...</p></body></html>'
        },
        {
          id: '3',
          type: 'fda_weekly',
          sentAt: new Date('2024-01-13T10:00:00'),
          sentBy: 'Mike Admin',
          recallCount: 12,
          totalRecipients: 1534,
          recalls: [
            { id: 'fda-1', title: 'Baby Food - Heavy metals detected', source: 'FDA' },
            { id: 'fda-2', title: 'Dietary Supplements - Undeclared ingredients', source: 'FDA' }
          ],
          emailHtml: '<html><body><h1>FDA Weekly Roundup</h1><p>12 FDA recalls this week...</p></body></html>'
        },
        {
          id: '4',
          type: 'test',
          sentAt: new Date('2024-01-12T16:45:00'),
          sentBy: 'John Admin',
          recallCount: 3,
          totalRecipients: 1,
          recalls: [
            { id: 'test-1', title: 'Test Recall 1', source: 'USDA' },
            { id: 'test-2', title: 'Test Recall 2', source: 'FDA' }
          ],
          emailHtml: '<html><body><h1>Test Email</h1><p>This is a test digest...</p></body></html>'
        }
      ];
      
      setDigests(mockDigests);
      setTotalPages(3);
    } catch (error) {
      console.error('Failed to load email history:', error);
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