import { X, Search, Plus, Bell, User } from 'lucide-react';

interface KeyboardShortcutsProps {
  isOpen: boolean;
  onClose: () => void;
}

const shortcuts = [
  {
    category: 'Navigation',
    items: [
      { keys: ['⌘', 'K'], description: 'Open global search', icon: Search },
      { keys: ['⌘', '⇧', 'A'], description: 'Open quick actions', icon: Plus },
      { keys: ['⌘', '⇧', 'N'], description: 'Open notifications', icon: Bell },

    ]
  },
  {
    category: 'Tickets',
    items: [
      { keys: ['G', 'T'], description: 'Go to tickets page' },
      { keys: ['C'], description: 'Create new ticket' },
      { keys: ['E'], description: 'Edit selected ticket' },
      { keys: ['A'], description: 'Assign ticket' },
    ]
  },
  {
    category: 'General',
    items: [
      { keys: ['?'], description: 'Show keyboard shortcuts' },
      { keys: ['Esc'], description: 'Close modal/menu' },
      { keys: ['↑', '↓'], description: 'Navigate lists' },
      { keys: ['Enter'], description: 'Select item' },
    ]
  }
];

export function KeyboardShortcuts({ isOpen, onClose }: KeyboardShortcutsProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-medium text-gray-900">Keyboard Shortcuts</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-md transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6">
          {shortcuts.map((category) => (
            <div key={category.category}>
              <h4 className="text-sm font-medium text-gray-900 mb-3">{category.category}</h4>
              <div className="space-y-2">
                {category.items.map((shortcut, index) => (
                  <div key={index} className="flex items-center justify-between py-2">
                    <div className="flex items-center">
                      {shortcut.icon && (
                        <div className="p-1 bg-gray-100 rounded mr-3">
                          <shortcut.icon className="h-4 w-4 text-gray-600" />
                        </div>
                      )}
                      <span className="text-sm text-gray-700">{shortcut.description}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      {shortcut.keys.map((key, keyIndex) => (
                        <kbd
                          key={keyIndex}
                          className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded"
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            Press <kbd className="px-1 py-0.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded">?</kbd> anytime to show this dialog
          </p>
        </div>
      </div>
    </div>
  );
}