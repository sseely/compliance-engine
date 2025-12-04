/**
 * Provider logos export
 * Centralized export for all OAuth provider logo components
 */

import { GoogleLogo } from './GoogleLogo';
import { MicrosoftLogo } from './MicrosoftLogo';
import { LinkedInLogo } from './LinkedInLogo';
import { AppleLogo } from './AppleLogo';

export { GoogleLogo, MicrosoftLogo, LinkedInLogo, AppleLogo };

// Provider logo mapping
export const ProviderLogos = {
  google: GoogleLogo,
  microsoft: MicrosoftLogo,
  linkedin: LinkedInLogo,
  apple: AppleLogo,
} as const;

export type ProviderLogoProps = {
  size?: number;
  className?: string;
};

export type ProviderId = keyof typeof ProviderLogos;