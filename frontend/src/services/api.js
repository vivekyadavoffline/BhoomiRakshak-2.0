import axios from 'axios';
import { API_URL } from './apiConfig';

export const getLayers = async () => {
  const [hazards, habitations, sites] = await Promise.all([
    axios.get(`${API_URL}/layers/hazards`),
    axios.get(`${API_URL}/layers/habitations`),
    axios.get(`${API_URL}/layers/candidate-sites`)
  ]);

  return {
    hazards: hazards.data,
    habitations: habitations.data,
    sites: sites.data
  };     
};
export const getRedZones = async () => {
  const response = await axios.get(`${API_URL}/red-zones`);
  return response.data;
};
export const computeEngine = async () => {
  const response = await axios.post(`${API_URL}/engine/compute`);
  return response.data;
};   
export const downloadCertificate = (zoneId) => {
  window.open(`${API_URL}/red-zones/${zoneId}/certificate`, '_blank');
};
   
export const submitFeedback = async (feedback) => {
  const response = await axios.post(`${API_URL}/feedback`, feedback);
  return response.data;
};
