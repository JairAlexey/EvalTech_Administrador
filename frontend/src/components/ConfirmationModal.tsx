import { AlertTriangle } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmButtonText: string;
  cancelButtonText: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDestructive?: boolean;
}

export default function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmButtonText,
  cancelButtonText,
  onConfirm,
  onCancel,
  isDestructive = false
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900 bg-opacity-50">
      <div className="w-full max-w-md bg-white rounded-lg shadow-xl overflow-hidden">
        <div className={`px-6 py-4 ${isDestructive ? 'bg-red-50' : 'bg-gray-50'}`}>
          <div className="flex items-center gap-3">
            {isDestructive && (
              <div className="flex-shrink-0 bg-red-100 rounded-full p-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
            )}
            <h3 className={`text-lg font-medium ${isDestructive ? 'text-red-900' : 'text-gray-900'}`}>
              {title}
            </h3>
          </div>
        </div>

        <div className="px-6 py-4">
          <p className="text-sm text-gray-600">{message}</p>
        </div>

        <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          >
            {cancelButtonText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-md shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              isDestructive
                ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
            }`}
          >
            {confirmButtonText}
          </button>
        </div>
      </div>
    </div>
  );
}