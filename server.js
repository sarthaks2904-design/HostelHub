const { createServer } = require("./src/app");
const { PORT } = require("./src/config");

createServer()
  .then(({ server }) => {
    server.listen(PORT, () => {
      console.log(`HostelHub is running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to start HostelHub:", error);
    process.exitCode = 1;
  });
