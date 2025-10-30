import { useState } from 'react';
import { 
  Users, 
  Tag, 
  AlertCircle, 
  CheckCircle, 
  X,
  ChevronDown
} from 'lucide-react';
import { BulkOperation, TicketStatus, Priority } from '../../types/ticket';
import { useBulkUpdateTickets } from '../../hooks/useTickets';
import toast from 'react-hot-toast';

interface BulkOperationsProps {
  selectedTickets: string[];
  onOperationComplete: () => void;
  onClose: () => void;
}

interface Technician {
  id: string;
  name: string;
  email: string;
  currentWorkload: number;
  maxCapacity: number;
}

// Mock technicians data
const mockTechnicians: Technician[] = [
  { id: 'tech-1', name: 'Rajesh Kumar', email: 'rajesh.kumar@techsolutions.in', currentWorkload: 5, maxCapacity: 10 },
  { id: 'tech-2', name: 'Priya Sharma', email: 'priya.sharma@techsolutions.in', currentWorkload: 3, maxCapacity: 8 },
  { id: 'tech-3', name: 'Amit Patel', email: 'amit.patel@techsolutions.in', currentWorkload: 7, maxCapacity: 12 },
  { id: 'tech-4', name: 'Sneha Reddy', email: 'sneha.reddy@techsolutions.in', currentWorkload: 2, maxCapacity: 8 },
  { id: 'tech-5', name: 'Vikram Singh', email: 'vikram.singh@techsolutions.in', currentWorkload: 6, maxCapacity: 10 },
];

