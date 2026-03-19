"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type User = {
  id: string;
  email: string;
  user_metadata?: { role?: string };
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("user");

  async function loadUsers() {
    setLoading(true);
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    setUsers(data);
    setLoading(false);
  }

  async function resetPassword(id: string) {
    const password = prompt("Nueva contraseña:");
    if (!password) return;
    await fetch("/api/admin/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, password }),
    });
    alert("Contraseña actualizada");
  }

  async function createUser() {
    if (!newEmail || !newPassword) return;
    await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: newEmail,
        password: newPassword,
        role: newRole,
      }),
    });
    alert("Usuario creado");
    setNewEmail("");
    setNewPassword("");
    setNewRole("user");
    loadUsers();
  }

  useEffect(() => {
    loadUsers();
  }, []);

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      <h1 className="text-3xl font-bold text-gray-800">Gestión de Usuarios</h1>

      {/* Crear usuario */}
      <div className="bg-white shadow rounded-lg p-6 space-y-4">
        <h2 className="text-xl font-semibold text-gray-700">
          Crear nuevo usuario
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input
            className="border p-2 rounded w-full"
            type="email"
            placeholder="Email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
          />
          <input
            className="border p-2 rounded w-full"
            type="password"
            placeholder="Contraseña inicial"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <select
            className="border p-2 rounded w-full"
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
          >
            <option value="user">Usuario</option>
            <option value="admin">Administrador</option>
          </select>
          <button
            className="bg-green-600 hover:bg-green-700 transition text-white px-4 py-2 rounded"
            onClick={createUser}
          >
            Crear
          </button>
        </div>
      </div>

      {/* Lista de usuarios */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-700 mb-4">
          Lista de usuarios
        </h2>
        {loading ? (
          <p>Cargando...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-auto w-full border-collapse">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="p-3 text-sm font-medium text-gray-600">ID</th>
                  <th className="p-3 text-sm font-medium text-gray-600">
                    Email
                  </th>
                  <th className="p-3 text-sm font-medium text-gray-600">Rol</th>
                  <th className="p-3 text-sm font-medium text-gray-600">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, idx) => (
                  <tr
                    key={u.id}
                    className={`border-t ${
                      idx % 2 === 0 ? "bg-gray-50" : "bg-white"
                    }`}
                  >
                    <td className="p-3 text-xs text-gray-500">{u.id}</td>
                    <td className="p-3 text-gray-700">{u.email}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          u.user_metadata?.role === "admin"
                            ? "bg-red-100 text-red-600"
                            : "bg-blue-100 text-blue-600"
                        }`}
                      >
                        {u.user_metadata?.role || "user"}
                      </span>
                    </td>
                    <td className="p-3">
                      <button
                        className="bg-blue-500 hover:bg-blue-600 transition text-white px-3 py-1 rounded text-sm"
                        onClick={() => resetPassword(u.id)}
                      >
                        Resetear contraseña
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
