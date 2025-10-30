import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Clock, 
  User, 
  Tag, 
  AlertTriangle, 
  CheckCircle,
  MessageSquare,
  Paperclip,
  Send,
  EyeOff,
  MoreVertical,
  Edit,
  Star
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import { Ticket, TicketComment, TicketActivity } from '../../types/ticket';
import { useTicket, useTicketComments, useTicketActivity, useAddComment } from '../../hooks/useTickets';

// Mock data for development
const mockTicket: Ticket = {
  id: '1',
  externalId: 'TKT-001',
  title: 'Email server not responding',
  description: 'Users across Bangalore and Mumbai offices are unable to send or receive emails. The exchange server appears to be down. This has been affecting multiple departments since this morning around 9 AM IST. The IT team has been notified but we need immediate assistance as this is impacting business operations and client communications.',
  category: 'email',
  priority: 'critical',
  status: 'in_progress',
  customerId: 'cust-1',
  customerName: 'Tata Consultancy Services',
  assignedTechnicianId: 'tech-1',
  assignedTechnicianName: 'Rajesh Kumar',
  createdAt: '2024-01-15T09:00:00Z',
  updatedAt: '2024-01-15T10:30:00Z',
  slaDeadline: '2024-01-15T13:00:00Z',
  estimatedResolutionTime: 240, // 4 hours
  tags: ['email', 'server', 'critical', 'exchange', 'bangalore', 'mumbai'],
  attachments: [
    {
      id: '1',
      filename: 'error_screenshot.png',
      url: '/attachments/error_screenshot.png',
      size: 1024000,
      mimeType: 'image/png'
    }
  ],
  aiInsights: {
    triageConfidence: 0.95,
    suggestedCategory: 'email',
    slaRiskScore: 0.8,
    resolutionSuggestions: [
      {
        id: '1',
        title: 'Restart Exchange Services',
        description: 'Try restarting the Microsoft Exchange services on the server. This resolves 85% of similar issues in our Indian offices.',
        confidence: 0.85,
        source: 'knowledge_base'
      },
      {
        id: '2',
        title: 'Check Disk Space',
        description: 'Verify that the Exchange server has sufficient disk space. Low disk space can cause service failures, especially during peak business hours.',
        confidence: 0.72,
        source: 'historical_tickets'
      }
    ],
    similarTickets: ['2', '5']
  }
};

const mockComments: TicketComment[] = [
  {
    id: '1',
    ticketId: '1',
    authorId: 'tech-1',
    authorName: 'Rajesh Kumar',
    content: 'I\'ve started investigating the issue. Checking the Exchange server logs now. Will coordinate with both Bangalore and Mumbai office teams.',
    isInternal: false,
    createdAt: '2024-01-15T09:15:00Z'
  },
  {
    id: '2',
    ticketId: '1',
    authorId: 'tech-1',
    authorName: 'Rajesh Kumar',
    content: 'Found the issue - the Exchange Information Store service has stopped. This seems to be affecting both data centers. Attempting to restart it now.',
    isInternal: true,
    createdAt: '2024-01-15T10:00:00Z'
  },
  {
    id: '3',
    ticketId: '1',
    authorId: 'customer-1',
    authorName: 'Suresh Menon (TCS)',
    content: 'Thank you for the update. How long do you estimate this will take to resolve? We have client calls scheduled and need email access urgently.',
    isInternal: false,
    createdAt: '2024-01-15T10:15:00Z'
  }
];

const mockActivity: TicketActivity[] = [
  {
    id: '1',
    ticketId: '1',
    type: 'created',
    description: 'Ticket created',
    performedBy: 'System',
    performedAt: '2024-01-15T09:00:00Z'
  },
  {
    id: '2',
    ticketId: '1',
    type: 'assigned',
    description: 'Assigned to Rajesh Kumar',
    performedBy: 'AI Triage System',
    performedAt: '2024-01-15T09:05:00Z'
  },
  {
    id: '3',
    ticketId: '1',
    type: 'status_changed',
    description: 'Status changed from Open to In Progress',
    performedBy: 'Rajesh Kumar',
    performedAt: '2024-01-15T09:15:00Z'
  }
];

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

