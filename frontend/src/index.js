import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "bootstrap/dist/css/bootstrap.min.css";  // ✅ Bootstrap import
import "./index.css"; // ✅ Our custom styling

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
