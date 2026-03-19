module.exports = {
  apps: [
    {
      name: "pedidos",
      script: "npm",
      args: "run start",
      cwd: "/home/pedidos/pedidos_app",
      max_memory_restart: "400M",
      env: {
        NODE_ENV: "production",
        PORT: 3000
      }
    }
  ]
};
