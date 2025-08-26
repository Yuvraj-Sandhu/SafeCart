'use client';

import { useState, useEffect, useRef } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/Button';
import { EmailPreviewModal } from '@/components/ui/EmailPreviewModal';
import { api } from '@/services/api';
import styles from './EmailHistoryTab.module.css';

interface EmailAnalyticsSummary {
  totalSent: number;
  delivered: number;
  bounced: number;
  opened: number;
  clicked: number;
  unsubscribed: number;
  complained: number;
  rejected: number;
  deliveryRate: number;    // delivered / totalSent * 100
  openRate: number;        // opened / delivered * 100
  clickRate: number;       // clicked / delivered * 100
  bounceRate: number;      // bounced / totalSent * 100
  lastUpdated: string;     // ISO timestamp
}

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
  analytics?: EmailAnalyticsSummary; // Analytics from Mailchimp webhooks
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
  const [pageJumpValue, setPageJumpValue] = useState<string>('');
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [isLimitDropdownOpen, setIsLimitDropdownOpen] = useState<boolean>(false);
  const limitDropdownRef = useRef<HTMLDivElement>(null);
  
  // Ref to prevent double API calls in development (React StrictMode)
  const hasFetched = useRef(false);
  const lastPageFetched = useRef<number>(0);
  const [previewModal, setPreviewModal] = useState<{
    isOpen: boolean;
    digest: EmailDigest | null;
  }>({ isOpen: false, digest: null });
  
  const [analyticsModal, setAnalyticsModal] = useState<{
    isOpen: boolean;
    digest: EmailDigest | null;
  }>({ isOpen: false, digest: null });

  useEffect(() => {
    // Prevent double API calls in React StrictMode (development)
    // Allow legitimate page changes but prevent duplicate calls for same page
    if (hasFetched.current && lastPageFetched.current === currentPage) return;
    
    hasFetched.current = true;
    lastPageFetched.current = currentPage;
    
    loadHistory();
  }, [currentPage]);

  // Reset to page 1 when itemsPerPage changes
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    } else {
      loadHistory();
    }
  }, [itemsPerPage]);

  // Close limit dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (limitDropdownRef.current && !limitDropdownRef.current.contains(event.target as Node)) {
        setIsLimitDropdownOpen(false);
      }
    }

    if (isLimitDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isLimitDropdownOpen]);

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

  const exportToCsv = async () => {
    try {
      // Fetch all email history data for export
      const allData = await api.getAllEmailHistoryForExport();
      
      // CSV headers
      const headers = [
        'Date',
        'Type', 
        'Sender',
        'Recalls',
        'Recipients',
        'Delivery Rate',
        'Open Rate',
        'Click Rate',
        'Bounce Rate',
        'Total Sent',
        'Delivered',
        'Opened',
        'Clicked'
      ];

      // Convert data to CSV format
      const csvData = allData.map((digest: EmailDigest) => {
        const analytics = digest.analytics;
        const sentDate = formatDate(new Date(digest.sentAt));
        
        return [
          sentDate,
          getTypeLabel(digest.type),
          digest.sentBy,
          digest.recallCount.toString(),
          digest.totalRecipients.toString(),
          analytics ? `${analytics.deliveryRate.toFixed(1)}%` : 'N/A',
          analytics ? `${analytics.openRate.toFixed(1)}%` : 'N/A',
          analytics ? `${analytics.clickRate.toFixed(1)}%` : 'N/A',
          analytics ? `${analytics.bounceRate.toFixed(1)}%` : 'N/A',
          analytics ? analytics.totalSent.toString() : 'N/A',
          analytics ? analytics.delivered.toString() : 'N/A',
          analytics ? analytics.opened.toString() : 'N/A',
          analytics ? analytics.clicked.toString() : 'N/A'
        ];
      });

      // Create CSV content
      const csvContent = [headers, ...csvData]
        .map(row => row.map((field: string) => `"${field}"`).join(','))
        .join('\n');

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', `email-history-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert('Failed to export CSV. Please try again.');
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

  const handleAnalyticsView = (digest: EmailDigest) => {
    setAnalyticsModal({ isOpen: true, digest });
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return '↕️';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  const handlePageJumpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Only allow numbers
    if (value === '' || /^\d+$/.test(value)) {
      setPageJumpValue(value);
    }
  };

  const handlePageJumpSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const pageNumber = parseInt(pageJumpValue);
      if (pageNumber >= 1 && pageNumber <= totalPages) {
        setCurrentPage(pageNumber);
        setPageJumpValue(''); // Clear input after jumping
      }
    }
  };

  const handleLimitChange = (newLimit: number) => {
    setItemsPerPage(newLimit);
    setIsLimitDropdownOpen(false); // Close dropdown after selection
  };

  const handleLimitDropdownToggle = () => {
    setIsLimitDropdownOpen(!isLimitDropdownOpen);
  };

  const limitOptions = [
    { value: 10, label: '10' },
    { value: 20, label: '20' },
    { value: 30, label: '30' },
    { value: 50, label: '50' }
  ];

  const renderPaginationControls = () => (
    <>
      <Button
        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        variant="secondary"
        size="small"
      >
        Previous
      </Button>
      <div className={styles.pageInfo} style={{ color: currentTheme.text }}>
        <span>Page </span>
        <input
          type="text"
          value={pageJumpValue}
          onChange={handlePageJumpChange}
          onKeyDown={handlePageJumpSubmit}
          placeholder={currentPage.toString()}
          className={styles.pageJumpInput}
          style={{
            backgroundColor: currentTheme.cardBackground,
            borderColor: currentTheme.cardBorder,
            color: currentTheme.text
          }}
        />
        <span> of {totalPages}</span>
      </div>
      <Button
        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
        variant="secondary"
        size="small"
      >
        Next
      </Button>
    </>
  );

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
          Email History
        </h2>
        
        {/* Top Pagination - Always render container for layout */}
        <div className={styles.topPagination}>
          {totalPages > 1 ? renderPaginationControls() : <div></div>}
        </div>

        <div className={styles.iconsContainer}>
          <svg 
            onClick={exportToCsv}
            viewBox="0 0 24 24" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg"
            className={styles.exportIcon}
            style={{ 
              width: '32px', 
              height: '32px',
              cursor: 'pointer'
            }}
          >
            <title>Export to CSV</title>
            <g>
              <path d="M13.5 3H12H8C6.34315 3 5 4.34315 5 6V18C5 19.6569 6.34315 21 8 21H12M13.5 3L19 8.625M13.5 3V7.625C13.5 8.17728 13.9477 8.625 14.5 8.625H19M19 8.625V11.8125" stroke={currentTheme.text} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
              <path d="M17.5 15V21M17.5 21L15 18.5M17.5 21L20 18.5" stroke={currentTheme.text} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
            </g>
          </svg>

          <svg 
            onClick={loadHistory}
            fill={currentTheme.text} 
            viewBox="0 0 24 24" 
            xmlns="http://www.w3.org/2000/svg"
            className={styles.refreshIcon}
            style={{ 
              width: '32px', 
              height: '32px'
            }}
          >
            <path d="M19.146 4.854l-1.489 1.489A8 8 0 1 0 12 20a8.094 8.094 0 0 0 7.371-4.886 1 1 0 1 0-1.842-.779A6.071 6.071 0 0 1 12 18a6 6 0 1 1 4.243-10.243l-1.39 1.39a.5.5 0 0 0 .354.854H19.5A.5.5 0 0 0 20 9.5V5.207a.5.5 0 0 0-.854-.353z" />
          </svg>
        </div>
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
              <th style={{ color: currentTheme.text }}>Delivery Rate</th>
              <th style={{ color: currentTheme.text }}>Open Rate</th>
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
                <td style={{ color: currentTheme.text }}>
                  {digest.analytics ? (
                    <span className={styles.metric} style={{ 
                      color: digest.analytics.deliveryRate >= 95 ? currentTheme.success : 
                             digest.analytics.deliveryRate >= 85 ? currentTheme.warning : 
                             currentTheme.danger
                    }}>
                      {digest.analytics.deliveryRate}%
                    </span>
                  ) : (
                    <span style={{ color: currentTheme.textSecondary }}>-</span>
                  )}
                </td>
                <td style={{ color: currentTheme.text }}>
                  {digest.analytics ? (
                    <span className={styles.metric} style={{ 
                      color: digest.analytics.openRate >= 20 ? currentTheme.success : 
                             digest.analytics.openRate >= 10 ? currentTheme.warning : 
                             currentTheme.danger
                    }}>
                      {digest.analytics.openRate}%
                    </span>
                  ) : (
                    <span style={{ color: currentTheme.textSecondary }}>-</span>
                  )}
                </td>
                <td>
                  <div className={styles.actionButtons}>
                    <Button 
                      onClick={() => handlePreview(digest)}
                      variant="secondary"
                      size="small"
                    >
                      Preview
                    </Button>
                    {digest.analytics && (
                      <Button 
                        onClick={() => handleAnalyticsView(digest)}
                        variant="secondary"
                        size="small"
                      >
                        Analytics
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Bottom Pagination and Limit Controls */}
      <div className={styles.paginationWrapper}>
        {/* Limit selector on the left */}
        <div className={styles.limitContainer}>
          <span style={{ color: currentTheme.textSecondary }}>
            Limit of{' '}
            <div className={styles.limitSelectWrapper} ref={limitDropdownRef}>
              <div
                className={styles.limitDropdown}
                onClick={handleLimitDropdownToggle}
                style={{
                  backgroundColor: currentTheme.cardBackground,
                  borderColor: isLimitDropdownOpen ? currentTheme.primary : currentTheme.cardBorder,
                  color: currentTheme.text
                }}
              >
                {itemsPerPage}
              </div>
              <div 
                className={styles.limitDropdownArrow}
                style={{ color: currentTheme.textSecondary }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  style={{
                    transform: isLimitDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease'
                  }}
                >
                  <polyline
                    points="6,9 12,15 18,9"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              {/* Custom Dropdown Menu */}
              {isLimitDropdownOpen && (
                <div 
                  className={styles.limitDropdownMenu}
                  style={{
                    backgroundColor: currentTheme.cardBackground,
                    borderColor: currentTheme.cardBorder,
                    boxShadow: `0 4px 12px ${currentTheme.shadowLight}`,
                  }}
                >
                  {limitOptions.map((option) => (
                    <div
                      key={option.value}
                      className={`${styles.limitOption} ${
                        itemsPerPage === option.value ? styles.selected : ''
                      }`}
                      onClick={() => handleLimitChange(option.value)}
                      style={{
                        backgroundColor: itemsPerPage === option.value ? currentTheme.primaryLight : 'transparent',
                        color: currentTheme.text
                      }}
                    >
                      {option.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {' '}per page
          </span>
        </div>

        {/* Pagination controls in the center - Always render container for layout */}
        <div className={styles.pagination}>
          {totalPages > 1 ? renderPaginationControls() : <div></div>}
        </div>

        {/* Empty space on the right for balance */}
        <div className={styles.rightSpace}></div>
      </div>

      {/* Email Preview Modal */}
      {previewModal.isOpen && previewModal.digest && (
        <EmailPreviewModal
          digest={previewModal.digest}
          onClose={() => setPreviewModal({ isOpen: false, digest: null })}
        />
      )}

      {/* Email Analytics Modal */}
      {analyticsModal.isOpen && analyticsModal.digest && (
        <div className={styles.modalOverlay} onClick={() => setAnalyticsModal({ isOpen: false, digest: null })}>
          <div 
            className={styles.analyticsModal}
            style={{ 
              backgroundColor: currentTheme.cardBackground,
              borderColor: currentTheme.cardBorder,
              color: currentTheme.text
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader} style={{ borderBottomColor: currentTheme.cardBorder }}>
              <h2 style={{ color: currentTheme.text }}>
                Email Analytics - {getTypeLabel(analyticsModal.digest.type)}
              </h2>
              <button 
                className={styles.closeButton}
                onClick={() => setAnalyticsModal({ isOpen: false, digest: null })}
                style={{ color: currentTheme.text }}
              >
                ×
              </button>
            </div>

            <div className={styles.analyticsContent}>
              {analyticsModal.digest.analytics ? (
                <>
                  {/* Overview Cards */}
                  <div className={styles.analyticsGrid}>
                    <div className={styles.analyticsCard} style={{ 
                      backgroundColor: currentTheme.background,
                      borderColor: currentTheme.cardBorder 
                    }}>
                      <div className={styles.cardHeader}>
                        <h3 style={{ color: currentTheme.text }}>Email Performance</h3>
                      </div>
                      <div className={styles.metricsGrid}>
                        <div className={styles.metricItem}>
                          <span className={styles.metricLabel} style={{ color: currentTheme.textSecondary }}>
                            Delivery Rate
                          </span>
                          <span className={styles.metricValue} style={{ 
                            color: analyticsModal.digest.analytics.deliveryRate >= 95 ? currentTheme.success : 
                                   analyticsModal.digest.analytics.deliveryRate >= 85 ? currentTheme.warning : 
                                   currentTheme.danger 
                          }}>
                            {analyticsModal.digest.analytics.deliveryRate}%
                          </span>
                        </div>
                        <div className={styles.metricItem}>
                          <span className={styles.metricLabel} style={{ color: currentTheme.textSecondary }}>
                            Open Rate
                          </span>
                          <span className={styles.metricValue} style={{ 
                            color: analyticsModal.digest.analytics.openRate >= 20 ? currentTheme.success : 
                                   analyticsModal.digest.analytics.openRate >= 10 ? currentTheme.warning : 
                                   currentTheme.danger 
                          }}>
                            {analyticsModal.digest.analytics.openRate}%
                          </span>
                        </div>
                        <div className={styles.metricItem}>
                          <span className={styles.metricLabel} style={{ color: currentTheme.textSecondary }}>
                            Click Rate
                          </span>
                          <span className={styles.metricValue} style={{ 
                            color: analyticsModal.digest.analytics.clickRate >= 3 ? currentTheme.success : 
                                   analyticsModal.digest.analytics.clickRate >= 1 ? currentTheme.warning : 
                                   currentTheme.danger 
                          }}>
                            {analyticsModal.digest.analytics.clickRate}%
                          </span>
                        </div>
                        <div className={styles.metricItem}>
                          <span className={styles.metricLabel} style={{ color: currentTheme.textSecondary }}>
                            Bounce Rate
                          </span>
                          <span className={styles.metricValue} style={{ 
                            color: analyticsModal.digest.analytics.bounceRate <= 2 ? currentTheme.success : 
                                   analyticsModal.digest.analytics.bounceRate <= 5 ? currentTheme.warning : 
                                   currentTheme.danger 
                          }}>
                            {analyticsModal.digest.analytics.bounceRate}%
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className={styles.analyticsCard} style={{ 
                      backgroundColor: currentTheme.background,
                      borderColor: currentTheme.cardBorder 
                    }}>
                      <div className={styles.cardHeader}>
                        <h3 style={{ color: currentTheme.text }}>Email Counts</h3>
                      </div>
                      <div className={styles.countsGrid}>
                        <div className={styles.countItem}>
                          <span className={styles.countValue} style={{ color: currentTheme.primary }}>
                            {analyticsModal.digest.analytics.totalSent.toLocaleString()}
                          </span>
                          <span className={styles.countLabel} style={{ color: currentTheme.textSecondary }}>
                            Total Sent
                          </span>
                        </div>
                        <div className={styles.countItem}>
                          <span className={styles.countValue} style={{ color: currentTheme.success }}>
                            {analyticsModal.digest.analytics.delivered.toLocaleString()}
                          </span>
                          <span className={styles.countLabel} style={{ color: currentTheme.textSecondary }}>
                            Delivered
                          </span>
                        </div>
                        <div className={styles.countItem}>
                          <span className={styles.countValue} style={{ color: currentTheme.info }}>
                            {analyticsModal.digest.analytics.opened.toLocaleString()}
                          </span>
                          <span className={styles.countLabel} style={{ color: currentTheme.textSecondary }}>
                            Opened
                          </span>
                        </div>
                        <div className={styles.countItem}>
                          <span className={styles.countValue} style={{ color: currentTheme.warning }}>
                            {analyticsModal.digest.analytics.clicked.toLocaleString()}
                          </span>
                          <span className={styles.countLabel} style={{ color: currentTheme.textSecondary }}>
                            Clicked
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Issues Section */}
                  {(analyticsModal.digest.analytics.bounced > 0 || 
                    analyticsModal.digest.analytics.complained > 0 || 
                    analyticsModal.digest.analytics.unsubscribed > 0 || 
                    analyticsModal.digest.analytics.rejected > 0) && (
                    <div className={styles.analyticsCard} style={{ 
                      backgroundColor: currentTheme.background,
                      borderColor: currentTheme.cardBorder 
                    }}>
                      <div className={styles.cardHeader}>
                        <h3 style={{ color: currentTheme.text }}>Issues & Unsubscribes</h3>
                      </div>
                      <div className={styles.issuesGrid}>
                        {analyticsModal.digest.analytics.bounced > 0 && (
                          <div className={styles.issueItem}>
                            <span className={styles.issueValue} style={{ color: currentTheme.danger }}>
                              {analyticsModal.digest.analytics.bounced.toLocaleString()}
                            </span>
                            <span className={styles.issueLabel} style={{ color: currentTheme.textSecondary }}>
                              Bounced
                            </span>
                          </div>
                        )}
                        {analyticsModal.digest.analytics.rejected > 0 && (
                          <div className={styles.issueItem}>
                            <span className={styles.issueValue} style={{ color: currentTheme.danger }}>
                              {analyticsModal.digest.analytics.rejected.toLocaleString()}
                            </span>
                            <span className={styles.issueLabel} style={{ color: currentTheme.textSecondary }}>
                              Rejected
                            </span>
                          </div>
                        )}
                        {analyticsModal.digest.analytics.complained > 0 && (
                          <div className={styles.issueItem}>
                            <span className={styles.issueValue} style={{ color: currentTheme.danger }}>
                              {analyticsModal.digest.analytics.complained.toLocaleString()}
                            </span>
                            <span className={styles.issueLabel} style={{ color: currentTheme.textSecondary }}>
                              Spam Complaints
                            </span>
                          </div>
                        )}
                        {analyticsModal.digest.analytics.unsubscribed > 0 && (
                          <div className={styles.issueItem}>
                            <span className={styles.issueValue} style={{ color: currentTheme.warning }}>
                              {analyticsModal.digest.analytics.unsubscribed.toLocaleString()}
                            </span>
                            <span className={styles.issueLabel} style={{ color: currentTheme.textSecondary }}>
                              Unsubscribed
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Timestamp */}
                  <div className={styles.analyticsFooter}>
                    <span style={{ color: currentTheme.textSecondary }}>
                      Last updated: {new Date(analyticsModal.digest.analytics.lastUpdated).toLocaleString()}
                    </span>
                  </div>
                </>
              ) : (
                <div className={styles.noAnalytics}>
                  <p style={{ color: currentTheme.textSecondary }}>
                    No analytics data available for this email digest.
                  </p>
                  <p style={{ color: currentTheme.textSecondary, fontSize: '0.875rem' }}>
                    Analytics are collected via Mailchimp webhooks and may take some time to appear.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}