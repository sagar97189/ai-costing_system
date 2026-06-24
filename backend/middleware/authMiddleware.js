const jwt = require("jsonwebtoken");

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
  res.end(JSON.stringify(data, null, 2));
}

function authenticateRequest(req, res, next) {
  try {
    const authHeader = req.headers["authorization"];
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      sendJson(res, 401, { success: false, message: "Authorization token missing" });
      return; // Stop execution without calling next()
    }

    const token = authHeader.substring(7).trim();
    if (!token) {
      sendJson(res, 401, { success: false, message: "Authorization token missing" });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    
    // Explicitly pass control to the next handler if successful
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      sendJson(res, 401, { success: false, message: "Session expired. Please login again." });
      return;
    }
    
    // Log security failure on server without exposing stack traces
    console.warn(`[SECURITY] JWT Validation Error: ${err.message}`);
    sendJson(res, 401, { success: false, message: "Invalid token" });
  }
}

function authorizeRoles(...allowedRoles) {
  return function (req, res, next) {
    if (!req.user || !req.user.role) {
      sendJson(res, 403, { success: false, message: "Access denied" });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      console.warn(`[SECURITY] Access denied. User role: ${req.user.role}, required: ${allowedRoles.join(", ")}`);
      sendJson(res, 403, { success: false, message: "Access denied" });
      return;
    }

    next();
  };
}

module.exports = {
  authenticateRequest,
  authorizeRoles
};
