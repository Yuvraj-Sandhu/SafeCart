'use client';

import React from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from './ui/Button';
import { Recall, downloadAsJson } from '@/services/api';
import styles from './RecallList.module.css';

interface RecallListProps {
  recalls: Recall[];
  loading: boolean;
  error: string | null;
}

export function RecallList({ recalls, loading, error }: RecallListProps) {
  const { currentTheme } = useTheme();

  const handleDownloadRecall = (recall: Recall) => {
    downloadAsJson(recall, `recall-${recall.field_recall_number}.json`);
  };

  const handleDownloadAll = () => {
    downloadAsJson(recalls, `recalls-${new Date().toISOString().split('T')[0]}.json`);
  };

  const getRiskLevelColor = (riskLevel: string) => {
    const level = riskLevel.toLowerCase();
    if (level.includes('high') || level.includes('class i')) return currentTheme.danger;
    if (level.includes('medium') || level.includes('class ii')) return currentTheme.warning;
    if (level.includes('low') || level.includes('class iii')) return currentTheme.success;
    return currentTheme.textSecondary;
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <p style={{ color: currentTheme.textSecondary }}>Loading recalls...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div 
        className={styles.error}
        style={{ 
          backgroundColor: currentTheme.dangerLight,
          color: currentTheme.danger 
        }}
      >
        <p>Error: {error}</p>
      </div>
    );
  }

  if (recalls.length === 0) {
    return (
      <div 
        className={styles.empty}
        style={{ color: currentTheme.textSecondary }}
      >
        <p>No recalls found for the selected criteria.</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 style={{ color: currentTheme.text }}>
          Found {recalls.length} recall{recalls.length !== 1 ? 's' : ''}
        </h2>
        <Button size="small" onClick={handleDownloadAll}>
          Download All as JSON
        </Button>
      </div>
      
      <div className={styles.list}>
        {recalls.map((recall) => (
          <div
            key={recall.id}
            className={styles.recallCard}
            style={{
              backgroundColor: currentTheme.cardBackground,
              borderColor: currentTheme.cardBorder,
            }}
          >
            <div className={styles.recallHeader}>
              <h3 
                className={styles.recallTitle}
                style={{ color: currentTheme.text }}
              >
                {recall.field_title}
              </h3>
              <span 
                className={styles.riskLevel}
                style={{ 
                  color: getRiskLevelColor(recall.field_risk_level),
                  borderColor: getRiskLevelColor(recall.field_risk_level),
                }}
              >
                {recall.field_risk_level}
              </span>
            </div>
            
            <div className={styles.recallDetails}>
              <div className={styles.detailRow}>
                <span 
                  className={styles.detailLabel}
                  style={{ color: currentTheme.textSecondary }}
                >
                  Recall Number:
                </span>
                <span style={{ color: currentTheme.text }}>
                  {recall.field_recall_number}
                </span>
              </div>
              
              <div className={styles.detailRow}>
                <span 
                  className={styles.detailLabel}
                  style={{ color: currentTheme.textSecondary }}
                >
                  Date:
                </span>
                <span style={{ color: currentTheme.text }}>
                  {new Date(recall.field_recall_date).toLocaleDateString()}
                </span>
              </div>
              
              <div className={styles.detailRow}>
                <span 
                  className={styles.detailLabel}
                  style={{ color: currentTheme.textSecondary }}
                >
                  States:
                </span>
                <span style={{ color: currentTheme.text }}>
                  {recall.field_states}
                </span>
              </div>
              
              <div className={styles.detailRow}>
                <span 
                  className={styles.detailLabel}
                  style={{ color: currentTheme.textSecondary }}
                >
                  Company:
                </span>
                <span style={{ color: currentTheme.text }}>
                  {recall.field_establishment}
                </span>
              </div>
            </div>
            
            <div className={styles.recallActions}>
              <Button 
                size="small" 
                variant="secondary"
                onClick={() => handleDownloadRecall(recall)}
              >
                Download JSON
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}