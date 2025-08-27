import { Metadata } from 'next';
import RecallDetailPageContent from './RecallDetailPageContent';
import { api } from '@/services/api';
import { Header } from '@/components/Header';
import styles from '../../page.module.css';
import { use } from 'react';

interface RecallDetail {
  id: string;
  recallNumber: string;
  source: 'USDA' | 'FDA';
  title: string;
  company: string;
  summary: string;
  recallDate: string;
  riskLevel: string;
  affectedStates: string[];
  isActive: boolean;
  images: any[];
  primaryImage?: string;
  recallUrl?: string;
}

async function getRecallData(id: string): Promise<RecallDetail | null> {
  try {
    const data = await api.getRecallById(id);
    return data.recall;
  } catch (error) {
    console.error('Error fetching recall:', error);
    return null;
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params;
  const recall = await getRecallData(id);
  
  if (!recall) {
    return {
      title: 'Recall Not Found - SafeCart',
      description: 'The requested recall could not be found.',
    };
  }

  const description = `${recall.company} - ${recall.summary.substring(0, 150)}...`;
  const imageUrl = recall.primaryImage || recall.images?.[0]?.storageUrl || '/default-recall-image.jpg';
  
  return {
    title: `${recall.title} - SafeCart Food Recall`,
    description,
    openGraph: {
      title: recall.title,
      description,
      type: 'article',
      publishedTime: recall.recallDate,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: recall.title,
        },
      ],
      siteName: 'SafeCart',
    },
    twitter: {
      card: 'summary_large_image',
      title: recall.title,
      description,
      images: [imageUrl],
    },
  };
}

export default async function RecallDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const recall = await getRecallData(id);
  
  return (
    <main className={styles.main}>
      <Header subtitle="Food Recall Details" />
      <div className="container">
        <RecallDetailPageContent initialRecall={recall} recallId={id} />
      </div>
    </main>
  );
}

