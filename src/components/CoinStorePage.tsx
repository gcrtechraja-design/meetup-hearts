import React from 'react';
import { WalletModal } from './WalletModal';

interface CoinStorePageProps {
  onClose?: () => void;
}

export const CoinStorePage: React.FC<CoinStorePageProps> = ({ onClose }) => {
  return <WalletModal onClose={onClose || (() => {})} />;
};

export default CoinStorePage;
