import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Search, 
  Filter, 
  MoreVertical, 
  Clock, 
  AlertTriangle, 
  CheckCircle,
  User,
  Calendar,
  Tag,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Ticket, TicketFilters, TicketSortOptions, Priority, TicketStatus, TicketCategory } from '../../types/ticket';
import { useTickets } from '../../hooks/useTickets';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

interface TicketListProps {
  onTicketSelect?: (ticket: Ticket) => void;
  selectedTickets?: string[];
  onSelectionChange?: (ticketIds: string[]) => void;
  showBulkActions?: boolean;
}

const priorityColors = {
  critical: 'bg-red-100 text-red-800 border-red-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  low: 'bg-green-100 text-green-800 border-green-200',
};

const statusColors = {
  open: 'bg-blue-100 text-blue-800 border-blue-200',
  in_progress: 'bg-purple-100 text-purple-800 border-purple-200',
  pending_customer: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  pending_vendor: 'bg-orange-100 text-orange-800 border-orange-200',
  resolved: 'bg-green-100 text-green-800 border-green-200',
  closed: 'bg-gray-100 text-gray-800 border-gray-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200',
};

const categoryIcons = {
  hardware: '🖥️',
  software: '💻',
  network: '🌐',
  security: '🔒',
  access: '🔑',
  email: '📧',
  printer: '🖨️',
  phone: '📞',
  other: '❓',
};