export function TicketDetail() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const [activeTab, setActiveTab] = useState<'comments' | 'activity' | 'suggestions'>('comments');
  const [newComment, setNewComment] = useState('');
  const [isInternalComment, setIsInternalComment] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Fetch ticket data using hooks
  const { data: ticket, isLoading: ticketLoading, error: ticketError } = useTicket(ticketId || '');
  const { data: comments = [], isLoading: commentsLoading } = useTicketComments(ticketId || '');
  const { data: activity = [], isLoading: activityLoading } = useTicketActivity(ticketId || '');
  const addCommentMutation = useAddComment();

  // Fallback to mock data if API fails or in development
  const displayTicket = ticket || mockTicket;
  const displayComments = comments.length > 0 ? comments : mockComments;
  const displayActivity = activity.length > 0 ? activity : mockActivity;

  const getSLARiskColor = (riskScore: number) => {
    if (riskScore >= 0.8) return 'text-red-600';
    if (riskScore >= 0.5) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getSLARiskIcon = (riskScore: number) => {
    if (riskScore >= 0.8) return <AlertTriangle className="h-5 w-5" />;
    if (riskScore >= 0.5) return <Clock className="h-5 w-5" />;
    return <CheckCircle className="h-5 w-5" />;
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !ticketId) return;
    
    try {
      await addCommentMutation.mutateAsync({
        ticketId,
        content: newComment,
        isInternal: isInternalComment
      });
      setNewComment('');
      setIsInternalComment(false);
      toast.success('Comment added successfully');
    } catch (error) {
      console.error('Failed to add comment:', error);
      toast.error('Failed to add comment. Please try again.');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Loading state
  if (ticketLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <div className="h-8 w-8 bg-gray-200 rounded animate-pulse"></div>
          <div className="space-y-2">
            <div className="h-6 bg-gray-200 rounded w-64 animate-pulse"></div>
            <div className="h-4 bg-gray-200 rounded w-32 animate-pulse"></div>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="card">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-4 animate-pulse"></div>
              <div className="h-32 bg-gray-200 rounded animate-pulse"></div>
            </div>
          </div>
          <div className="space-y-6">
            <div className="card">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-4 animate-pulse"></div>
              <div className="space-y-3">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-3 bg-gray-200 rounded animate-pulse"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (ticketError) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Link
            to="/tickets"
            className="p-2 rounded-md hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Ticket Not Found</h1>
            <p className="text-sm text-gray-500">The requested ticket could not be loaded</p>
          </div>
        </div>
        <div className="card">
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Error loading ticket</h3>
            <p className="text-gray-500 mb-4">
              {ticketError instanceof Error ? ticketError.message : 'An unexpected error occurred'}
            </p>
            <Link to="/tickets" className="btn-primary">
              Back to Tickets
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!displayTicket) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Link
            to="/tickets"
            className="p-2 rounded-md hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Ticket Not Found</h1>
            <p className="text-sm text-gray-500">The requested ticket does not exist</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link
            to="/tickets"
            className="p-2 rounded-md hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{displayTicket.title}</h1>
            <p className="text-sm text-gray-500">Ticket #{displayTicket.externalId}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="btn-secondary"
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </button>
          <button className="p-2 rounded-md hover:bg-gray-100">
            <MoreVertical className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Ticket Details */}
          <div className="card">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-2">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${priorityColors[displayTicket.priority]}`}>
                  {displayTicket.priority}
                </span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusColors[displayTicket.status]}`}>
                  {displayTicket.status.replace('_', ' ')}
                </span>
              </div>
              
              <div className={`flex items-center ${getSLARiskColor(displayTicket.aiInsights.slaRiskScore)}`}>
                {getSLARiskIcon(displayTicket.aiInsights.slaRiskScore)}
                <span className="ml-2 text-sm font-medium">
                  SLA Risk: {Math.round(displayTicket.aiInsights.slaRiskScore * 100)}%
                </span>
              </div>
            </div>
            
            <div className="prose max-w-none">
              <p className="text-gray-700 leading-relaxed">{displayTicket.description}</p>
            </div>
            
            {displayTicket.attachments.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Attachments</h4>
                <div className="space-y-2">
                  {displayTicket.attachments.map((attachment) => (
                    <div key={attachment.id} className="flex items-center space-x-2 p-2 bg-gray-50 rounded-md">
                      <Paperclip className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-900">{attachment.filename}</span>
                      <span className="text-xs text-gray-500">({formatFileSize(attachment.size)})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {displayTicket.tags.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-gray-400" />
                  {displayTicket.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="card">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8">
                <button
                  onClick={() => setActiveTab('comments')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'comments'
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <MessageSquare className="h-4 w-4 inline mr-2" />
                  Comments ({displayComments.length})
                </button>
                <button
                  onClick={() => setActiveTab('activity')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'activity'
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Clock className="h-4 w-4 inline mr-2" />
                  Activity ({displayActivity.length})
                </button>
                <button
                  onClick={() => setActiveTab('suggestions')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'suggestions'
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Star className="h-4 w-4 inline mr-2" />
                  AI Suggestions ({displayTicket.aiInsights.resolutionSuggestions.length})
                </button>
              </nav>
            </div>

            <div className="mt-6">
              {activeTab === 'comments' && (
                <div className="space-y-6">
                  {/* Comments List */}
                  <div className="space-y-4">
                    {commentsLoading ? (
                      <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="flex space-x-3 animate-pulse">
                            <div className="h-8 w-8 bg-gray-200 rounded-full"></div>
                            <div className="flex-1">
                              <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                              <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      displayComments.map((comment) => (
                      <div key={comment.id} className="flex space-x-3">
                        <div className="flex-shrink-0">
                          <div className="h-8 w-8 rounded-full bg-primary-600 flex items-center justify-center">
                            <User className="h-5 w-5 text-white" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <p className="text-sm font-medium text-gray-900">{comment.authorName}</p>
                            {comment.isInternal && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                                <EyeOff className="h-3 w-3 mr-1" />
                                Internal
                              </span>
                            )}
                            <p className="text-sm text-gray-500">
                              {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                            </p>
                          </div>
                          <div className="mt-1">
                            <p className="text-sm text-gray-700">{comment.content}</p>
                          </div>
                        </div>
                      </div>
                      ))
                    )}
                  </div>

                  {/* Add Comment */}
                  <div className="border-t border-gray-200 pt-6">
                    <div className="flex space-x-3">
                      <div className="flex-shrink-0">
                        <div className="h-8 w-8 rounded-full bg-primary-600 flex items-center justify-center">
                          <User className="h-5 w-5 text-white" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <textarea
                          rows={3}
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          placeholder="Add a comment..."
                          className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                        />
                        <div className="mt-3 flex items-center justify-between">
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={isInternalComment}
                              onChange={(e) => setIsInternalComment(e.target.checked)}
                              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                            />
                            <span className="ml-2 text-sm text-gray-700">Internal comment</span>
                          </label>
                          <button
                            onClick={handleAddComment}
                            disabled={!newComment.trim() || addCommentMutation.isLoading}
                            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Send className="h-4 w-4 mr-2" />
                            {addCommentMutation.isLoading ? 'Adding...' : 'Add Comment'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'activity' && (
                <div className="space-y-4">
                  {activityLoading ? (
                    <div className="space-y-4">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="flex space-x-3 animate-pulse">
                          <div className="h-8 w-8 bg-gray-200 rounded-full"></div>
                          <div className="flex-1">
                            <div className="h-4 bg-gray-200 rounded w-2/3 mb-1"></div>
                            <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    displayActivity.map((item) => (
                    <div key={item.id} className="flex space-x-3">
                      <div className="flex-shrink-0">
                        <div className="h-8 w-8 rounded-full bg-gray-400 flex items-center justify-center">
                          <Clock className="h-4 w-4 text-white" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900">{item.description}</p>
                        <p className="text-sm text-gray-500">
                          by {item.performedBy} • {formatDistanceToNow(new Date(item.performedAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'suggestions' && (
                <div className="space-y-4">
                  {displayTicket.aiInsights.resolutionSuggestions.map((suggestion) => (
                    <div key={suggestion.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="text-sm font-medium text-gray-900">{suggestion.title}</h4>
                          <p className="text-sm text-gray-600 mt-1">{suggestion.description}</p>
                          <div className="flex items-center mt-2 space-x-4">
                            <span className="text-xs text-gray-500">
                              Confidence: {Math.round(suggestion.confidence * 100)}%
                            </span>
                            <span className="text-xs text-gray-500">
                              Source: {suggestion.source.replace('_', ' ')}
                            </span>
                          </div>
                        </div>
                        <button className="btn-secondary text-sm ml-4">
                          Apply
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Ticket Info */}
          <div className="card">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Ticket Information</h3>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-medium text-gray-500">Customer</dt>
                <dd className="text-sm text-gray-900">{displayTicket.customerName}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Assigned Technician</dt>
                <dd className="text-sm text-gray-900">{displayTicket.assignedTechnicianName || 'Unassigned'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Created</dt>
                <dd className="text-sm text-gray-900">
                  {format(new Date(displayTicket.createdAt), 'MMM d, yyyy h:mm a')}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
                <dd className="text-sm text-gray-900">
                  {format(new Date(displayTicket.updatedAt), 'MMM d, yyyy h:mm a')}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">SLA Deadline</dt>
                <dd className="text-sm text-gray-900">
                  {format(new Date(displayTicket.slaDeadline), 'MMM d, yyyy h:mm a')}
                </dd>
              </div>
              {displayTicket.estimatedResolutionTime && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Estimated Resolution</dt>
                  <dd className="text-sm text-gray-900">
                    {Math.round(displayTicket.estimatedResolutionTime / 60)} hours
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Quick Actions */}
          <div className="card">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <button className="w-full btn-primary">
                Change Status
              </button>
              <button className="w-full btn-secondary">
                Reassign Ticket
              </button>
              <button className="w-full btn-secondary">
                Update Priority
              </button>
              <button className="w-full btn-secondary">
                Add Time Entry
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}