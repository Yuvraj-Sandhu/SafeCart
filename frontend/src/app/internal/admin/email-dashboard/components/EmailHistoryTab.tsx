'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/Button';
import styles from './EmailHistoryTab.module.css';

interface EmailDigest {
  id: string;
  type: 'manual' | 'automatic';
  queueType?: 'USDA_DAILY' | 'FDA_WEEKLY';
  sentAt: Date;
  sentBy: string;
  testMode: boolean;
  recallCount: number;
  recipientStats: {
    total: number;
    byState: { [key: string]: number };
  };
  deliveryStats: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
  };
}

export function EmailHistoryTab() {
  const { currentTheme } = useTheme();
  const [digests, setDigests] = useState<EmailDigest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
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
          type: 'automatic',
          queueType: 'USDA_DAILY',
          sentAt: new Date('2024-01-15T17:00:00'),
          sentBy: 'admin@safecart.com',
          testMode: false,
          recallCount: 5,
          recipientStats: {
            total: 150,
            byState: { CA: 45, TX: 32, NY: 28, FL: 25, IL: 20 }
          },
          deliveryStats: {
            sent: 150,
            delivered: 148,
            opened: 87,
            clicked: 34
          }
        },
        {
          id: '2',
          type: 'manual',
          sentAt: new Date('2024-01-14T14:30:00'),
          sentBy: 'admin@safecart.com',
          testMode: false,
          recallCount: 12,
          recipientStats: {
            total: 200,
            byState: { CA: 60, TX: 40, NY: 35, FL: 30, IL: 35 }
          },
          deliveryStats: {
            sent: 200,
            delivered: 195,
            opened: 112,
            clicked: 45
          }
        },
        {
          id: '3',
          type: 'automatic',
          queueType: 'FDA_WEEKLY',
          sentAt: new Date('2024-01-13T10:00:00'),
          sentBy: 'admin@safecart.com',
          testMode: false,
          recallCount: 8,
          recipientStats: {
            total: 175,
            byState: { CA: 50, TX: 35, NY: 30, FL: 30, IL: 30 }
          },
          deliveryStats: {
            sent: 175,
            delivered: 172,
            opened: 95,
            clicked: 38
          }
        },
        {
          id: '4',
          type: 'manual',
          sentAt: new Date('2024-01-12T16:45:00'),
          sentBy: 'admin@safecart.com',
          testMode: true,
          recallCount: 3,
          recipientStats: {
            total: 1,
            byState: { CA: 1 }
          },
          deliveryStats: {
            sent: 1,
            delivered: 1,
            opened: 1,
            clicked: 0
          }
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

  const getTypeLabel = (digest: EmailDigest) => {
    if (digest.testMode) return 'Test';
    if (digest.type === 'automatic') {
      return digest.queueType === 'USDA_DAILY' ? 'USDA Auto' : 'FDA Manual';
    }
    return 'Manual';
  };

  const getTypeColor = (digest: EmailDigest) => {
    if (digest.testMode) return currentTheme.warning;
    if (digest.type === 'automatic') {
      return digest.queueType === 'USDA_DAILY' ? currentTheme.success : currentTheme.info;
    }
    return currentTheme.primary;
  };

  const calculateOpenRate = (stats: EmailDigest['deliveryStats']) => {
    if (stats.delivered === 0) return '0%';
    return `${Math.round((stats.opened / stats.delivered) * 100)}%`;
  };

  const calculateClickRate = (stats: EmailDigest['deliveryStats']) => {
    if (stats.opened === 0) return '0%';
    return `${Math.round((stats.clicked / stats.opened) * 100)}%`;
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
              <th style={{ color: currentTheme.text }}>Date</th>
              <th style={{ color: currentTheme.text }}>Type</th>
              <th style={{ color: currentTheme.text }}>Recalls</th>
              <th style={{ color: currentTheme.text }}>Recipients</th>
              <th style={{ color: currentTheme.text }}>Delivery</th>
              <th style={{ color: currentTheme.text }}>Open Rate</th>
              <th style={{ color: currentTheme.text }}>Click Rate</th>
              <th style={{ color: currentTheme.text }}>Top States</th>
            </tr>
          </thead>
          <tbody>
            {digests.map((digest) => (
              <tr key={digest.id} style={{ borderBottomColor: currentTheme.cardBorder }}>
                <td style={{ color: currentTheme.text }}>
                  {formatDate(digest.sentAt)}
                </td>
                <td>
                  <span 
                    className={styles.typeLabel}
                    style={{ 
                      backgroundColor: `${getTypeColor(digest)}20`,
                      color: getTypeColor(digest)
                    }}
                  >
                    {getTypeLabel(digest)}
                  </span>
                </td>
                <td style={{ color: currentTheme.text }}>
                  {digest.recallCount}
                </td>
                <td style={{ color: currentTheme.text }}>
                  {digest.recipientStats.total}
                </td>
                <td style={{ color: currentTheme.text }}>
                  {digest.deliveryStats.delivered}/{digest.deliveryStats.sent}
                </td>
                <td>
                  <span className={styles.metric} style={{ color: currentTheme.success }}>
                    {calculateOpenRate(digest.deliveryStats)}
                  </span>
                </td>
                <td>
                  <span className={styles.metric} style={{ color: currentTheme.info }}>
                    {calculateClickRate(digest.deliveryStats)}
                  </span>
                </td>
                <td style={{ color: currentTheme.textSecondary }}>
                  {Object.entries(digest.recipientStats.byState)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 3)
                    .map(([state, count]) => `${state} (${count})`)
                    .join(', ')}
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

      {/* Summary Stats */}
      <div className={styles.summarySection}>
        <h3 className={styles.summaryTitle} style={{ color: currentTheme.text }}>
          Last 30 Days Summary
        </h3>
        <div className={styles.summaryGrid}>
          <div className={styles.summaryCard} style={{ 
            backgroundColor: currentTheme.cardBackground,
            borderColor: currentTheme.cardBorder 
          }}>
            <span className={styles.summaryLabel} style={{ color: currentTheme.textSecondary }}>
              Total Digests Sent
            </span>
            <span className={styles.summaryValue} style={{ color: currentTheme.text }}>
              42
            </span>
          </div>
          <div className={styles.summaryCard} style={{ 
            backgroundColor: currentTheme.cardBackground,
            borderColor: currentTheme.cardBorder 
          }}>
            <span className={styles.summaryLabel} style={{ color: currentTheme.textSecondary }}>
              Total Recipients
            </span>
            <span className={styles.summaryValue} style={{ color: currentTheme.text }}>
              6,850
            </span>
          </div>
          <div className={styles.summaryCard} style={{ 
            backgroundColor: currentTheme.cardBackground,
            borderColor: currentTheme.cardBorder 
          }}>
            <span className={styles.summaryLabel} style={{ color: currentTheme.textSecondary }}>
              Average Open Rate
            </span>
            <span className={styles.summaryValue} style={{ color: currentTheme.success }}>
              58%
            </span>
          </div>
          <div className={styles.summaryCard} style={{ 
            backgroundColor: currentTheme.cardBackground,
            borderColor: currentTheme.cardBorder 
          }}>
            <span className={styles.summaryLabel} style={{ color: currentTheme.textSecondary }}>
              Average Click Rate
            </span>
            <span className={styles.summaryValue} style={{ color: currentTheme.info }}>
              24%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}