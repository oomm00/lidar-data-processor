import axios from 'axios';

const API_BASE_URL = 'http://localhost:8080/api';

/**
 * Uploads a point cloud CSV file to the backend for processing.
 *
 * @param {File} file the CSV file to upload
 * @param {number} resolution the grid cell size in meters
 * @returns {Promise<Object>} the ProcessResult JSON from the server
 */
export async function processFile(file, resolution = 1.0) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('resolution', resolution);

  const response = await axios.post(`${API_BASE_URL}/process`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
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
