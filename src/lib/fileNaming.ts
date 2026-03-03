/**
 * Utility functions for generating consistent file names for photo uploads
 */

/**
 * Normalizes a string to be used in file names
 * - Removes accents and special characters
 * - Replaces spaces with underscores
 * - Converts to lowercase
 * - Removes any non-alphanumeric characters except underscores and hyphens
 */
export const normalizeForFileName = (str: string): string => {
  if (!str) return 'unknown';
  
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/[^a-zA-Z0-9_-]/g, '') // Remove special characters
    .toLowerCase()
    .substring(0, 50); // Limit length
};

/**
 * Generates a standardized file name for product photos
 * Format: {tienda}_{cod_producto}_{timestamp}.jpg
 * 
 * @param tienda - Store name
 * @param codProducto - Product code
 * @param userId - User ID (used as folder)
 * @param suffix - Optional suffix (e.g., 'producto', 'ingreso')
 * @returns Full file path for storage upload
 */
export const generatePhotoFileName = (
  tienda: string,
  codProducto: string,
  userId: string,
  suffix: string = 'producto'
): string => {
  const normalizedTienda = normalizeForFileName(tienda);
  const normalizedCodProducto = normalizeForFileName(codProducto || 'sin_codigo');
  const timestamp = Date.now();
  
  return `${userId}/${normalizedTienda}_${normalizedCodProducto}_${timestamp}_${suffix}.jpg`;
};

/**
 * Generates a file name for entry photos (foto de ingreso)
 * Format: {tienda}_{timestamp}_ingreso.jpg
 */
export const generateIngresoPhotoFileName = (
  tienda: string,
  userId: string
): string => {
  const normalizedTienda = normalizeForFileName(tienda);
  const timestamp = Date.now();
  
  return `${userId}/${normalizedTienda}_${timestamp}_ingreso.jpg`;
};

/**
 * Generates a file name for admin photo updates
 * Format: admin_{tienda}_{cod_producto}_{timestamp}.jpg
 */
export const generateAdminPhotoFileName = (
  tienda: string | undefined,
  codProducto: string | undefined
): string => {
  const normalizedTienda = normalizeForFileName(tienda || 'sin_tienda');
  const normalizedCodProducto = normalizeForFileName(codProducto || 'sin_codigo');
  const timestamp = Date.now();
  
  return `admin_${normalizedTienda}_${normalizedCodProducto}_${timestamp}.jpg`;
};
