import axios from 'axios';

const API_BASE_URL = 'http://127.0.0.1:8000/api';

const api = axios.create({
    baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            
            const refreshToken = localStorage.getItem('refreshToken');
            if (refreshToken) {
                try {
                    const res = await axios.post(`${API_BASE_URL}/users/token/refresh/`, {
                        refresh: refreshToken,
                    });
                    localStorage.setItem('accessToken', res.data.access);
                    if (res.data.refresh) {
                        localStorage.setItem('refreshToken', res.data.refresh);
                    }
                    originalRequest.headers.Authorization = `Bearer ${res.data.access}`;
                    return api(originalRequest);
                } catch {
                    localStorage.removeItem('accessToken');
                    localStorage.removeItem('refreshToken');
                }
            }
        }
        return Promise.reject(error);
    }
);

export const login = (username, password) =>
    api.post('/users/login/', { username, password });

export const register = (data) =>
    api.post('/users/register/', data);

export const getProfile = () =>
    api.get('/users/me/');

export const fetchStock = (symbol) => api.get(`/stocks/fetch/${symbol}/`);
export const getStock = (symbol) => api.get(`/stocks/get/${symbol}/`);
export const analyzeStock = (symbol) => api.get(`/stocks/analyze/${symbol}/`);
export const searchStocks = (query) => api.get(`/stocks/search/?q=${encodeURIComponent(query)}`);
export const getTopMovers = () => api.get('/stocks/top-movers/');
export const getPortfolio = () => api.get('/portfolio/');
export const addPortfolioItem = (data) => api.post('/portfolio/', data);
export const deletePortfolioItem = (id) => api.delete(`/portfolio/${id}/`);
export const getFiiDiiActivity = (days = 30) => api.get(`/market/fii-dii/?days=${days}`);

export default api;
