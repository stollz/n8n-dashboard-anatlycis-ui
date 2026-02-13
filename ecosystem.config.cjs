module.exports = {
  apps: [
    {
      name: "n8n-dashboard",
      script: "dist/index.cjs",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