export function BulkOperations({ selectedTickets, onOperationComplete, onClose }: BulkOperationsProps) {
  const [activeOperation, setActiveOperation] = useState<string | null>(null);
  const bulkUpdateMutation = useBulkUpdateTickets();
  
  // Form states for different operations
  const [assignTechnician, setAssignTechnician] = useState('');
  const [newStatus, setNewStatus] = useState<TicketStatus>('open');
  const [newPriority, setNewPriority] = useState<Priority>('medium');
  const [tagsToAdd, setTagsToAdd] = useState('');
  const [tagsToRemove, setTagsToRemove] = useState('');

  const handleOperation = async (operation: BulkOperation) => {
    try {
      await bulkUpdateMutation.mutateAsync(operation);
      onOperationComplete();
      setActiveOperation(null);
      
      // Show success message based on operation type
      const operationNames = {
        assign: 'assigned',
        status_change: 'status updated',
        priority_change: 'priority updated',
        add_tags: 'tags added',
        remove_tags: 'tags removed'
      };
      
      toast.success(`Successfully ${operationNames[operation.type]} for ${selectedTickets.length} ticket${selectedTickets.length > 1 ? 's' : ''}`);
    } catch (error) {
      console.error('Bulk operation failed:', error);
      toast.error('Bulk operation failed. Please try again.');
    }
  };

  const handleAssignTickets = () => {
    if (!assignTechnician) return;
    
    handleOperation({
      type: 'assign',
      ticketIds: selectedTickets,
      payload: { technicianId: assignTechnician }
    });
  };

  const handleStatusChange = () => {
    handleOperation({
      type: 'status_change',
      ticketIds: selectedTickets,
      payload: { status: newStatus }
    });
  };

  const handlePriorityChange = () => {
    handleOperation({
      type: 'priority_change',
      ticketIds: selectedTickets,
      payload: { priority: newPriority }
    });
  };

  const handleAddTags = () => {
    if (!tagsToAdd.trim()) return;
    
    const tags = tagsToAdd.split(',').map(tag => tag.trim()).filter(Boolean);
    handleOperation({
      type: 'add_tags',
      ticketIds: selectedTickets,
      payload: { tags }
    });
  };

  const handleRemoveTags = () => {
    if (!tagsToRemove.trim()) return;
    
    const tags = tagsToRemove.split(',').map(tag => tag.trim()).filter(Boolean);
    handleOperation({
      type: 'remove_tags',
      ticketIds: selectedTickets,
      payload: { tags }
    });
  };

  const operations = [
    {
      id: 'assign',
      title: 'Assign Technician',
      description: 'Assign selected tickets to a technician',
      icon: Users,
      color: 'blue'
    },
    {
      id: 'status',
      title: 'Change Status',
      description: 'Update the status of selected tickets',
      icon: CheckCircle,
      color: 'green'
    },
    {
      id: 'priority',
      title: 'Change Priority',
      description: 'Update the priority of selected tickets',
      icon: AlertCircle,
      color: 'orange'
    },
    {
      id: 'add_tags',
      title: 'Add Tags',
      description: 'Add tags to selected tickets',
      icon: Tag,
      color: 'purple'
    },
    {
      id: 'remove_tags',
      title: 'Remove Tags',
      description: 'Remove tags from selected tickets',
      icon: Tag,
      color: 'red'
    }
  ];

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Bulk Operations</h3>
            <p className="text-sm text-gray-500">
              {selectedTickets.length} ticket{selectedTickets.length !== 1 ? 's' : ''} selected
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-md transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {!activeOperation ? (
          <div className="grid grid-cols-1 gap-4">
            {operations.map((operation) => {
              const Icon = operation.icon;
              return (
                <button
                  key={operation.id}
                  onClick={() => setActiveOperation(operation.id)}
                  className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
                >
                  <div className={`p-2 rounded-md bg-${operation.color}-100 mr-4`}>
                    <Icon className={`h-5 w-5 text-${operation.color}-600`} />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-900">{operation.title}</h4>
                    <p className="text-sm text-gray-500">{operation.description}</p>
                  </div>
                  <ChevronDown className="h-5 w-5 text-gray-400 ml-auto rotate-[-90deg]" />
                </button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-6">
            <button
              onClick={() => setActiveOperation(null)}
              className="flex items-center text-sm text-gray-500 hover:text-gray-700"
            >
              ← Back to operations
            </button>

            {activeOperation === 'assign' && (
              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-4">Assign Technician</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Technician
                    </label>
                    <select
                      value={assignTechnician}
                      onChange={(e) => setAssignTechnician(e.target.value)}
                      className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="">Choose a technician...</option>
                      {mockTechnicians.map((tech) => (
                        <option key={tech.id} value={tech.id}>
                          {tech.name} ({tech.currentWorkload}/{tech.maxCapacity} tickets)
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                    <p className="text-sm text-blue-800">
                      This will assign all {selectedTickets.length} selected tickets to the chosen technician.
                    </p>
                  </div>
                  
                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={() => setActiveOperation(null)}
                      className="btn-secondary"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAssignTickets}
                      disabled={!assignTechnician || bulkUpdateMutation.isLoading}
                      className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {bulkUpdateMutation.isLoading ? 'Assigning...' : 'Assign Tickets'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeOperation === 'status' && (
              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-4">Change Status</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      New Status
                    </label>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value as TicketStatus)}
                      className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="open">Open</option>
                      <option value="in_progress">In Progress</option>
                      <option value="pending_customer">Pending Customer</option>
                      <option value="pending_vendor">Pending Vendor</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>
                  
                  <div className="bg-green-50 border border-green-200 rounded-md p-3">
                    <p className="text-sm text-green-800">
                      This will change the status of all {selectedTickets.length} selected tickets to "{newStatus.replace('_', ' ')}".
                    </p>
                  </div>
                  
                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={() => setActiveOperation(null)}
                      className="btn-secondary"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleStatusChange}
                      disabled={bulkUpdateMutation.isLoading}
                      className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {bulkUpdateMutation.isLoading ? 'Updating...' : 'Update Status'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeOperation === 'priority' && (
              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-4">Change Priority</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      New Priority
                    </label>
                    <select
                      value={newPriority}
                      onChange={(e) => setNewPriority(e.target.value as Priority)}
                      className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                  
                  <div className="bg-orange-50 border border-orange-200 rounded-md p-3">
                    <p className="text-sm text-orange-800">
                      This will change the priority of all {selectedTickets.length} selected tickets to "{newPriority}".
                    </p>
                  </div>
                  
                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={() => setActiveOperation(null)}
                      className="btn-secondary"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handlePriorityChange}
                      disabled={bulkUpdateMutation.isLoading}
                      className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {bulkUpdateMutation.isLoading ? 'Updating...' : 'Update Priority'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeOperation === 'add_tags' && (
              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-4">Add Tags</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tags to Add
                    </label>
                    <input
                      type="text"
                      value={tagsToAdd}
                      onChange={(e) => setTagsToAdd(e.target.value)}
                      placeholder="Enter tags separated by commas (e.g., urgent, hardware, server)"
                      className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      Separate multiple tags with commas
                    </p>
                  </div>
                  
                  <div className="bg-purple-50 border border-purple-200 rounded-md p-3">
                    <p className="text-sm text-purple-800">
                      This will add the specified tags to all {selectedTickets.length} selected tickets.
                    </p>
                  </div>
                  
                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={() => setActiveOperation(null)}
                      className="btn-secondary"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddTags}
                      disabled={!tagsToAdd.trim() || bulkUpdateMutation.isLoading}
                      className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {bulkUpdateMutation.isLoading ? 'Adding...' : 'Add Tags'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeOperation === 'remove_tags' && (
              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-4">Remove Tags</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tags to Remove
                    </label>
                    <input
                      type="text"
                      value={tagsToRemove}
                      onChange={(e) => setTagsToRemove(e.target.value)}
                      placeholder="Enter tags to remove separated by commas"
                      className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      Separate multiple tags with commas
                    </p>
                  </div>
                  
                  <div className="bg-red-50 border border-red-200 rounded-md p-3">
                    <p className="text-sm text-red-800">
                      This will remove the specified tags from all {selectedTickets.length} selected tickets.
                    </p>
                  </div>
                  
                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={() => setActiveOperation(null)}
                      className="btn-secondary"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleRemoveTags}
                      disabled={!tagsToRemove.trim() || bulkUpdateMutation.isLoading}
                      className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {bulkUpdateMutation.isLoading ? 'Removing...' : 'Remove Tags'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}