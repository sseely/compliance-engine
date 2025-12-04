'use client';

import { useEffect } from 'react';
import type { LicenseVerificationResultProps } from '@/types';
import { getStatusBadgeClass, getConfidenceColor, formatDate, capitalize } from '@/utils';
import { useAriaAnnouncements } from '@/hooks/useAccessibility';
import { CONFIDENCE_THRESHOLDS, ICON_SIZES } from '@/constants';

export default function LicenseVerificationResult({ result, onReset }: LicenseVerificationResultProps) {
  const { verified, confidence, licenseInfo, lastUpdated, sources, warnings, errors } = result;
  const { announceFormSuccess } = useAriaAnnouncements();
  
  // Announce verification result to screen readers
  useEffect(() => {
    const message = verified 
      ? `License verification successful with ${confidence}% confidence`
      : `License verification failed with ${confidence}% confidence`;
    announceFormSuccess(message);
  }, [verified, confidence, announceFormSuccess]);

  return (
    <div className="license-verification-result-container">
      <div className="license-verification-result-card">
        {/* Header with main verification status */}
        <div className="license-verification-result-header">
          <div className="license-verification-result-status-section">
            <div 
              className={verified ? "verifiedIcon" : "unverifiedIcon"}
              role="img"
              aria-label={verified ? 'Verification successful' : 'Verification failed'}
            >
              {verified ? (
                <svg width={ICON_SIZES.MEDIUM} height={ICON_SIZES.MEDIUM} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                </svg>
              ) : (
                <svg width={ICON_SIZES.MEDIUM} height={ICON_SIZES.MEDIUM} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              )}
            </div>
            <div>
              <h2 className="statusTitle">
                {verified ? 'License Verified' : 'Verification Failed'}
              </h2>
              <div className="confidence">
                <span className="confidenceLabel">Confidence:</span>
                <span 
                  className="confidenceValue"
                  style={{ color: getConfidenceColor(confidence) }}
                  aria-describedby="confidence-bar"
                >
                  {confidence}%
                </span>
                <div 
                  className="confidenceBar"
                  role="progressbar"
                  aria-valuenow={confidence}
                  aria-valuemin={CONFIDENCE_THRESHOLDS.MIN}
                  aria-valuemax={CONFIDENCE_THRESHOLDS.MAX}
                  aria-label={`Verification confidence: ${confidence} percent`}
                  id="confidence-bar"
                >
                  <div 
                    className="confidenceProgress"
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
            className="newSearchButton"
            aria-label="Start new verification"
          >
            New Search
          </button>
        </div>

        {/* License Information */}
        {licenseInfo && (
          <div className="section">
            <h3 className="sectionTitle">License Information</h3>
            
            <div className="infoGrid">
              <div className="infoItem">
                <span className="infoLabel">License Number:</span>
                <span className="infoValue">{licenseInfo.licenseNumber}</span>
              </div>
              
              <div className="infoItem">
                <span className="infoLabel">Type:</span>
                <span className="infoValue">{licenseInfo.licenseType}</span>
              </div>
              
              <div className="infoItem">
                <span className="infoLabel">State:</span>
                <span className="infoValue">{licenseInfo.state}</span>
              </div>
              
              <div className="infoItem">
                <span className="infoLabel">Licensee:</span>
                <span className="infoValue">
                  {licenseInfo.firstName} {licenseInfo.lastName}
                </span>
              </div>
              
              <div className="infoItem">
                <span className="infoLabel">Status:</span>
                <span className={`statusBadge ${getStatusBadgeClass(licenseInfo.status, {})}`}>
                  {capitalize(licenseInfo.status)}
                </span>
              </div>
              
              {licenseInfo.board && (
                <div className="infoItem">
                  <span className="infoLabel">Licensing Board:</span>
                  <span className="infoValue">{licenseInfo.board}</span>
                </div>
              )}
              
              {licenseInfo.issueDate && (
                <div className="infoItem">
                  <span className="infoLabel">Issue Date:</span>
                  <span className="infoValue">{formatDate(licenseInfo.issueDate)}</span>
                </div>
              )}
              
              {licenseInfo.expirationDate && (
                <div className="infoItem">
                  <span className="infoLabel">Expiration Date:</span>
                  <span className="infoValue">{formatDate(licenseInfo.expirationDate)}</span>
                </div>
              )}
            </div>

            {/* Specialties */}
            {licenseInfo.specialties && licenseInfo.specialties.length > 0 && (
              <div className="specialtiesSection">
                <h4 className="subsectionTitle">Specialties</h4>
                <div className="specialtyList">
                  {licenseInfo.specialties.map((specialty, index) => (
                    <span key={index} className="specialtyTag">
                      {specialty}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Disciplinary Actions */}
            {licenseInfo.disciplinaryActions && licenseInfo.disciplinaryActions.length > 0 && (
              <div className="disciplinarySection">
                <h4 className="subsectionTitle">Disciplinary Actions</h4>
                <div className="disciplinaryList">
                  {licenseInfo.disciplinaryActions.map((action, index) => (
                    <div key={index} className="disciplinaryItem">
                      <div className="disciplinaryHeader">
                        <span className="disciplinaryType">{action.type}</span>
                        <span className="disciplinaryDate">{formatDate(action.date)}</span>
                        <span className={`statusBadge ${getStatusBadgeClass(action.status, {})}`}>
                          {capitalize(action.status)}
                        </span>
                      </div>
                      <p className="disciplinaryDescription">{action.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Warnings */}
        {warnings && warnings.length > 0 && (
          <div className="section">
            <h3 className="sectionTitle">Warnings</h3>
            <div className="alertList">
              {warnings.map((warning, index) => (
                <div key={index} className={`alert alertWarning`}>
                  <svg width={ICON_SIZES.SMALL} height={ICON_SIZES.SMALL} viewBox="0 0 24 24" fill="currentColor">
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
          <div className="section">
            <h3 className="sectionTitle">Errors</h3>
            <div className="alertList">
              {errors.map((error, index) => (
                <div key={index} className={`alert alertError`}>
                  <svg width={ICON_SIZES.SMALL} height={ICON_SIZES.SMALL} viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                  </svg>
                  {error}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sources and Metadata */}
        <div className="footer">
          <div className="metadata">
            <p className="lastUpdated">
              Last updated: {formatDate(lastUpdated)}
            </p>
            {sources && sources.length > 0 && (
              <details className="sources">
                <summary className="sourcesToggle">
                  Data Sources ({sources.length})
                </summary>
                <ul className="sourcesList">
                  {sources.map((source, index) => (
                    <li key={index} className="sourceItem">
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