export function TicketList({ 
  onTicketSelect, 
  selectedTickets = [], 
  onSelectionChange,
  showBulkActions = false 
}: TicketListProps) {
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<TicketFilters>({});
  const [sort, setSort] = useState<TicketSortOptions>({ field: 'createdAt', direction: 'desc' });
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading, error, refetch } = useTickets({ 
    page, 
    limit: 20, 
    search, 
    filters, 
    sort 
  });

  const handleTicketSelect = (ticketId: string) => {
    if (!onSelectionChange) return;
    
    const newSelection = selectedTickets.includes(ticketId)
      ? selectedTickets.filter(id => id !== ticketId)
      : [...selectedTickets, ticketId];
    
    onSelectionChange(newSelection);
  };

  // Removed handleSelectAll as it's not currently used in the UI

  const getSLARiskColor = (riskScore: number) => {
    if (riskScore >= 0.8) return 'text-red-600';
    if (riskScore >= 0.5) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getSLARiskIcon = (riskScore: number) => {
    if (riskScore >= 0.8) return <AlertTriangle className="h-4 w-4" />;
    if (riskScore >= 0.5) return <Clock className="h-4 w-4" />;
    return <CheckCircle className="h-4 w-4" />;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="card animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="text-center py-8">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error loading tickets</h3>
          <p className="text-gray-500 mb-4">
            Failed to load tickets from server. Using offline data.
          </p>
          <button 
            onClick={() => refetch()}
            className="btn-primary"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search tickets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </button>
          
          <button
            onClick={() => setSort(prev => ({ 
              ...prev, 
              direction: prev.direction === 'asc' ? 'desc' : 'asc' 
            }))}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <ArrowUpDown className="h-4 w-4 mr-2" />
            Sort
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="card">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                multiple
                className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                onChange={(e) => {
                  const values = Array.from(e.target.selectedOptions, option => option.value) as TicketStatus[];
                  setFilters(prev => ({ ...prev, status: values }));
                }}
              >
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="pending_customer">Pending Customer</option>
                <option value="pending_vendor">Pending Vendor</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
              <select
                multiple
                className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                onChange={(e) => {
                  const values = Array.from(e.target.selectedOptions, option => option.value) as Priority[];
                  setFilters(prev => ({ ...prev, priority: values }));
                }}
              >
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
              <select
                multiple
                className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                onChange={(e) => {
                  const values = Array.from(e.target.selectedOptions, option => option.value) as TicketCategory[];
                  setFilters(prev => ({ ...prev, category: values }));
                }}
              >
                <option value="hardware">Hardware</option>
                <option value="software">Software</option>
                <option value="network">Network</option>
                <option value="security">Security</option>
                <option value="email">Email</option>
                <option value="printer">Printer</option>
                <option value="phone">Phone</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => setFilters({})}
              className="btn-secondary mr-2"
            >
              Clear Filters
            </button>
          </div>
        </div>
      )}

      {/* Bulk Actions */}
      {showBulkActions && selectedTickets.length > 0 && (
        <div className="card bg-blue-50 border-blue-200">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-900">
              {selectedTickets.length} ticket{selectedTickets.length !== 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
              <button className="btn-secondary text-sm">Assign</button>
              <button className="btn-secondary text-sm">Change Status</button>
              <button className="btn-secondary text-sm">Add Tags</button>
            </div>
          </div>
        </div>
      )}

      {/* Ticket List */}
      <div className="space-y-4">
        {data?.tickets.map((ticket) => (
          <div key={ticket.id} className="card hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-4 flex-1">
                {showBulkActions && (
                  <input
                    type="checkbox"
                    checked={selectedTickets.includes(ticket.id)}
                    onChange={() => handleTicketSelect(ticket.id)}
                    className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                )}
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-lg">{categoryIcons[ticket.category]}</span>
                    <Link
                      to={`/tickets/${ticket.id}`}
                      className="text-lg font-medium text-gray-900 hover:text-primary-600 truncate"
                      onClick={() => onTicketSelect?.(ticket)}
                    >
                      {ticket.title}
                    </Link>
                    <span className="text-sm text-gray-500">#{ticket.externalId}</span>
                  </div>
                  
                  <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                    {ticket.description}
                  </p>
                  
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${priorityColors[ticket.priority]}`}>
                      {ticket.priority}
                    </span>
                    
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusColors[ticket.status]}`}>
                      {ticket.status.replace('_', ' ')}
                    </span>
                    
                    <div className="flex items-center text-gray-500">
                      <User className="h-4 w-4 mr-1" />
                      <span>{ticket.customerName}</span>
                    </div>
                    
                    {ticket.assignedTechnicianName && (
                      <div className="flex items-center text-gray-500">
                        <span>→</span>
                        <span className="ml-1">{ticket.assignedTechnicianName}</span>
                      </div>
                    )}
                    
                    <div className="flex items-center text-gray-500">
                      <Calendar className="h-4 w-4 mr-1" />
                      <span>{formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })}</span>
                    </div>
                  </div>
                  
                  {ticket.tags.length > 0 && (
                    <div className="flex items-center gap-1 mt-2">
                      <Tag className="h-3 w-3 text-gray-400" />
                      {ticket.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex items-center space-x-2 ml-4">
                <div className={`flex items-center ${getSLARiskColor(ticket.aiInsights.slaRiskScore)}`}>
                  {getSLARiskIcon(ticket.aiInsights.slaRiskScore)}
                  <span className="ml-1 text-sm font-medium">
                    {Math.round(ticket.aiInsights.slaRiskScore * 100)}%
                  </span>
                </div>
                
                <button className="p-1 rounded-full hover:bg-gray-100">
                  <MoreVertical className="h-4 w-4 text-gray-400" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, data.total)} of {data.total} results
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              className="p-2 rounded-md border border-gray-300 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            
            <span className="px-3 py-2 text-sm font-medium">
              Page {page} of {data.totalPages}
            </span>
            
            <button
              onClick={() => setPage(page + 1)}
              disabled={page === data.totalPages}
              className="p-2 rounded-md border border-gray-300 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {data?.tickets.length === 0 && (
        <div className="card">
          <div className="text-center py-8">
            <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No tickets found</h3>
            <p className="text-gray-500">
              {search || Object.keys(filters).length > 0
                ? 'Try adjusting your search or filters.'
                : 'No tickets have been created yet.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}