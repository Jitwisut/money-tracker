const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL;

function getToken() {
  if (typeof window !== "undefined") {
    return localStorage.getItem("token");
  }
  return null;
}

export function setToken(token) {
  localStorage.setItem("token", token);
}

export function removeToken() {
  localStorage.removeItem("token");
}

export function isAuthenticated() {
  return !!getToken();
}
export const getCategories = async () => {
  const token = getToken();
  const res = await fetch(`${API_BASE}/api/transactions/category`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    return { data: [] };
  }
  return res.json();
};
async function request(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message || "เกิดข้อผิดพลาด");
  }

  return data;
}

// ===== Auth =====
export async function login(username, password) {
  const data = await request("/auth/signin", {
    method: "POST",
    headers: {
      "Content-Type": "application/json", // ต้องมีบรรทัดนี้
    },
    body: JSON.stringify({ username, password }),
  });
  if (data.token) {
    setToken(data.token);
  }
  return data;
}

export async function register(username, password, name) {
  return request("/auth/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json", // ต้องมีบรรทัดนี้
    },
    body: JSON.stringify({ username, password, name }),
  });
}

// ===== Transactions =====
export async function getTransactions({
  startDate,
  endDate,
  type,
  categoryId,
} = {}) {
  const params = new URLSearchParams();
  if (startDate) params.append("startDate", startDate);
  if (endDate) params.append("endDate", endDate);
  if (type && type !== "ALL") params.append("type", type);
  if (categoryId && categoryId !== "ALL")
    params.append("categoryId", categoryId);
  const query = params.toString();
  return request(`/api/transactions${query ? `?${query}` : ""}`);
}

export async function createTransaction(body) {
  return request("/api/transactions", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateTransaction(id, body) {
  return request(`/api/transactions/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function deleteTransaction(id) {
  return request(`/api/transactions/${id}`, {
    method: "DELETE",
  });
}

// ===== Dashboard =====
export async function getDashboard({
  startDate,
  endDate,
  type,
  categoryId,
} = {}) {
  const params = new URLSearchParams();
  if (startDate) params.append("startDate", startDate);
  if (endDate) params.append("endDate", endDate);
  if (type) params.append("type", type);
  if (categoryId && categoryId !== "ALL")
    params.append("categoryId", categoryId);
  const query = params.toString();
  return request(`/api/dashboard${query ? `?${query}` : ""}`);
}
