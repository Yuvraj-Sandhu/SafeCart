import { RecallDigest } from './templates/RecallDigest';

// Sample data for preview
const sampleRecalls = [
  {
    id: 'sample-1',
    title: 'Ready-To-Eat Ground Beef Recalled for Possible Foreign Matter Contamination',
    company: 'Ada Valley Gourmet Foods',
    recallDate: '2025-07-29',
    classification: 'Class I',
    description: '20-lb. cardboard box cases containing four 5-lb. plastic bags of &quot;Ada Valley FULLY COOKED GROUND BEEF&quot; with Pack Date 5/28/25 with lot code 35156 or Pack Date 5/30/25 with lot code 35157 represented on the label.',
    reason: 'Product Contamination',
    primaryImage: 'https://storage.googleapis.com/safecart-930e5.firebasestorage.app/recall-images/jv54Ck2dU1lJGGQylUU1/Recall-027-2025-Label.pdf_page_1.png',
    recallUrl: 'https://safecart.app/recall/sample-1',
    source: 'USDA' as const
  },
  {
    id: 'sample-2',
    title: 'Reisman\'s Chocolate Croissants Recalled',
    company: 'Reisman Bros Bakery',
    recallDate: '2024-08-06',
    classification: 'Class II',
    description: 'Reisman\'s Chocolate Croissants 3 oz.',
    reason: 'Undeclared wheat',
    primaryImage: 'https://storage.googleapis.com/safecart-930e5.firebasestorage.app/fda-recall-images/UNKNOWN_97247/uploaded_1755048946780_dsmyqt7u8_0.png',
    recallUrl: 'https://safecart.app/recall/sample-2',
    source: 'FDA' as const
  },
  {
    id: 'sample-3',
    title: 'Ready-to-Eat Ham Salad Recalled for Possible Listeria Contamination',
    company: 'Reser\'s Fine Foods, Inc.',
    recallDate: '2024-07-27',
    classification: 'Class I',
    description: '12-oz. printed plastic tubs containing “RESER’S FINE FOODS Ham Salad” with sell by dates of 09/01/25., • 5-lb. clear plastic tubs containing “Molly’s Kitchen Ham Salad” with sell by dates of 08/31/25.',
    reason: 'Product Contamination',
    primaryImage: 'https://storage.googleapis.com/safecart-930e5.firebasestorage.app/recall-images/gAKx8x1YPecgjgQwr72f/PHA-07272025-01-Labels.pdf_page_1.png',
    recallUrl: 'https://safecart.app/recall/sample-3',
    source: 'USDA' as const
  }
];

export default function RecallDigestPreview() {
  return (
    <RecallDigest
      user={{
        name: 'John Doe',
        email: 'john@example.com',
        unsubscribeToken: 'sample-token-123456789'
      }}
      state="California"
      recalls={sampleRecalls}
      digestDate={new Date().toISOString()}
      isTest={false}
    />
  );
}

// Test email version
export function RecallDigestTestPreview() {
  return (
    <RecallDigest
      user={{
        name: 'Jane Smith',
        email: 'jane@example.com',
        unsubscribeToken: 'test-token-987654321'
      }}
      state="Texas (and 2 other states)"
      recalls={sampleRecalls.slice(0, 2)}
      digestDate={new Date().toISOString()}
      isTest={true}
    />
  );
}

// No recalls version
export function RecallDigestEmptyPreview() {
  return (
    <RecallDigest
      user={{
        name: 'Bob Johnson',
        email: 'bob@example.com',
        unsubscribeToken: 'empty-token-555555555'
      }}
      state="Wyoming"
      recalls={[]}
      digestDate={new Date().toISOString()}
      isTest={false}
    />
  );
}