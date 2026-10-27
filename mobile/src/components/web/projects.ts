import type { IconName } from '../theme';

/**
 * The user's other projects on eventlab.world. The website links to them so you can switch
 * back and forth; they are separate sites and are never changed from here.
 */
export const OTHER_PROJECTS: { name: string; note: string; url: string; icon: IconName }[] = [
  { name: 'For You', note: 'eventlab.world', url: 'https://eventlab.world/', icon: 'heart-outline' },
  { name: 'Grievance Cell', note: 'eventlab.world/grievance', url: 'https://eventlab.world/grievance', icon: 'document-text-outline' },
];
