import axios from 'axios';

const API_BASE_URL = 'http://localhost:8080/api';

/**
 * Uploads a point cloud CSV file to the backend for processing.
 *
 * @param {File} file the CSV file to upload
 * @param {number} resolution the grid cell size in meters
 * @returns {Promise<Object>} the ProcessResult JSON from the server
 */
export async function processFile(file, resolution = 1.0, originLat = 30.7346, originLon = 79.0669) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('resolution', resolution);
  formData.append('originLat', originLat);
  formData.append('originLon', originLon);

  const response = await axios.post(`${API_BASE_URL}/process`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
}

export function gridCellToLatLon(gridX, gridY, resolution, originLat, originLon) {
  const lat = originLat + (gridY * resolution) / 111320;
  const lon = originLon + (gridX * resolution) / (111320 * Math.cos(originLat * Math.PI / 180));
  return [lat, lon];
}

/**
 * Downloads the last processed result CSV.
 * Note: this is typically used by setting window.location.href directly
 * for a download trigger, but we provide this fetch-based wrapper if needed
 * to process the CSV client-side.
 *
 * @returns {Promise<string>} the RAW CSV string
 */
export async function downloadResult() {
  const response = await axios.get(`${API_BASE_URL}/result`, {
    responseType: 'text',
  });
  return response.data;
}
