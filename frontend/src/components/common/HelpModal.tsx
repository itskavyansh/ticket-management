import { X, Book, MessageCircle, Mail, ExternalLink, Video, FileText } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const helpResources = [
  {
    title: 'Getting Started Guide',
    description: 'Learn the basics of using the AI Ticket Management Platform',
    icon: Book,
    type: 'guide',
    action: 'Read Guide'
  },
  {
    title: 'Video Tutorials',
    description: 'Watch step-by-step video tutorials for common tasks',
    icon: Video,
    type: 'video',
    action: 'Watch Videos'
  },
  {
    title: 'API Documentation',
    description: 'Technical documentation for developers and integrations',
    icon: FileText,
    type: 'docs',
    action: 'View Docs'
  },
  {
    title: 'Live Chat Support',
    description: 'Get instant help from our support team',
    icon: MessageCircle,
    type: 'chat',
    action: 'Start Chat',
    available: true
  },
  {
    title: 'Email Support',
    description: 'Send us an email and we\'ll get back to you within 24 hours',
    icon: Mail,
    type: 'email',
    action: 'Send Email'
  }
];

const commonQuestions = [
  {
    question: 'How do I create a new ticket?',
    answer: 'Click the "+" button in the top navigation or use Ctrl+Shift+A to open quick actions.'
  },
  {
    question: 'How do I assign a ticket to a technician?',
    answer: 'Open the ticket details and click "Assign" or use bulk operations to assign multiple tickets.'
  },
  {
    question: 'What are SLA alerts?',
    answer: 'SLA alerts notify you when tickets are at risk of breaching their service level agreements.'
  },
  {
    question: 'How do I search for tickets?',
    answer: 'Use the search bar in the top navigation or press Ctrl+K for global search.'
  }
];

export function HelpModal({ isOpen, onClose }: HelpModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-medium text-gray-900">Help & Support</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-md transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Help Resources */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-4">Help Resources</h4>
            <div className="space-y-3">
              {helpResources.map((resource, index) => {
                const Icon = resource.icon;
                return (
                  <div
                    key={index}
                    className="flex items-start p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <div className="p-2 bg-blue-100 rounded-lg mr-4">
                      <Icon className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h5 className="text-sm font-medium text-gray-900">{resource.title}</h5>
                        {resource.available && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            Available
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{resource.description}</p>
                      <button className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 mt-2">
                        {resource.action}
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Common Questions */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-4">Common Questions</h4>
            <div className="space-y-4">
              {commonQuestions.map((qa, index) => (
                <div key={index} className="border-b border-gray-200 pb-4 last:border-b-0">
                  <h5 className="text-sm font-medium text-gray-900 mb-2">{qa.question}</h5>
                  <p className="text-sm text-gray-600">{qa.answer}</p>
                </div>
              ))}
            </div>

            {/* Contact Info */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h5 className="text-sm font-medium text-gray-900 mb-2">Need More Help?</h5>
              <p className="text-sm text-gray-600 mb-3">
                Our support team is available 24/7 IST to help you with any questions.
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center">
                  <Mail className="h-4 w-4 text-gray-400 mr-2" />
                  <span className="text-gray-600">support@techsolutions.in</span>
                </div>
                <div className="flex items-center">
                  <MessageCircle className="h-4 w-4 text-gray-400 mr-2" />
                  <span className="text-gray-600">Live chat available (9 AM - 9 PM IST)</span>
                </div>
                <div className="flex items-center">
                  <span className="text-gray-400 mr-2">📞</span>
                  <span className="text-gray-600">+91 80 4567 8900 (Bangalore)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-500">
            AI Ticket Management Platform v1.0.0 • Made in India • Last updated: January 2024
          </p>
        </div>
      </div>
    </div>
  );
}