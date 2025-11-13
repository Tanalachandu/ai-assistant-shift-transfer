import axios from "axios";

const API = axios.create({
  baseURL: "http://localhost:4000",
});

// Request interceptor: Add token to requests
API.interceptors.request.use(
  config => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => Promise.reject(error)
);

// Response interceptor: Handle 401 errors globally
let redirecting = false;
API.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401 && !redirecting) {
      // Clear invalid token and user data
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      
      // Only redirect if not already on login/register page
      const currentPath = window.location.pathname;
      if (currentPath !== "/login" && currentPath !== "/register") {
        redirecting = true;
        window.dispatchEvent(new Event("auth-change"));
        // Redirect immediately to prevent multiple error displays
        window.location.href = "/login";
        // Return a resolved promise to suppress error display
        return Promise.resolve({ data: { redirecting: true } });
      }
    }
    return Promise.reject(error);
  }
);

export default API;
