import { Metadata } from 'next';
import RecallDetailClient from './RecallDetailClient';
import { api } from '@/services/api';

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
  { params }: { params: { id: string } }
): Promise<Metadata> {
  const recall = await getRecallData(params.id);
  
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

export default async function RecallDetailPage({ params }: { params: { id: string } }) {
  const recall = await getRecallData(params.id);
  return <RecallDetailClient initialRecall={recall} recallId={params.id} />;
}

