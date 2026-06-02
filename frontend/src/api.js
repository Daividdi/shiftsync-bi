import axios from "axios";
const api = axios.create({ baseURL: "/bi/api" });
export default api;
