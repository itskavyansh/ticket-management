import { useState, useEffect, useRef } from 'react';
import { Search, X, Clock, User, Ticket } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

interface SearchResult {
  id: string;
  type: 'ticket' | 'technician' | 'customer';
  title: string;
  subtitle: string;
  url: string;
  icon: React.ComponentType<any>;
}

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

const mockSearchResults: SearchResult[] = [
  {
    id: '1',
    type: 'ticket',
    title: 'Email server not responding',
    subtitle: 'TKT-001 • Critical • Tata Consultancy Services',
    url: '/tickets/1',
    icon: Ticket
  },
  {
    id: '2',
    type: 'technician',
    title: 'Rajesh Kumar',
    subtitle: 'IT Support • 5 active tickets • Bangalore',
    url: '/technicians',
    icon: User
  },
  {
    id: '3',
    type: 'ticket',
    title: 'Printer not working in accounts',
    subtitle: 'TKT-002 • Medium • Infosys Limited',
    url: '/tickets/2',
    icon: Ticket
  },
  {
    id: '4',
    type: 'customer',
    title: 'Wipro Technologies',
    subtitle: '12 open tickets • Enterprise customer',
    url: '/customers/wipro',
    icon: User
  },
  {
    id: '5',
    type: 'ticket',
    title: 'VPN connection issues',
    subtitle: 'TKT-003 • High • Wipro Technologies',
    url: '/tickets/3',
    icon: Ticket
  },
  {
    id: '6',
    type: 'technician',
    title: 'Priya Sharma',
    subtitle: 'Network Admin • 8 active tickets • Mumbai',
    url: '/technicians',
    icon: User
  },
  {
    id: '7',
    type: 'ticket',
    title: 'SAP system running slow',
    subtitle: 'TKT-004 • High • Reliance Industries',
    url: '/tickets/4',
    icon: Ticket
  },
  {
    id: '8',
    type: 'technician',
    title: 'Amit Patel',
    subtitle: 'Network Admin • 5 active tickets • Pune',
    url: '/technicians',
    icon: User
  }
];

export function GlobalSearch({ isOpen, onClose }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (query.trim()) {
      // Simulate search
      const filtered = mockSearchResults.filter(result =>
        result.title.toLowerCase().includes(query.toLowerCase()) ||
        result.subtitle.toLowerCase().includes(query.toLowerCase())
      );
      setResults(filtered);
      setSelectedIndex(0);
    } else {
      setResults([]);
    }
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      // Navigate to selected result
      const result = results[selectedIndex];
      onClose();
      navigate(result.url);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 z-50">
      <div className="fixed top-20 left-1/2 transform -translate-x-1/2 w-full max-w-2xl">
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
          {/* Search Input */}
          <div className="flex items-center px-4 py-3 border-b border-gray-200">
            <Search className="h-5 w-5 text-gray-400 mr-3" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search tickets, technicians, customers..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 outline-none text-gray-900 placeholder-gray-500"
            />
            <button
              onClick={onClose}
              className="p-1 rounded-full hover:bg-gray-100"
            >
              <X className="h-4 w-4 text-gray-400" />
            </button>
          </div>

          {/* Search Results */}
          {results.length > 0 && (
            <div className="max-h-96 overflow-y-auto">
              {results.map((result, index) => {
                const Icon = result.icon;
                return (
                  <Link
                    key={result.id}
                    to={result.url}
                    onClick={onClose}
                    className={`flex items-center px-4 py-3 hover:bg-gray-50 transition-colors ${
                      index === selectedIndex ? 'bg-blue-50 border-r-2 border-blue-500' : ''
                    }`}
                  >
                    <div className="p-2 bg-gray-100 rounded-lg mr-3">
                      <Icon className="h-4 w-4 text-gray-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {result.title}
                      </p>
                      <p className="text-sm text-gray-500 truncate">
                        {result.subtitle}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* No Results */}
          {query.trim() && results.length === 0 && (
            <div className="px-4 py-8 text-center">
              <Search className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No results found for "{query}"</p>
            </div>
          )}

          {/* Recent Searches or Suggestions */}
          {!query.trim() && (
            <div className="px-4 py-3">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Recent Searches
              </p>
              <div className="space-y-1">
                <div className="flex items-center text-sm text-gray-600 hover:text-gray-900 cursor-pointer">
                  <Clock className="h-4 w-4 mr-2" />
                  Email server issues
                </div>
                <div className="flex items-center text-sm text-gray-600 hover:text-gray-900 cursor-pointer">
                  <Clock className="h-4 w-4 mr-2" />
                  John Smith technician
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-200">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <div className="flex items-center space-x-4">
                <span>↑↓ Navigate</span>
                <span>↵ Select</span>
                <span>Esc Close</span>
              </div>
              <span>Search powered by AI</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}