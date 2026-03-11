import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({ isOpen, onClose, title, children }) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 z-50 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[20px] z-50 max-h-[90vh] overflow-y-auto pb-safe shadow-2xl"
          >
            <div className="sticky top-0 bg-white z-10 px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
              <div className="w-10 h-1 bg-neutral-300 rounded-full absolute top-2 left-1/2 -translate-x-1/2" />
              <h3 className="text-lg font-bold text-neutral-900 mt-2">{title}</h3>
              <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded-full transition-colors mt-2">
                <X size={20} className="text-neutral-600" />
              </button>
            </div>
            <div className="p-6">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
