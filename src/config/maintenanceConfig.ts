/**
 * Maintenance Mode Configuration
 * 
 * To enable maintenance mode:
 * 1. Set VITE_MAINTENANCE_MODE=true in your .env file
 * 2. Rebuild/restart your application
 * 
 * To disable maintenance mode:
 * 1. Set VITE_MAINTENANCE_MODE=false in your .env file
 * 2. Rebuild/restart your application
 */

export const isMaintenanceMode = (): boolean => {
  return import.meta.env.VITE_MAINTENANCE_MODE === 'true';
};

export const maintenanceConfig = {
  enabled: isMaintenanceMode(),
};
