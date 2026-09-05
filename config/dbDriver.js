const net = require("net");

const DEFAULT_DB_HOST = process.env.MZ_DB_HOST || "127.0.0.1";
const DEFAULT_DB_PORT = Number(process.env.MZ_DB_PORT || 31109);

function getDBConnectionConfig() {
  return {
    host: process.env.MZ_DB_HOST || DEFAULT_DB_HOST,
    port: Number(process.env.MZ_DB_PORT || DEFAULT_DB_PORT),
  };
}

function queryDB(cmd) {
    return new Promise((resolve, reject) => {
        const client = new net.Socket();
        const { host, port } = getDBConnectionConfig();

        client.connect(port, host, () => {
            client.write(cmd + "\n");
        });

        client.on("data", (data) => {
            resolve(data.toString().trim());
            client.destroy();
        });

        client.on("error", (err) => {
            console.error(`[NODE] Socket Error on ${host}:${port}:`, err.message);
            reject(err);
        });
    });
}

module.exports = { queryDB, getDBConnectionConfig };