import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  serverTimestamp, 
  increment 
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { Transaction } from '../types';

export interface CoinStorePlan {
  coins: number;
  amount: number;
  popular?: boolean;
}

export const COIN_STORE_PLANS: CoinStorePlan[] = [
  { coins: 100, amount: 99 },
  { coins: 500, amount: 399, popular: true },
];

/**
 * Fetch the current admin-configured UPI ID from Firestore settings collection.
 * Document ID: payment_config, Field: upi_id
 * If not found or empty, throws Error('Payment config not found')
 */
export async function getAdminUpiId(): Promise<string> {
  const docRef = doc(db, 'settings', 'payment_config');
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    const data = snap.data();
    if (data && typeof data.upi_id === 'string' && data.upi_id.trim()) {
      return data.upi_id.trim();
    }
  }
  throw new Error('Payment config not found');
}

/**
 * Update the admin-configured UPI ID in Firestore settings collection
 * Document ID: payment_config, Field: upi_id
 */
export async function updateAdminUpiId(newUpiId: string): Promise<void> {
  const cleanId = (newUpiId || '').trim();
  if (!cleanId || !cleanId.includes('@')) {
    throw new Error('Please enter a valid UPI ID (e.g. name@bank)');
  }
  const docRef = doc(db, 'settings', 'payment_config');
  await setDoc(docRef, {
    upi_id: cleanId,
    updated_at: serverTimestamp()
  }, { merge: true });
}

/**
 * Submit manual UPI payment for verification
 * Validates UTR is not empty and is exactly 12 numeric digits
 */
export async function submitManualPayment(params: {
  userId: string;
  coins: number;
  amount: number;
  utr: string;
  upiIdUsed: string;
}): Promise<string> {
  const cleanUtr = (params.utr || '').trim();

  // Validation: do not allow to create transaction if UTR number is empty
  if (!cleanUtr) {
    throw new Error('Please enter UTR number');
  }

  // Validate UTR is 12 digits
  if (!/^\d{12}$/.test(cleanUtr)) {
    throw new Error('Please enter a valid 12-digit numeric UTR number.');
  }

  if (!params.upiIdUsed) {
    throw new Error('Payment config not found');
  }

  const txData = {
    userId: params.userId,
    coins: params.coins,
    amount: params.amount,
    utr: cleanUtr,
    upi_id_used: params.upiIdUsed,
    status: 'pending' as const,
    createdAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, 'transactions'), txData);
  return docRef.id;
}

/**
 * Fetch all pending transactions for admin verification, sorted newest first
 */
export async function getPendingTransactions(): Promise<Transaction[]> {
  try {
    let q;
    try {
      q = query(
        collection(db, 'transactions'),
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      const list: Transaction[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as Transaction);
      });
      return list;
    } catch {
      // Fallback query in case composite index is still propagating
      q = query(
        collection(db, 'transactions'),
        where('status', '==', 'pending')
      );
      const snap = await getDocs(q);
      const list: Transaction[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as Transaction);
      });
      list.sort((a, b) => {
        const timeA = a.createdAt?.seconds || (a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0);
        const timeB = b.createdAt?.seconds || (b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0);
        return timeB - timeA;
      });
      return list;
    }
  } catch (err) {
    console.error('Error fetching pending transactions:', err);
    return [];
  }
}

/**
 * Approve a pending transaction
 */
export async function approveTransaction(txId: string, userId: string, coins: number): Promise<void> {
  // Update users/{userId} doc: increment coin_balance and coins_balance
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    coin_balance: increment(coins),
    coins_balance: increment(coins),
  });

  // Update transactions/{docId}: set status = 'verified'
  const txRef = doc(db, 'transactions', txId);
  await updateDoc(txRef, {
    status: 'verified',
    verifiedAt: serverTimestamp(),
  });
}

/**
 * Reject a pending transaction
 */
export async function rejectTransaction(txId: string): Promise<void> {
  const txRef = doc(db, 'transactions', txId);
  await updateDoc(txRef, {
    status: 'rejected',
    rejectedAt: serverTimestamp(),
  });
}
