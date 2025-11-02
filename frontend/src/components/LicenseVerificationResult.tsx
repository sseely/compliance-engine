'use client';

import styles from './LicenseVerificationResult.module.scss';

interface LicenseInfo {
  licenseNumber: string;
  licenseType: string;
  state: string;
  firstName: string;
  lastName: string;
  issueDate?: string;
  expirationDate?: string;
  status: 'active' | 'expired' | 'suspended' | 'revoked' | 'pending';
  board?: string;
  specialties?: string[];
  disciplinaryActions?: DisciplinaryAction[];
}

interface DisciplinaryAction {
  date: string;
  type: string;
  description: string;
  status: 'active' | 'resolved';
}

interface VerificationResult {
  verified: boolean;
  confidence: number; // 0-100
  licenseInfo?: LicenseInfo;
  lastUpdated: string;
  sources?: string[];
  warnings?: string[];
  errors?: string[];
}

interface LicenseVerificationResultProps {
  result: VerificationResult;
  onReset: () => void;
}

const getStatusBadgeClass = (status: string): string => {
  switch (status) {
    case 'active':
      return styles.statusSuccess;
    case 'pending':
      return styles.statusWarning;
    case 'expired':
    case 'suspended':
    case 'revoked':
      return styles.statusError;
    default:
      return styles.statusNeutral;
  }
};

const getConfidenceColor = (confidence: number): string => {
  if (confidence >= 90) return 'var(--color-success)';
  if (confidence >= 70) return 'var(--color-warning)';
  return 'var(--color-error)';
};

const formatDate = (dateString: string): string => {
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return dateString;
  }
};

export default function LicenseVerificationResult({ result, onReset }: LicenseVerificationResultProps) {
  const { verified, confidence, licenseInfo, lastUpdated, sources, warnings, errors } = result;

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        {/* Header with main verification status */}
        <div className={styles.header}>
          <div className={styles.statusSection}>
            <div className={verified ? styles.verifiedIcon : styles.unverifiedIcon}>
              {verified ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              )}
            </div>
            <div>
              <h2 className={styles.statusTitle}>
                {verified ? 'License Verified' : 'Verification Failed'}
              </h2>
              <div className={styles.confidence}>
                <span className={styles.confidenceLabel}>Confidence:</span>
                <span 
                  className={styles.confidenceValue}
                  style={{ color: getConfidenceColor(confidence) }}
                >
                  {confidence}%
                </span>
                <div className={styles.confidenceBar}>
                  <div 
                    className={styles.confidenceProgress}
                    style={{ 
                      width: `${confidence}%`,
                      backgroundColor: getConfidenceColor(confidence)
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
          
          <button 
            onClick={onReset}
            className={styles.newSearchButton}
            aria-label="Start new verification"
          >
            New Search
          </button>
        </div>

        {/* License Information */}
        {licenseInfo && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>License Information</h3>
            
            <div className={styles.infoGrid}>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>License Number:</span>
                <span className={styles.infoValue}>{licenseInfo.licenseNumber}</span>
              </div>
              
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Type:</span>
                <span className={styles.infoValue}>{licenseInfo.licenseType}</span>
              </div>
              
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>State:</span>
                <span className={styles.infoValue}>{licenseInfo.state}</span>
              </div>
              
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Licensee:</span>
                <span className={styles.infoValue}>
                  {licenseInfo.firstName} {licenseInfo.lastName}
                </span>
              </div>
              
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Status:</span>
                <span className={`${styles.statusBadge} ${getStatusBadgeClass(licenseInfo.status)}`}>
                  {licenseInfo.status.charAt(0).toUpperCase() + licenseInfo.status.slice(1)}
                </span>
              </div>
              
              {licenseInfo.board && (
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Licensing Board:</span>
                  <span className={styles.infoValue}>{licenseInfo.board}</span>
                </div>
              )}
              
              {licenseInfo.issueDate && (
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Issue Date:</span>
                  <span className={styles.infoValue}>{formatDate(licenseInfo.issueDate)}</span>
                </div>
              )}
              
              {licenseInfo.expirationDate && (
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Expiration Date:</span>
                  <span className={styles.infoValue}>{formatDate(licenseInfo.expirationDate)}</span>
                </div>
              )}
            </div>

            {/* Specialties */}
            {licenseInfo.specialties && licenseInfo.specialties.length > 0 && (
              <div className={styles.specialtiesSection}>
                <h4 className={styles.subsectionTitle}>Specialties</h4>
                <div className={styles.specialtyList}>
                  {licenseInfo.specialties.map((specialty, index) => (
                    <span key={index} className={styles.specialtyTag}>
                      {specialty}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Disciplinary Actions */}
            {licenseInfo.disciplinaryActions && licenseInfo.disciplinaryActions.length > 0 && (
              <div className={styles.disciplinarySection}>
                <h4 className={styles.subsectionTitle}>Disciplinary Actions</h4>
                <div className={styles.disciplinaryList}>
                  {licenseInfo.disciplinaryActions.map((action, index) => (
                    <div key={index} className={styles.disciplinaryItem}>
                      <div className={styles.disciplinaryHeader}>
                        <span className={styles.disciplinaryType}>{action.type}</span>
                        <span className={styles.disciplinaryDate}>{formatDate(action.date)}</span>
                        <span className={`${styles.statusBadge} ${getStatusBadgeClass(action.status)}`}>
                          {action.status}
                        </span>
                      </div>
                      <p className={styles.disciplinaryDescription}>{action.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Warnings */}
        {warnings && warnings.length > 0 && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Warnings</h3>
            <div className={styles.alertList}>
              {warnings.map((warning, index) => (
                <div key={index} className={`${styles.alert} ${styles.alertWarning}`}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
                  </svg>
                  {warning}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Errors */}
        {errors && errors.length > 0 && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Errors</h3>
            <div className={styles.alertList}>
              {errors.map((error, index) => (
                <div key={index} className={`${styles.alert} ${styles.alertError}`}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                  </svg>
                  {error}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sources and Metadata */}
        <div className={styles.footer}>
          <div className={styles.metadata}>
            <p className={styles.lastUpdated}>
              Last updated: {formatDate(lastUpdated)}
            </p>
            {sources && sources.length > 0 && (
              <details className={styles.sources}>
                <summary className={styles.sourcesToggle}>
                  Data Sources ({sources.length})
                </summary>
                <ul className={styles.sourcesList}>
                  {sources.map((source, index) => (
                    <li key={index} className={styles.sourceItem}>
                      {source}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}