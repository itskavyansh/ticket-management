import React, { useState, useEffect } from 'react';
import { Upload, Download, FileText, Database, Cloud, Activity } from 'lucide-react';

interface StorageMetrics {
  mongodb: {
    tickets: number;
    users: number;
    technicians: number;
  };
  dynamodb: {
    tickets: number;
    users: number;
    technicians: number;
  };
  s3: {
    logs: number;
    reports: number;
    knowledgeBase: number;
  };
}

interface StorageHealth {
  mongodb: boolean;
  dynamodb: boolean;
  s3: boolean;
}

const StorageManager: React.FC = () => {
  const [metrics, setMetrics] = useState<StorageMetrics | null>(null);
  const [health, setHealth] = useState<StorageHealth | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchStorageData();
  }, []);

  const fetchStorageData = async () => {
    setLoading(true);
    try {
      // Fetch storage metrics
      const metricsResponse = await fetch('/api/storage/metrics', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (metricsResponse.ok) {
        const metricsData = await metricsResponse.json();
        setMetrics(metricsData.data);
      }

      // Fetch storage health
      const healthResponse = await fetch('/api/storage/health', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (healthResponse.ok) {
        const healthData = await healthResponse.json();
        setHealth(healthData.data);
      }

      // Fetch file list
      const filesResponse = await fetch('/api/storage/files', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (filesResponse.ok) {
        const filesData = await filesResponse.json();
        setFiles(filesData.data.files);
      }

    } catch (error) {
      console.error('Failed to fetch storage data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('folder', 'uploads');

      const response = await fetch('/api/storage/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        console.log('File uploaded:', result.data);
        setSelectedFile(null);
        fetchStorageData(); // Refresh data
      } else {
        console.error('Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setUploading(false);
    }
  };

  const generateReport = async () => {
    try {
      const reportData = {
        reportType: 'storage-summary',
        data: {
          timestamp: new Date().toISOString(),
          metrics,
          health,
          totalFiles: files.length
        }
      };

      const response = await fetch('/api/storage/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(reportData)
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Report generated:', result.data);
        fetchStorageData(); // Refresh data
      }
    } catch (error) {
      console.error('Failed to generate report:', error);
    }
  };

  const getHealthIcon = (isHealthy: boolean) => {
    return isHealthy ? (
      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
    ) : (
      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Storage Management</h2>
        <button
          onClick={fetchStorageData}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Activity className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Storage Health */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Database className="w-5 h-5" />
          Storage Health
        </h3>
        {health && (
          <div className="grid grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              {getHealthIcon(health.mongodb)}
              <div>
                <div className="font-medium">MongoDB</div>
                <div className="text-sm text-gray-600">Primary Database</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              {getHealthIcon(health.dynamodb)}
              <div>
                <div className="font-medium">DynamoDB</div>
                <div className="text-sm text-gray-600">Analytics & Backup</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              {getHealthIcon(health.s3)}
              <div>
                <div className="font-medium">S3</div>
                <div className="text-sm text-gray-600">File Storage</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Storage Metrics */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Cloud className="w-5 h-5" />
          Storage Metrics
        </h3>
        {metrics && (
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-3">Database Records</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>MongoDB Tickets:</span>
                  <span className="font-mono">{metrics.mongodb.tickets}</span>
                </div>
                <div className="flex justify-between">
                  <span>DynamoDB Tickets:</span>
                  <span className="font-mono">{metrics.dynamodb.tickets}</span>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-medium mb-3">S3 Files</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Logs:</span>
                  <span className="font-mono">{metrics.s3.logs}</span>
                </div>
                <div className="flex justify-between">
                  <span>Reports:</span>
                  <span className="font-mono">{metrics.s3.reports}</span>
                </div>
                <div className="flex justify-between">
                  <span>Knowledge Base:</span>
                  <span className="font-mono">{metrics.s3.knowledgeBase}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* File Upload */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Upload className="w-5 h-5" />
          File Upload
        </h3>
        <div className="space-y-4">
          <div>
            <input
              type="file"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>
          <button
            onClick={handleFileUpload}
            disabled={!selectedFile || uploading}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            {uploading ? 'Uploading...' : 'Upload to S3'}
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Actions
        </h3>
        <div className="flex gap-4">
          <button
            onClick={generateReport}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            Generate Storage Report
          </button>
        </div>
      </div>

      {/* Recent Files */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Download className="w-5 h-5" />
          Recent Files ({files.length})
        </h3>
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {files.slice(0, 10).map((file, index) => (
            <div key={index} className="text-sm text-gray-600 font-mono bg-gray-50 p-2 rounded">
              {file}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StorageManager;