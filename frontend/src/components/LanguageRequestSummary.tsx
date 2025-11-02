'use client';

import { useState, useEffect } from 'react';
import { API_CONFIG } from '@/constants';

interface LanguageSummary {
  language_code: string;
  request_count: number;
  unique_ips: number;
  unique_sessions: number;
  first_request: string;
  last_request: string;
  last_request_date: string;
}

interface LanguageRequestSummaryProps {
  apiUrl?: string;
  className?: string;
}

export default function LanguageRequestSummary({ 
  apiUrl = process.env.NEXT_PUBLIC_API_URL || API_CONFIG.DEFAULT_BASE_URL,
  className 
}: LanguageRequestSummaryProps) {
  const [data, setData] = useState<LanguageSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLanguageData();
  }, []);

  const fetchLanguageData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${apiUrl}/api/v1/analytics/language-requests/summary`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      setData(result.data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch language data');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getLanguageName = (code: string) => {
    const languageNames: Record<string, string> = {
      'fr': 'French',
      'de': 'German', 
      'pt': 'Portuguese',
      'it': 'Italian',
      'zh-cn': 'Chinese (Simplified)',
      'zh-tw': 'Chinese (Traditional)',
      'ja': 'Japanese',
      'ko': 'Korean',
      'ar': 'Arabic',
      'hi': 'Hindi',
      'ru': 'Russian',
      'nl': 'Dutch',
      'sv': 'Swedish',
      'da': 'Danish',
      'no': 'Norwegian',
      'fi': 'Finnish',
      'pl': 'Polish',
      'tr': 'Turkish',
      'he': 'Hebrew',
      'th': 'Thai',
      'vi': 'Vietnamese'
    };
    
    return languageNames[code.toLowerCase()] || code.toUpperCase();
  };

  if (loading) {
    return <div className="loading">Loading language request data...</div>;
  }

  if (error) {
    return (
      <div className="error">
        <p>Error loading data: {error}</p>
        <button onClick={fetchLanguageData} className="retryButton">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={`language-request-summary-container ${className || ''}`}>
      <div className="language-request-summary-header">
        <h2>Language Support Requests</h2>
        <p>Global platform data: Languages requested by users across all customers</p>
        <button onClick={fetchLanguageData} className="refreshButton">
          Refresh Data
        </button>
      </div>

      {data.length === 0 ? (
        <div className="empty">
          No language requests recorded yet.
        </div>
      ) : (
        <div className="table">
          <div className="tableHeader">
            <div>Language</div>
            <div>Code</div>
            <div>Requests</div>
            <div>Unique IPs</div>
            <div>Sessions</div>
            <div>Last Request</div>
          </div>
          
          {data.map((item) => (
            <div key={item.language_code} className="tableRow">
              <div className="languageName">
                {getLanguageName(item.language_code)}
              </div>
              <div className="languageCode">
                {item.language_code}
              </div>
              <div className="requestCount">
                {item.request_count}
              </div>
              <div className="uniqueIps">
                {item.unique_ips}
              </div>
              <div className="uniqueSessions">
                {item.unique_sessions}
              </div>
              <div className="lastRequest">
                {formatDate(item.last_request)}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="footer">
        <p>
          <strong>Platform Admin View:</strong> This shows global language requests across all customers. 
          Each user can only vote once per session for each language.
          Heavy users may contribute multiple votes across different sessions.
        </p>
      </div>
    </div>
  );
}