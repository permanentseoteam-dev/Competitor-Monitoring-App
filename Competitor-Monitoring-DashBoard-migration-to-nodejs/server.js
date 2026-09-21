"use strict";

const { webcrypto } = require("crypto");
if (!globalThis.crypto) globalThis.crypto = webcrypto;

const { createApp } = require("./src/app");

const port = Number(process.env.PORT) || 3000;
const app = createApp();

app.listen(port, () => {
  console.log(`Competitor Monitor listening on http://localhost:${port}`);
});
