import { useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { TicketList } from '../components/tickets/TicketList';
import { TicketDetail } from '../components/tickets/TicketDetail';
import { BulkOperations } from '../components/tickets/BulkOperations';
import { Ticket } from '../types/ticket';

export function Tickets() {
  const [selectedTickets, setSelectedTickets] = useState<string[]>([]);
  const [showBulkOperations, setShowBulkOperations] = useState(false);
  const navigate = useNavigate();

  const handleTicketSelect = (ticket: Ticket) => {
    navigate(`/tickets/${ticket.id}`);
  };

  const handleSelectionChange = (ticketIds: string[]) => {
    setSelectedTickets(ticketIds);
  };

  const handleBulkOperationComplete = () => {
    setSelectedTickets([]);
    setShowBulkOperations(false);
    // In a real app, you might want to refetch the tickets data here
  };

  return (
    <Routes>
      <Route path="/" element={
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Tickets</h1>
              <p className="text-gray-600 mt-1">Manage and track customer support tickets</p>
            </div>
            <div className="flex items-center space-x-3">
              {selectedTickets.length > 0 && (
                <button
                  onClick={() => setShowBulkOperations(true)}
                  className="btn-secondary"
                >
                  Bulk Actions ({selectedTickets.length})
                </button>
              )}
              <button className="btn-primary">
                <Plus className="h-4 w-4 mr-2" />
                New Ticket
              </button>
            </div>
          </div>

          <TicketList
            onTicketSelect={handleTicketSelect}
            selectedTickets={selectedTickets}
            onSelectionChange={handleSelectionChange}
            showBulkActions={true}
          />

          {showBulkOperations && (
            <BulkOperations
              selectedTickets={selectedTickets}
              onOperationComplete={handleBulkOperationComplete}
              onClose={() => setShowBulkOperations(false)}
            />
          )}
        </div>
      } />
      <Route path="/:ticketId" element={<TicketDetail />} />
    </Routes>
  );
}