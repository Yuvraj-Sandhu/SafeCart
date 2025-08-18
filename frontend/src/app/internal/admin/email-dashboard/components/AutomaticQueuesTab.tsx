'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/Button';
import styles from './AutomaticQueuesTab.module.css';

interface QueueData {
  type: 'USDA_DAILY' | 'FDA_WEEKLY';
  status: 'pending' | 'processing' | 'sent' | 'cancelled';
  recalls: Array<{
    recallId: string;
    title: string;
    source: 'USDA' | 'FDA';
    hasImage: boolean;
    addedAt: Date;
  }>;
  scheduledFor: Date | null;
  imageStats: {
    total: number;
    withImages: number;
  };
}

export function AutomaticQueuesTab() {
  const { currentTheme } = useTheme();
  const [usdaQueue, setUsdaQueue] = useState<QueueData | null>(null);
  const [fdaQueue, setFdaQueue] = useState<QueueData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadQueues();
  }, []);

  const loadQueues = async () => {
    setIsLoading(true);
    try {
      // TODO: Implement API call
      // const response = await fetch('/api/admin/queues');
      // const data = await response.json();
      // setUsdaQueue(data.usda);
      // setFdaQueue(data.fda);
      
      // Mock data for now
      setUsdaQueue({
        type: 'USDA_DAILY',
        status: 'pending',
        recalls: [
          { recallId: '1', title: 'USDA Recall 1', source: 'USDA', hasImage: true, addedAt: new Date() },
          { recallId: '2', title: 'USDA Recall 2', source: 'USDA', hasImage: true, addedAt: new Date() },
          { recallId: '3', title: 'USDA Recall 3', source: 'USDA', hasImage: false, addedAt: new Date() }
        ],
        scheduledFor: new Date(new Date().setHours(17, 0, 0, 0)), // 5pm today
        imageStats: { total: 3, withImages: 2 }
      });
      
      setFdaQueue({
        type: 'FDA_WEEKLY',
        status: 'pending',
        recalls: [
          { recallId: '4', title: 'FDA Recall 1', source: 'FDA', hasImage: true, addedAt: new Date() },
          { recallId: '5', title: 'FDA Recall 2', source: 'FDA', hasImage: false, addedAt: new Date() },
          { recallId: '6', title: 'FDA Recall 3', source: 'FDA', hasImage: true, addedAt: new Date() },
          { recallId: '7', title: 'FDA Recall 4', source: 'FDA', hasImage: true, addedAt: new Date() },
          { recallId: '8', title: 'FDA Recall 5', source: 'FDA', hasImage: true, addedAt: new Date() },
          { recallId: '9', title: 'FDA Recall 6', source: 'FDA', hasImage: false, addedAt: new Date() },
          { recallId: '10', title: 'FDA Recall 7', source: 'FDA', hasImage: false, addedAt: new Date() },
          { recallId: '11', title: 'FDA Recall 8', source: 'FDA', hasImage: true, addedAt: new Date() }
        ],
        scheduledFor: null, // Manual send only
        imageStats: { total: 8, withImages: 5 }
      });
    } catch (error) {
      console.error('Failed to load queues:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreview = async (queueType: 'USDA_DAILY' | 'FDA_WEEKLY') => {
    console.log('Preview queue:', queueType);
    // TODO: Implement preview modal
  };

  const handleSendNow = async (queueType: 'USDA_DAILY' | 'FDA_WEEKLY') => {
    if (confirm(`Are you sure you want to send the ${queueType === 'USDA_DAILY' ? 'USDA' : 'FDA'} queue now?`)) {
      console.log('Sending queue:', queueType);
      // TODO: Implement send
      await loadQueues();
    }
  };

  const handleCancel = async (queueType: 'USDA_DAILY' | 'FDA_WEEKLY') => {
    const queueName = queueType === 'USDA_DAILY' ? 'USDA daily' : 'FDA weekly';
    if (confirm(`Are you sure you want to cancel and delete the ${queueName} queue? This cannot be undone.`)) {
      console.log('Cancelling queue:', queueType);
      // TODO: Implement cancel
      await loadQueues();
    }
  };

  const formatScheduleTime = (date: Date | null, queueType: 'USDA_DAILY' | 'FDA_WEEKLY') => {
    if (queueType === 'FDA_WEEKLY') {
      return 'Manual send required';
    }
    if (!date) return 'Not scheduled';
    
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    
    if (isToday) {
      return `Today ${date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit', 
        timeZoneName: 'short' 
      })}`;
    }
    
    return date.toLocaleString('en-US', { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric',
      hour: 'numeric', 
      minute: '2-digit',
      timeZoneName: 'short'
    });
  };

  const renderQueue = (queue: QueueData | null, title: string) => {
    if (!queue) {
      return (
        <div className={styles.queueCard} style={{ 
          backgroundColor: currentTheme.cardBackground,
          borderColor: currentTheme.cardBorder 
        }}>
          <h3 className={styles.queueTitle} style={{ color: currentTheme.text }}>
            {title}
          </h3>
          <div className={styles.emptyQueue} style={{ color: currentTheme.textSecondary }}>
            No recalls in queue
          </div>
        </div>
      );
    }

    const isUSDA = queue.type === 'USDA_DAILY';

    return (
      <div className={styles.queueCard} style={{ 
        backgroundColor: currentTheme.cardBackground,
        borderColor: currentTheme.cardBorder 
      }}>
        <div className={styles.queueHeader}>
          <h3 className={styles.queueTitle} style={{ color: currentTheme.text }}>
            {title}
          </h3>
          <span 
            className={styles.queueBadge}
            style={{ 
              backgroundColor: `${currentTheme.info}20`,
              color: currentTheme.info
            }}
          >
            {queue.recalls.length} recalls pending
          </span>
        </div>

        {/* Queue Status */}
        <div className={styles.queueStatus}>
          <div className={styles.statusItem}>
            <span className={styles.statusLabel} style={{ color: currentTheme.textSecondary }}>
              Next Run:
            </span>
            <span className={styles.statusValue} style={{ 
              color: isUSDA ? currentTheme.warning : currentTheme.text 
            }}>
              {formatScheduleTime(queue.scheduledFor, queue.type)}
            </span>
          </div>
          
          <div className={styles.statusItem}>
            <span className={styles.statusLabel} style={{ color: currentTheme.textSecondary }}>
              Image Status:
            </span>
            <span className={styles.statusValue} style={{ 
              color: queue.imageStats.withImages === queue.imageStats.total 
                ? currentTheme.success 
                : currentTheme.warning 
            }}>
              {queue.imageStats.withImages} of {queue.imageStats.total} have images
            </span>
          </div>
        </div>

        {/* Recall List Preview */}
        <div className={styles.recallPreview}>
          <h4 className={styles.previewTitle} style={{ color: currentTheme.text }}>
            Queued Recalls:
          </h4>
          <div className={styles.recallList}>
            {queue.recalls.slice(0, 3).map((recall) => (
              <div key={recall.recallId} className={styles.recallItem}>
                <span style={{ color: currentTheme.text }}>{recall.title}</span>
                {recall.hasImage ? (
                  <span className={styles.hasImage} style={{ color: currentTheme.success }}>Image</span>
                ) : (
                  <span className={styles.noImage} style={{ color: currentTheme.warning }}>No Image</span>
                )}
              </div>
            ))}
            {queue.recalls.length > 3 && (
              <div className={styles.moreRecalls} style={{ color: currentTheme.textSecondary }}>
                +{queue.recalls.length - 3} more recalls
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className={styles.queueActions}>
          <Button
            onClick={() => handlePreview(queue.type)}
            variant="secondary"
            size="small"
          >
            Preview
          </Button>
          <Button
            onClick={() => handleSendNow(queue.type)}
            variant="primary"
            size="small"
          >
            Send Now
          </Button>
          <Button
            onClick={() => handleCancel(queue.type)}
            variant="secondary"
            size="small"
          >
            {isUSDA ? 'Cancel Today' : 'Cancel Queue'}
          </Button>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading} style={{ color: currentTheme.textSecondary }}>
          Loading queues...
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.description} style={{ color: currentTheme.textSecondary }}>
        Manage automatic email queues created by sync services. USDA queue auto-sends at 5pm ET daily, 
        while FDA queue requires manual sending.
      </div>
      
      <div className={styles.queuesGrid}>
        {renderQueue(usdaQueue, 'USDA Daily Queue')}
        {renderQueue(fdaQueue, 'FDA Weekly Queue')}
      </div>
    </div>
  );
}